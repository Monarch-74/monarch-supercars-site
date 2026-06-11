import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/admin-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const supabaseKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
    if (!supabaseUrl || !supabaseKey) throw new Error("Secrets Supabase manquants");
    const supabase = createClient(supabaseUrl, supabaseKey);

    await requireAdmin(req, supabase);

    const [{ count: partners }, { count: events }, { count: contacts }, { data: payments }, { data: pendingPartners }, { data: pendingEvents }, { data: audit }] =
      await Promise.all([
        supabase.from("partners").select("*", { count: "exact", head: true }),
        supabase.from("events").select("*", { count: "exact", head: true }),
        supabase.from("contact_messages").select("*", { count: "exact", head: true }),
        supabase.from("payments").select("amount_cents,payment_status"),
        supabase.from("partners").select("*").in("status", ["pending", "paid"]).order("created_at", { ascending: false }).limit(20),
        supabase.from("events").select("*").in("status", ["pending_review", "paid", "draft"]).order("created_at", { ascending: false }).limit(20),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(20),
      ]);

    const revenueCents = (payments || []).filter(p => p.payment_status === "paid").reduce((sum, p) => sum + (p.amount_cents || 0), 0);

    return Response.json({
      kpis: {
        partners: partners || 0,
        events: events || 0,
        contacts: contacts || 0,
        revenue: `${(revenueCents / 100).toFixed(2)} €`
      },
      pendingPartners: pendingPartners || [],
      pendingEvents: pendingEvents || [],
      audit: audit || []
    }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400, headers: cors });
  }
});
