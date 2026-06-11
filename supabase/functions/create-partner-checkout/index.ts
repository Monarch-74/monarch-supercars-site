import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const stripeKey = (Deno.env.get("STRIPE_SECRET_KEY") ?? "").trim();
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY non configuré");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" });
    
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const supabaseKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
    if (!supabaseUrl || !supabaseKey) throw new Error("Secrets Supabase manquants");
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json();

    const { data: partner, error } = await supabase
      .from("partners")
      .insert({
        company_name: body.company_name,
        contact_name: body.contact_name,
        email: body.email,
        phone: body.phone,
        website_url: body.website_url,
        logo_url: body.logo_url,
        description: body.description,
        status: "pending",
        stripe_payment_status: "created"
      })
      .select()
      .single();
    if (error) throw error;

    const priceId = (Deno.env.get("STRIPE_PARTNER_PRICE_ID") ?? "").trim();
    if (!priceId) throw new Error("STRIPE_PARTNER_PRICE_ID non configuré");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: body.success_url || "https://monarch-supercars.app",
      cancel_url: body.cancel_url || "https://monarch-supercars.app/partners",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: body.email,
      metadata: {
        target_type: "partner",
        target_id: partner.id
      }
    });

    await supabase.from("partners").update({
      stripe_checkout_session_id: session.id
    }).eq("id", partner.id);

    // Get the price amount from Stripe
    let amountCents = 2500; // Default: 25€
    
    if (priceId) {
      try {
        const price = await stripe.prices.retrieve(priceId);
        amountCents = price.unit_amount || 2500;
      } catch (e) {
        console.warn("Could not fetch price, using default:", e);
      }
    }

    await supabase.from("payments").insert({
      target_type: "partner",
      target_id: partner.id,
      amount_cents: amountCents,
      stripe_checkout_session_id: session.id,
      payment_status: "created"
    });

    return Response.json({ checkout_url: session.url }, { headers: cors });
  } catch (error) {
    console.error("Erreur create-partner-checkout:", error);
    return Response.json({ error: error.message }, { headers: cors, status: 400 });
  }
});
