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