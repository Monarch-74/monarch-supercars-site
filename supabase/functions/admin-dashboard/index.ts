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

    const [
      { count: partners },
      { count: events },
      { count: contacts },
      { count: registrations },
      { count: roadtrips },
      { data: payments },
      { data: pendingPartners },
      { data: pendingEvents },
      { data: audit },
      { data: analyticsSummary },
    ] = await Promise.all([
      supabase.from("partners").select("*", { count: "exact", head: true }),
      supabase.from("events").select("*", { count: "exact", head: true }),
      supabase.from("contact_messages").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("roadtrip_requests").select("*", { count: "exact", head: true }),
      supabase.from("payments").select("amount_cents,payment_status"),
      supabase.from("partners").select("*").in("status", ["pending", "paid"]).order("created_at", { ascending: false }).limit(20),
      supabase.from("events").select("*").in("status", ["pending_review", "paid", "draft"]).order("created_at", { ascending: false }).limit(20),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.rpc("admin_analytics_summary"),
    ]);

    // Liste des membres inscrits (email + nom + date + rôle)
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({ perPage: 500 });
    const { data: profiles } = await supabase.from("profiles").select("id,full_name,role,created_at");

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    const members = (authUsers || []).map(u => ({
      id: u.id,
      email: u.email,
      full_name: profileMap[u.id]?.full_name || "",
      role: profileMap[u.id]?.role || "user",
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at || null,
    })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const revenueCents = (payments || []).filter(p => p.payment_status === "paid").reduce((sum, p) => sum + (p.amount_cents || 0), 0);
    const analytics = (analyticsSummary && analyticsSummary[0]) || {};

    return Response.json({
      kpis: {
        partners: partners || 0,
        events: events || 0,
        contacts: contacts || 0,
        revenue: `${(revenueCents / 100).toFixed(2)} €`,
        registrations: registrations || 0,
        roadtrips: roadtrips || 0,
        pageViews: Number(analytics.page_views || 0),
        visits: Number(analytics.unique_visits || 0),
        durationMin: analytics.duration_min ?? null,
        durationMax: analytics.duration_max ?? null,
        durationAvg: analytics.duration_avg ?? null,
      },
      members,
      pendingPartners: pendingPartners || [],
      pendingEvents: pendingEvents || [],
      audit: audit || [],
    }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400, headers: cors });
  }
});
