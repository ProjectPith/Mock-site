import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripe = new Stripe(Deno.env.get("TEST_KEY") || "", {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // 1. Destructure product_tags sent from cart.js along with items
    const { items, product_tags } = await req.json()
    const origin = req.headers.get('origin') || '*'

    const lineItems = (items || []).map((item: any) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.title || item.name || 'LunarCraft Product',
        },
        unit_amount: Math.round((item.price || 0) * 100),
        tax_behavior: 'unspecified',
      },
      quantity: item.quantity || 1,
    }))

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'payment',
      line_items: lineItems,

      // 2. Attach short tags to metadata so the Webhook can read them upon payment completion
      metadata: {
        product_tags: JSON.stringify(product_tags || [])
      },
      
      shipping_address_collection: {
        allowed_countries: ['US', 'CA'],
      },

      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'usd' },
            display_name: 'Standard Shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 7 },
            },
          },
        },
      ],

      return_url: `${origin}/index.html?session_id={CHECKOUT_SESSION_ID}`,
    })

    return new Response(
      JSON.stringify({ clientSecret: session.client_secret }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})