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
      return Response.json({ ok: true, message: "Message envoyé !" }, { headers: cors });
    }

    // Un humain met toujours plus de 2 secondes à remplir le formulaire ;
    // un remplissage quasi instantané trahit un robot.
    const elapsedMs = Number(body.elapsed_ms || 0);
    if (elapsedMs > 0 && elapsedMs < 2000) {
      return Response.json({ ok: true, message: "Message envoyé !" }, { headers: cors });
    }

    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const supabaseServiceRole = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
    if (!supabaseUrl || !supabaseServiceRole) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY non configurés");

    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    const payload = {
      name: body.name || "",
      email: body.email || "",
      subject: body.subject || "",
      message: body.message || "",
    };

    // Filtre anti-spam : les messages légitimes n'ont normalement pas besoin
    // de lien externe ; le spam reçu sur ce formulaire en contient toujours un.
    if (/https?:\/\//i.test(payload.message)) {
      return Response.json(
        { error: "Merci de ne pas inclure de lien dans votre message. Décrivez votre demande, nous reviendrons vers vous." },
        { status: 400, headers: cors }
      );
    }

    // Limite anti-abus : au-delà de 3 messages en 24h pour le même email, on
    // bloque (évite qu'un même expéditeur sature la boîte admin).
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("email", payload.email)
      .gte("created_at", since);

    if ((recentCount || 0) >= 3) {
      return Response.json(
        { error: "Trop de messages envoyés récemment avec cet email. Réessayez plus tard." },
        { status: 429, headers: cors }
      );
    }

    const { error } = await supabase
      .from("contact_messages")
      .insert(payload);

    if (error) throw error;

    const adminEmail = (Deno.env.get("ADMIN_EMAIL") ?? "admin@monarch-apps.com").trim();

    const emailResult = await sendEmail({
      to: adminEmail,
      subject: "Nouveau message MONARCH SUPERCARS",
      html: `
        <h2>Nouveau message depuis MONARCH SUPERCARS</h2>
        <p><strong>Nom :</strong> ${payload.name}</p>
        <p><strong>Email :</strong> ${payload.email}</p>
        <p><strong>Sujet :</strong> ${payload.subject}</p>
        <p><strong>Message :</strong></p>
        <p>${String(payload.message).replace(/\n/g, "<br>")}</p>
      `,
    });

    return Response.json(
      { ok: true, message: "Message envoyé !", email_relay: emailResult },
      { headers: cors }
    );

  } catch (error: any) {
    return Response.json(
      { error: error.message || "Erreur contact-intake" },
      { status: 400, headers: cors }
    );
  }
});