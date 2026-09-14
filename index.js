export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Intercept the checkout POST request
    if (url.pathname === '/api/create-checkout-session' && request.method === 'POST') {
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
      };

      try {
        const body = await request.json();
        const origin = request.headers.get('origin') || url.origin;

        // Build Stripe line items
        const lineItemsParams = new URLSearchParams({
          'ui_mode': 'embedded',
          'mode': 'payment',
          'return_url': `${origin}/return.html?session_id={CHECKOUT_SESSION_ID}`,
        });

        body.items.forEach((item, index) => {
          lineItemsParams.append(`line_items[${index}][price_data][currency]`, 'usd');
          lineItemsParams.append(`line_items[${index}][price_data][product_data][name]`, item.name);
          lineItemsParams.append(`line_items[${index}][price_data][unit_amount]`, Math.round(item.price * 100));
          lineItemsParams.append(`line_items[${index}][quantity]`, item.quantity || 1);
        });

        // Send request directly to Stripe
        const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: lineItemsParams.toString(),
        });

        const session = await stripeResponse.json();

        if (session.error) {
          return new Response(JSON.stringify({ error: session.error.message }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
          status: 200,
          headers: corsHeaders,
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // 2. Handle CORS preflight requests
    if (url.pathname === '/api/create-checkout-session' && request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // 3. Fallback to serving static site assets
    return env.ASSETS.fetch(request);
  }
};
