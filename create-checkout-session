export async function onRequestPost(context) {
  const { request, env } = context;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  try {
    const body = await request.json().catch(() => ({}));
    const origin = request.headers.get('origin') || 'https://lunarcraftdev.pages.dev';

    // Build line items for Stripe
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

    // Call Stripe API using standard fetch
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
      return new Response(JSON.stringify({ error: session.error.message }), {
        status: 400,
        headers,
      });
    }

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      status: 200,
      headers,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers,
    });
  }
}

// Handle CORS preflight OPTIONS request
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}
