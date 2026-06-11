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
      name: body.name || "",
      email: body.email || "",
      subject: body.subject || "",
      message: body.message || "",
    };

    const { error } = await supabase
      .from("contact_messages")
      .insert(payload);

    if (error) throw error;

    const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
    const adminEmail = (Deno.env.get("ADMIN_EMAIL") ?? "admin@monarch-apps.com").trim();
console.log("RESEND OK:", Boolean(resendKey));
console.log("ADMIN EMAIL:", adminEmail);
    if (resendKey) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "MONARCH SUPERCARS <onboarding@resend.dev>",
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
        }),
      });

      if (!emailResponse.ok) {
        const emailError = await emailResponse.text();
        console.log("RESEND ERROR:", emailError);
      }
    }

    return Response.json(
      { ok: true, message: "Message envoyé !" },
      { headers: cors }
    );

  } catch (error: any) {
    return Response.json(
      { error: error.message || "Erreur contact-intake" },
      { status: 400, headers: cors }
    );
  }
});