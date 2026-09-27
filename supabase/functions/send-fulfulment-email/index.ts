const encoder = new TextEncoder();

function constantTimeEquals(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const expectedSecret = Deno.env.get('FULFILLMENT_TRIGGER_SECRET') || '';
  const providedSecret = request.headers.get('x-fulfillment-trigger') || '';
  if (!expectedSecret || !constantTimeEquals(providedSecret, expectedSecret)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const record = payload?.record || payload;
    if (record?.status !== 'completed') {
      return Response.json({ message: 'No action taken' });
    }

    const customerEmail = String(record.customer_email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return Response.json({ error: 'Invalid customer email' }, { status: 400 });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return Response.json({ error: 'Email service is not configured' }, { status: 500 });
    }

    const customerName = escapeHtml(record.customer_name || 'Valued Customer');
    const trackingNumber = escapeHtml(record.tracking_number || 'No tracking provided');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: 'LunarCraft <ecommerce@lunarcraft.dev>',
        to: [customerEmail],
        subject: 'Your Order Has Been Fulfilled',
        html: `<div style="font-family:sans-serif;line-height:1.6;color:#333"><h2>Good news, ${customerName}!</h2><p>Your order from <strong>LunarCraft</strong> has been marked as complete and is on its way.</p><p><strong>Tracking Number:</strong> ${trackingNumber}</p><p>Thank you for shopping with us!</p></div>`
      })
    });

    if (!response.ok) {
      console.error('Resend request failed with status', response.status);
      return Response.json({ error: 'Email service rejected the request' }, { status: 502 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Fulfillment email handler failed:', error instanceof Error ? error.message : 'Unknown error');
    return Response.json({ error: 'Request failed' }, { status: 500 });
  }
});