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
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")
      || Deno.env.get("STRIPE_KEY")
      || Deno.env.get("TEST_KEY")
      || ""
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const { items } = await req.json()
    const origin = req.headers.get('origin') || '*'

    const lineItems = (items || []).map((item: any) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.title || item.name || 'LunarCraft Product',
        },
        unit_amount: Math.round((item.price || 0) * 100),
        tax_behavior: 'unspecified', // Bypasses automatic tax classification requirements
      },
      quantity: item.quantity || 1,
    }))

    const session = await stripe.checkout.sessions.create({
  ui_mode: 'embedded',
  mode: 'payment',
  line_items: lineItems,
  
  // 1. Collect shipping address
  shipping_address_collection: {
    allowed_countries: ['US', 'CA'], // Add whatever countries you want to ship to
  },

  // 2. Add free or flat-rate shipping selection (optional, but completes the UI)
  shipping_options: [
    {
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: { amount: 0, currency: 'usd' }, // Set to 0 if shipping is built into item price
        display_name: 'Standard Shipping',
        delivery_estimate: {
          minimum: { unit: 'business_day', value: 3 },
          maximum: { unit: 'business_day', value: 7 },
        },
      },
    },
  ],

  return_url: `${origin}/return.html?session_id={CHECKOUT_SESSION_ID}`,
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