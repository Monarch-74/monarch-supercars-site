// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const body = await req.json();

    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const supabaseServiceRole = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
    if (!supabaseUrl || !supabaseServiceRole) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY non configurés");

    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    const payload = {
      company_name: String(body.company_name || "").trim(),
      contact_name: String(body.contact_name || "").trim(),
      email: String(body.email || "").trim(),
      phone: String(body.phone || "").trim(),
      website_url: String(body.website || body.website_url || "").trim() || null,
      logo_url: body.logo_url || null,
      description: String(body.description || "").trim(),
      status: "pending",
      stripe_payment_status: "not_requested",
    };

    if (!payload.company_name || !payload.email) {
      throw new Error("Le nom de la société et l'email sont obligatoires.");
    }

    const { data: partner, error } = await supabase
      .from("partners")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
    const adminEmail = (Deno.env.get("ADMIN_EMAIL") ?? "admin@monarch-apps.com").trim();
    const emailFrom = (Deno.env.get("EMAIL_FROM") ?? "MONARCH SUPERCARS <onboarding@resend.dev>").trim();

    if (resendKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: emailFrom,
          to: adminEmail,
          subject: "Nouvelle demande partenaire MONARCH SUPERCARS",
          html: `
            <h2>Nouvelle demande partenaire</h2>
            <p><strong>Société :</strong> ${payload.company_name}</p>
            <p><strong>Contact :</strong> ${payload.contact_name}</p>
            <p><strong>Email :</strong> ${payload.email}</p>
            <p><strong>Téléphone :</strong> ${payload.phone}</p>
            <p><strong>Site web :</strong> ${payload.website_url || "-"}</p>
            <p><strong>Description :</strong></p>
            <p>${payload.description.replace(/\n/g, "<br>")}</p>
            <p>Connectez-vous à l'espace Admin pour valider ou refuser cette demande.</p>
          `,
        }),
      }).catch((e: unknown) => console.log("RESEND ADMIN ERROR:", e));

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: emailFrom,
          to: payload.email,
          subject: "Votre demande partenaire MONARCH SUPERCARS",
          html: `
            <h2>Merci pour votre demande, ${payload.contact_name || payload.company_name} !</h2>
            <p>Votre demande de partenariat pour <strong>${payload.company_name}</strong> a bien été reçue.</p>
            <p>Notre équipe va l'étudier et reviendra vers vous après validation par l'administrateur.</p>
          `,
        }),
      }).catch((e: unknown) => console.log("RESEND PARTNER ERROR:", e));
    }

    return Response.json(
      { ok: true, id: partner.id, message: "Demande partenaire envoyée avec succès." },
      { headers: cors }
    );
  } catch (error: any) {
    return Response.json(
      { error: error.message || "Erreur partner-request-intake" },
      { status: 400, headers: cors }
    );
  }
});
