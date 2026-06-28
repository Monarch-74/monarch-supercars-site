import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/admin-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const supabaseKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
    if (!supabaseUrl || !supabaseKey) throw new Error("Secrets Supabase manquants");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const adminUser = await requireAdmin(req, supabase);

    const VALID_PARTNER_STATUSES = ["approved", "rejected", "inactive", "pending", "paid"];
    const VALID_EVENT_STATUSES = ["approved", "rejected", "archived", "pending_review", "draft"];

    if (body.target_type === "partner") {
      if (!VALID_PARTNER_STATUSES.includes(body.status)) throw new Error("Statut partenaire invalide");
    } else if (body.target_type === "event") {
      if (!VALID_EVENT_STATUSES.includes(body.status)) throw new Error("Statut événement invalide");
    }

    if (body.target_type === "partner") {
      const { data: partner, error: partnerError } = await supabase
        .from("partners")
        .update({ status: body.status })
        .eq("id", body.id)
        .select()
        .single();

      if (partnerError) throw partnerError;

      const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
      const emailFrom = (Deno.env.get("EMAIL_FROM") ?? "MONARCH SUPERCARS <onboarding@resend.dev>").trim();

      if (resendKey && partner?.email) {
        const isApproved = body.status === "approved";

        const subject = isApproved
          ? "Votre partenariat MONARCH SUPERCARS est validé"
          : "Mise à jour de votre demande partenaire MONARCH SUPERCARS";

        const html = isApproved
          ? `<h2>Bonne nouvelle, ${partner.contact_name || partner.company_name} !</h2>
             <p>Votre partenariat avec MONARCH SUPERCARS pour <strong>${partner.company_name}</strong> a été validé.</p>
             <p>Votre profil est désormais visible sur la page Partenaires.</p>`
          : `<h2>Bonjour ${partner.contact_name || partner.company_name},</h2>
             <p>Votre demande de partenariat pour <strong>${partner.company_name}</strong> n'a pas été retenue pour le moment.</p>`;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from: emailFrom, to: partner.email, subject, html }),
        }).catch((e) => console.log("RESEND PARTNER STATUS ERROR:", e));
      }
    } else if (body.target_type === "event") {
      const { error: eventError } = await supabase
        .from("events")
        .update({ status: body.status })
        .eq("id", body.id);

      if (eventError) throw eventError;
    } else {
      throw new Error("target_type invalide");
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: adminUser.id,
      action: "admin_status_update",
      target_type: body.target_type,
      target_id: body.id,
      metadata: { status: body.status }
    });

    return Response.json({ ok: true }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400, headers: cors });
  }
});
