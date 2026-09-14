export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Intercept POST request to the checkout endpoint
    if (url.pathname === '/api/create-checkout-session' && request.method === 'POST') {
      try {
        const body = await request.json();
        const Stripe = require('stripe'); // Or import Stripe from 'stripe'
        const stripe = new Stripe(env.STRIPE_SECRET_KEY);

        // Map items from request
        const line_items = body.items.map(item => ({
          price_data: {
            currency: 'usd',
            product_data: { name: item.name },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.quantity || 1,
        }));

        const session = await stripe.checkout.sessions.create({
          ui_mode: 'embedded',
          line_items,
          mode: 'payment',
          return_url: `${url.origin}/return.html?session_id={CHECKOUT_SESSION_ID}`,
        });

        return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // Serve static frontend assets for all other routes
    return env.ASSETS.fetch(request);
  }
};
