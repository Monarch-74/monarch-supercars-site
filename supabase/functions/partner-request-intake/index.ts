// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/send-email.ts";

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

    // Piège à robots : un bot remplit tous les champs du formulaire, y compris
    // le champ "hp_field" invisible pour un humain. On répond un faux succès
    // (sans rien enregistrer) pour ne pas indiquer au bot qu'il a été repéré.
    if (String(body.hp_field || "").trim() !== "") {
      return Response.json({ ok: true, message: "Demande partenaire envoyée avec succès." }, { headers: cors });
    }

    // Un humain met toujours plus de 2 secondes à remplir le formulaire ;
    // un remplissage quasi instantané trahit un robot.
    const elapsedMs = Number(body.elapsed_ms || 0);
    if (elapsedMs > 0 && elapsedMs < 2000) {
      return Response.json({ ok: true, message: "Demande partenaire envoyée avec succès." }, { headers: cors });
    }

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

    // Filtre anti-spam : le champ "site web" dédié peut légitimement contenir
    // un lien, mais la description libre n'en a normalement pas besoin — c'est
    // là que le spam injecte ses liens.
    if (/https?:\/\//i.test(payload.description)) {
      throw new Error("Merci de ne pas inclure de lien dans la description. Utilisez le champ \"Site web\" prévu à cet effet.");
    }

    // Limite anti-abus : au-delà de 3 demandes en 24h pour le même email.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("partners")
      .select("id", { count: "exact", head: true })
      .eq("email", payload.email)
      .gte("created_at", since);

    if ((recentCount || 0) >= 3) {
      throw new Error("Trop de demandes envoyées récemment avec cet email. Réessayez plus tard.");
    }

    const { data: partner, error } = await supabase
      .from("partners")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    const adminEmail = (Deno.env.get("ADMIN_EMAIL") ?? "admin@monarch-apps.com").trim();

    const adminEmailResult = await sendEmail({
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
    });

    const partnerEmailResult = await sendEmail({
      to: payload.email,
      subject: "Votre demande partenaire MONARCH SUPERCARS",
      html: `
        <h2>Merci pour votre demande, ${payload.contact_name || payload.company_name} !</h2>
        <p>Votre demande de partenariat pour <strong>${payload.company_name}</strong> a bien été reçue.</p>
        <p>Notre équipe va l'étudier et reviendra vers vous après validation par l'administrateur.</p>
      `,
    });

    return Response.json(
      {
        ok: true,
        id: partner.id,
        message: "Demande partenaire envoyée avec succès.",
        email_relay: { admin: adminEmailResult, partner: partnerEmailResult },
      },
      { headers: cors }
    );
  } catch (error: any) {
    return Response.json(
      { error: error.message || "Erreur partner-request-intake" },
      { status: 400, headers: cors }
    );
  }
});
