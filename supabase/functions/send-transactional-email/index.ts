// Optionnel: brancher ici des confirmations paiement/modération supplémentaires.
// contact-intake, partner-request-intake et admin-update-status utilisent déjà
// _shared/send-email.ts (Gmail SMTP) pour leurs envois. Ce fichier reste un
// point d'extension volontairement minimal pour éviter d'exposer des envois
// automatiques non configurés.
export {};

Deno.serve(async () => Response.json({ ok: true, note: "Voir _shared/send-email.ts (Gmail SMTP) pour l'envoi d'emails." }));
