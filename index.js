export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Intercept the checkout endpoint
    if (url.pathname === '/API/create-checkout-session') {
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json',
      };

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
      }

      if (request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const origin = request.headers.get('origin') || url.origin;

          const params = new URLSearchParams({
            'ui_mode': 'embedded',
            'mode': 'payment',
            'return_url': `${origin}/return.html?session_id={CHECKOUT_SESSION_ID}`,
          });

          (body.items || []).forEach((item, index) => {
            const productName = item.title || item.name || 'LunarCraft Product';
            const unitAmount = Math.round((item.price || 0) * 100);

            params.append(`line_items[${index}][price_data][currency]`, 'usd');
            params.append(`line_items[${index}][price_data][product_data][name]`, productName);
            params.append(`line_items[${index}][price_data][unit_amount]`, unitAmount);
            params.append(`line_items[${index}][quantity]`, item.quantity || 1);
          });

          const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          });

          const session = await stripeResponse.json();

          if (session.error) {
            return new Response(JSON.stringify({ error: session.error.message }), { status: 400, headers });
          }

          return new Response(JSON.stringify({ clientSecret: session.client_secret }), { status: 200, headers });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
        }
      }

      return new Response('Method Not Allowed', { status: 405 });
    }

    // 2. Fall back to serving your static site (index.html, CSS, JS)
    return env.ASSETS.fetch(request);
  }
};
