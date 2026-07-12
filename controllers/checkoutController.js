const db=require("../config/database");
const {hydrate}=require("./cartController");
exports.index=(req,res)=>{const items=hydrate(req);if(!items.length){req.flash("error","Your cart is empty.");return res.redirect("/shop");}const subtotal=items.reduce((s,i)=>s+i.line_total,0);res.render("checkout/index",{title:"Checkout | Fog & Fern SF",page:"checkout",items,subtotal,user:req.session.user||{}});};
exports.place=(req,res)=>{
  const items=hydrate(req); if(!items.length){req.flash("error","Your cart is empty.");return res.redirect("/shop");}
  const {customer_name,email,phone,address,city="San Francisco",zip_code,fulfillment="delivery",payment_method="Pay on delivery",notes=""}=req.body;
  if(!customer_name||!email||!phone|| (fulfillment==="delivery"&&(!address||!zip_code))){req.flash("error","Please complete all required checkout fields.");return res.redirect("/checkout");}
  const subtotal=items.reduce((s,i)=>s+i.line_total,0); const delivery_fee=fulfillment==="delivery"&&subtotal<75?9:0; const total=subtotal+delivery_fee; const order_number=`FF-${Date.now().toString().slice(-8)}`;
  const tx=db.transaction(()=>{
    for(const i of items){const fresh=db.prepare("SELECT stock FROM products WHERE id=?").get(i.id);if(!fresh||fresh.stock<i.quantity)throw new Error(`${i.name} does not have enough stock.`);}
    const result=db.prepare(`INSERT INTO orders (user_id,order_number,customer_name,email,phone,address,city,zip_code,fulfillment,payment_method,subtotal,delivery_fee,total,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(req.session.user?.id||null,order_number,customer_name,email,phone,address||null,city,zip_code||null,fulfillment,payment_method,subtotal,delivery_fee,total,notes);
    const add=db.prepare("INSERT INTO order_items (order_id,product_id,product_name,unit_price,quantity,line_total) VALUES (?,?,?,?,?,?)");
    const dec=db.prepare("UPDATE products SET stock=stock-? WHERE id=?");
    items.forEach(i=>{add.run(result.lastInsertRowid,i.id,i.name,i.unit_price,i.quantity,i.line_total);dec.run(i.quantity,i.id);});
    return result.lastInsertRowid;
  });
  try{const id=tx();req.session.cart={};res.redirect(`/checkout/success/${id}`);}catch(e){req.flash("error",e.message);res.redirect("/cart");}
};
exports.success=(req,res)=>{const order=db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id);if(!order)return res.redirect("/");const items=db.prepare("SELECT * FROM order_items WHERE order_id=?").all(order.id);res.render("checkout/success",{title:"Order Confirmed | Fog & Fern SF",page:"checkout",order,items});};
