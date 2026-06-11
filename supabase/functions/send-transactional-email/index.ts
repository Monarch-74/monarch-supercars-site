// Optionnel: brancher Resend ici pour confirmations paiement, modération, contact.
// Exemple laissé volontairement minimal pour éviter d’exposer des envois automatiques non configurés.
export {};

Deno.serve(async () => Response.json({ ok: true, note: "À brancher avec RESEND_API_KEY et EMAIL_FROM." }));
