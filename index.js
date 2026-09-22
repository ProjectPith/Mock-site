export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.toLowerCase().replace(/\/$/, ''); // Normalizes URL path

    if (path === '/api/create-checkout-session') {
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json',
      };

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

    return env.ASSETS.fetch(request);
  }
};

// Inside your existing export default { async fetch(request, env) { ... } }

const url = new URL(request.url);

// ADD THIS ROUTE CONDITION:
if (url.pathname === "/api/send-rejection-email" && request.method === "POST") {
  try {
    const { recipients, projectName, reason } = await request.json();

    // Uses the RESEND_API_KEY environment variable on Cloudflare
    const apiKey = env.RESEND_API_KEY;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "LunarCraft <applications@lunarcraft.dev>", // Replace with your domain once verified on Resend
        to: recipients,
        subject: `Update regarding your project intake: ${projectName}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #111; padding: 20px;">
            <h2>Project Intake Notice</h2>
            <p>Hello,</p>
            <p>Thank you for submitting a project intake for <strong>${projectName}</strong>.</p>
            <p>After reviewing the details, we regret to inform you that the submission has been declined.</p>
            <blockquote style="background: #f4f4f4; border-left: 4px solid #e74c3c; padding: 10px 15px; margin: 15px 0;">
              <strong>Reason / Note:</strong><br>${reason}
            </blockquote>
            <p>If you have any questions, please reply directly to this email.</p>
            <p>Best regards,<br><strong>LunarCraft</strong></p>
          </div>
        `
      })
    });

    const data = await resendRes.json();
    return new Response(JSON.stringify(data), {
      status: resendRes.status,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
