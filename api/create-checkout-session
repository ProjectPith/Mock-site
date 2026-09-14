import Stripe from 'stripe';

export async function onRequestPost(context) {
  // Access key stored securely in Cloudflare Environment Variables
  const stripe = new Stripe(context.env.STRIPE_SECRET_KEY);

  try {
    const { items } = await context.request.json();

    // Map your cart items to Stripe Line Items
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: { name: item.title },
        unit_amount: Math.round(item.price * 100), // convert dollars to cents
      },
      quantity: item.quantity || 1,
    }));

    // Create Embedded Checkout Session
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      line_items: lineItems,
      mode: 'payment',
      return_url: `${new URL(context.request.url).origin}/store/success.html?session_id={CHECKOUT_SESSION_ID}`,
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
