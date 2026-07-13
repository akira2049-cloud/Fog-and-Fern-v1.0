(() => {
  const form = document.getElementById("checkout-form");
  if (!form) return;

  const fulfillment = document.getElementById("fulfillment");
  const paymentMessage = document.getElementById("payment-message");
  const submitButton = document.getElementById("place-order-button");
  const subtotal = Number(document.getElementById("checkout-subtotal").textContent);
  const tax = Number(document.getElementById("checkout-tax")?.textContent || 0);
  let squareCard = null;

  function showMessage(message, type = "error") {
    paymentMessage.textContent = message;
    paymentMessage.className = `payment-message show ${type}`;
  }

  function clearMessage() {
    paymentMessage.textContent = "";
    paymentMessage.className = "payment-message";
  }

  function updateFulfillment() {
    const delivery = fulfillment.value === "delivery";
    document.querySelectorAll(".delivery-field").forEach((field) => {
      field.hidden = !delivery;
      field.querySelectorAll("input").forEach((input) => { input.required = delivery; });
    });
    const fee = delivery && subtotal < 75 ? 9 : 0;
    document.getElementById("delivery-fee").textContent = `$${fee.toFixed(2)}`;
    document.getElementById("checkout-total").textContent = (subtotal + tax + fee).toFixed(2);
  }

  async function initializeSquare() {
    if (!window.FOG_FERN_SQUARE || !window.Square) return;
    try {
      const payments = window.Square.payments(
        window.FOG_FERN_SQUARE.applicationId,
        window.FOG_FERN_SQUARE.locationId
      );
      squareCard = await payments.card();
      await squareCard.attach("#card-container");
    } catch (error) {
      console.error(error);
      showMessage("The secure Square card form could not load. Choose pay on delivery or refresh the page.");
    }
  }

  document.querySelectorAll('input[name="payment_method"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      document.querySelectorAll(".payment-choice").forEach((choice) => choice.classList.remove("active"));
      radio.closest(".payment-choice").classList.add("active");
      const cardContainer = document.getElementById("square-card-container");
      if (cardContainer) cardContainer.hidden = radio.value !== "Square card";
      clearMessage();
    });
  });

  fulfillment.addEventListener("change", updateFulfillment);
  updateFulfillment();
  initializeSquare();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const paymentMethod = formData.get("payment_method");
    submitButton.disabled = true;
    submitButton.classList.add("is-loading");

    try {
      let sourceId = "";
      if (paymentMethod === "Square card") {
        if (!squareCard) throw new Error("The Square card form is not ready yet.");
        const tokenResult = await squareCard.tokenize();
        if (tokenResult.status !== "OK") {
          const details = tokenResult.errors?.map((error) => error.message).join(" ");
          throw new Error(details || "Please check your card information.");
        }
        sourceId = tokenResult.token;
      }

      const payload = Object.fromEntries(formData.entries());
      payload.source_id = sourceId;
      const response = await fetch("/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Checkout failed.");
      window.location.assign(result.redirect);
    } catch (error) {
      showMessage(error.message || "Payment failed. Please try again.");
      submitButton.disabled = false;
      submitButton.classList.remove("is-loading");
    }
  });
})();
