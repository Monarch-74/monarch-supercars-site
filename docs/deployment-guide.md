# Guide de déploiement V5

## 1. Supabase

- créer un projet
- exécuter `supabase/sql/schema.sql`
- créer les buckets Storage:
  - `partner-logos`
  - `event-posters`
  - `roadbooks`
- ajouter les secrets Edge Functions:
  - voir `supabase/functions/_shared/env.example.ts`

## 2. Stripe

Créer:

- 1 price pour le partenaire
- 1 price pour la soumission événement 5€

Configurer le webhook vers:

`https://YOUR_PROJECT.functions.supabase.co/stripe-webhook`

Événements à écouter:

- `checkout.session.completed`

## 3. OpenAI

Ajouter `OPENAI_API_KEY` dans les secrets Supabase.

Le modèle peut être changé dans `ai-roadtrip-plan/index.ts`.

## 4. Google Maps / Places

Activer au minimum:

- Places API
- éventuellement Directions / Routes API selon ton usage

## 5. GitHub Pages

Déployer le dossier `frontend/`.

Mettre à jour `frontend/config.runtime.js`.

## 6. Auth

Dans Supabase > Authentication > URL Configuration:

- Site URL = domaine GitHub Pages
- Redirect URLs = pages de connexion/retour si besoin

## 7. Légal

Les pages du dossier `frontend/legal/` sont des gabarits.

Faire valider avant publication.

## 8. Production checklist

- [ ] vrais secrets
- [ ] buckets créés
- [ ] Stripe prices créés
- [ ] webhook validé
- [ ] domaine relié
- [ ] textes juridiques validés
- [ ] politique cookies/CMP active
- [ ] tests paiement
- [ ] tests upload médias
- [ ] tests admin/modération
