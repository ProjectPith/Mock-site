import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = header.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBytes = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`))
  );
  const expected = Array.from(signatureBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return signatures.some((signature) => constantTimeEquals(signature, expected));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const bodyText = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("Missing STRIPE_WEBHOOK_SECRET");
      return new Response(JSON.stringify({ error: "Webhook verification is not configured" }), { status: 500 });
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature || !(await verifyStripeSignature(bodyText, signature, webhookSecret))) {
      return new Response(JSON.stringify({ error: "Invalid Stripe signature" }), { status: 401 });
    }

    let event;

    try {
      event = JSON.parse(bodyText);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("Failed to parse JSON body:", message);
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }

    console.log("Received Stripe Event Type:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // 1. Unpack short tags passed in from session metadata
      const rawTags = session.metadata?.product_tags;
      let productTags = [];

      if (rawTags) {
        try {
          productTags = typeof rawTags === 'string' ? JSON.parse(rawTags) : rawTags;
        } catch (e) {
          console.warn("Failed to parse product_tags metadata:", e);
        }
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (!supabaseUrl || !serviceRoleKey) {
        console.error("Missing Supabase server credentials");
        return new Response(JSON.stringify({ error: "Order persistence is not configured" }), { status: 500 });
      }

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      // Safely extract address or provide fallback object to satisfy NOT NULL constraint
      const addressFallback = session.shipping_details?.address 
        || session.customer_details?.address 
        || { line1: "No address provided", city: "N/A", country: "US" };

      // 2. Pass product_tags into the insert payload
      const { data, error } = await supabaseAdmin
        .from("orders")
        .insert([{
          stripe_session_id: session.id,
          customer_name: session.customer_details?.name || "Guest",
          customer_email: session.customer_details?.email || "no-email@provided.com",
          shipping_address: addressFallback,
          total_amount: (session.amount_total || 0) / 100,
          product_tags: productTags, // Saves short codes array (e.g., ["LC Hdy | M | C", "LC MP"])
          status: "pending"
        }]);

      if (error) {
        console.error("SUPABASE DATABASE INSERT ERROR:", error.message);
        return new Response(JSON.stringify({ db_error: error.message }), { status: 400 });
      }

      console.log("SUCCESSFULLY INSERTED ORDER:", session.id);
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("UNHANDLED CRITICAL ERROR:", message);
    return new Response(JSON.stringify({ critical_error: message }), { status: 400 });
  }
});