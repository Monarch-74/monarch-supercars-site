-- Suivi de l'abonnement Stripe du partenaire (paiement annuel récurrent, et non
-- plus un paiement unique) : nécessaire pour que le webhook puisse désactiver
-- automatiquement un partenaire dont l'abonnement est annulé ou expiré.
alter table public.partners
  add column if not exists stripe_subscription_id text;
