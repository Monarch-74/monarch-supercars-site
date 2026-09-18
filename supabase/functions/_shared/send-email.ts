// deno-lint-ignore-file no-explicit-any
// MONARCH SUPERCARS - Envoi d'email transactionnel via le compte Gmail / Google Workspace
// de l'administrateur (admin@monarch-apps.com), authentifié avec un mot de passe
// d'application Google dédié (SMTP). Utilisé par contact-intake et
// partner-request-intake pour relayer les messages/demandes vers cette boîte.

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const user = (Deno.env.get("GMAIL_SMTP_USER") ?? "").trim();
  const password = (Deno.env.get("GMAIL_SMTP_PASSWORD") ?? "").trim();

  if (!user || !password) {
    console.log("GMAIL_SMTP_USER / GMAIL_SMTP_PASSWORD non configurés — email non envoyé.");
    return { ok: false, error: "Envoi d'email non configuré (secrets Gmail SMTP manquants)." };
  }

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: user, password: password },
    },
  });

  try {
    await client.send({
      from: `MONARCH SUPERCARS <${user}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      content: "auto",
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("GMAIL SMTP SEND ERROR:", message);
    return { ok: false, error: message };
  } finally {
    try {
      await client.close();
    } catch {
      // rien à faire si la fermeture échoue déjà
    }
  }
}
