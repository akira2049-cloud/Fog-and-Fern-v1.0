const crypto = require("crypto");
const db = require("../config/database");
const { hydrate } = require("./cartController");

function totals(items, fulfillment = "delivery") {
  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
  const taxRate = 0.08625;
  const tax = Number((subtotal * taxRate).toFixed(2));
  const deliveryFee = fulfillment === "delivery" && subtotal < 75 ? 9 : 0;
  return { subtotal, tax, taxRate, deliveryFee, total: Number((subtotal + tax + deliveryFee).toFixed(2)) };
}

function squareBaseUrl() {
  return process.env.SQUARE_ENVIRONMENT === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

function squareWebSdkUrl() {
  return process.env.SQUARE_ENVIRONMENT === "production"
    ? "https://web.squarecdn.com/v1/square.js"
    : "https://sandbox.web.squarecdn.com/v1/square.js";
}

function validateCheckout(body) {
  const {
    customer_name,
    email,
    phone,
    address,
    zip_code,
    fulfillment = "delivery"
  } = body;

  if (!customer_name || !email || !phone) return "Please complete your contact information.";
  if (fulfillment === "delivery" && (!address || !zip_code)) {
    return "Street address and ZIP code are required for delivery.";
  }
  return null;
}

function verifyStock(items) {
  for (const item of items) {
    const fresh = db.prepare("SELECT stock FROM products WHERE id = ? AND active = 1").get(item.id);
    if (!fresh || fresh.stock < item.quantity) {
      throw new Error(`${item.name} does not have enough stock.`);
    }
  }
}

function saveOrder(req, items, payment) {
  const {
    customer_name,
    email,
    phone,
    address,
    city = "San Francisco",
    zip_code,
    fulfillment = "delivery",
    payment_method = "Pay on delivery",
    notes = ""
  } = req.body;
  const { subtotal, tax, deliveryFee, total } = totals(items, fulfillment);
  const orderNumber = `FF-${Date.now().toString().slice(-8)}`;

  const transaction = db.transaction(() => {
    verifyStock(items);
    const result = db.prepare(`
      INSERT INTO orders (
        user_id, order_number, customer_name, email, phone, address, city,
        zip_code, fulfillment, payment_method, subtotal, tax, delivery_fee, total,
        status, notes, payment_status, square_payment_id, payment_receipt_url, card_brand, card_last_four
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.session.user?.id || null,
      orderNumber,
      customer_name,
      email,
      phone,
      address || null,
      city,
      zip_code || null,
      fulfillment,
      payment_method,
      subtotal,
      tax,
      deliveryFee,
      total,
      payment?.status === "COMPLETED" ? "Confirmed" : "Pending",
      notes,
      payment?.status || "PENDING",
      payment?.id || null,
      payment?.receipt_url || null,
      payment?.card_details?.card?.card_brand || null,
      payment?.card_details?.card?.last_4 || null
    );

    const addItem = db.prepare(`
      INSERT INTO order_items
      (order_id, product_id, product_name, unit_price, quantity, line_total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const decreaseStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");

    items.forEach((item) => {
      addItem.run(result.lastInsertRowid, item.id, item.name, item.unit_price, item.quantity, item.line_total);
      decreaseStock.run(item.quantity, item.id);
    });

    return result.lastInsertRowid;
  });

  return transaction();
}

exports.index = (req, res) => {
  const items = hydrate(req);
  if (!items.length) {
    req.flash("error", "Your cart is empty.");
    return res.redirect("/shop");
  }

  const { subtotal, tax } = totals(items);
  const squareConfigured = Boolean(
    process.env.SQUARE_APPLICATION_ID &&
    process.env.SQUARE_LOCATION_ID &&
    process.env.SQUARE_ACCESS_TOKEN
  );

  res.render("checkout/index", {
    title: "Checkout | Fog & Fern SF",
    page: "checkout",
    items,
    subtotal,
    tax,
    user: req.session.user || {},
    squareConfigured,
    squareApplicationId: process.env.SQUARE_APPLICATION_ID || "",
    squareLocationId: process.env.SQUARE_LOCATION_ID || "",
    squareWebSdkUrl: squareWebSdkUrl()
  });
};

exports.place = async (req, res) => {
  const items = hydrate(req);
  if (!items.length) {
    return res.status(400).json({ ok: false, message: "Your cart is empty." });
  }

  const validationError = validateCheckout(req.body);
  if (validationError) return res.status(422).json({ ok: false, message: validationError });

  const paymentMethod = req.body.payment_method || "Pay on delivery";
  const isSquare = paymentMethod === "Square card";

  try {
    verifyStock(items);
    let squarePayment = null;

    if (isSquare) {
      if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
        throw new Error("Square payments are not configured on the server.");
      }
      if (!req.body.source_id) throw new Error("The card could not be tokenized. Please try again.");

      const { total } = totals(items, req.body.fulfillment);
      const response = await fetch(`${squareBaseUrl()}/v2/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Square-Version": process.env.SQUARE_API_VERSION || "2026-05-20",
          Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          source_id: req.body.source_id,
          idempotency_key: crypto.randomUUID(),
          amount_money: {
            amount: Math.round(total * 100),
            currency: "USD"
          },
          autocomplete: true,
          location_id: process.env.SQUARE_LOCATION_ID,
          buyer_email_address: req.body.email,
          note: `Fog & Fern SF order for ${req.body.customer_name}`
        })
      });

      const result = await response.json();
      if (!response.ok || !result.payment || result.payment.status !== "COMPLETED") {
        const detail = result.errors?.map((error) => error.detail).filter(Boolean).join(" ");
        throw new Error(detail || "Square could not complete the payment.");
      }
      squarePayment = result.payment;
    }

    const orderId = saveOrder(req, items, squarePayment);
    req.session.cart = {};
    return res.json({ ok: true, redirect: `/checkout/success/${orderId}` });
  } catch (error) {
    console.error("Checkout error:", error);
    return res.status(400).json({ ok: false, message: error.message || "Checkout failed." });
  }
};

exports.success = async (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.redirect("/");
  const items = db.prepare(`SELECT oi.*, p.image_url FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`).all(order.id);
  const receiptUrl = `${req.protocol}://${req.get("host")}/checkout/receipt/${order.id}`;
  res.render("checkout/success", {
    title: "Order Confirmed | Fog & Fern SF",
    page: "checkout",
    order,
    items,
    receiptUrl
  });
};

exports.receipt = (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.redirect("/");
  const items = db.prepare(`SELECT oi.*, p.image_url FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`).all(order.id);
  const receiptUrl = `${req.protocol}://${req.get("host")}/checkout/receipt/${order.id}`;
  res.render("checkout/receipt", { title: `Receipt ${order.order_number} | Fog & Fern SF`, page: "checkout", order, items, receiptUrl });
};
