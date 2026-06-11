# MONARCH SUPERCARS — V5 production-ready starter

Architecture:
- `frontend/` : site statique prêt pour GitHub Pages
- `supabase/` : SQL + Edge Functions
- `docs/` : déploiement, sécurité, juridique, runbook

## Stack
- GitHub Pages
- Supabase (Auth, Postgres, Storage, Edge Functions)
- Stripe
- OpenAI
- Google Maps / Places / Directions
- Resend (emails transactionnels)

## Ce que couvre cette V5
- inscription / connexion
- partenaires payants via Stripe
- soumission d'événements payants ou manuels
- backoffice admin
- road trip IA
- roadbook imprimable
- upload logos / affiches via Supabase Storage
- consentement cookies
- analytics métier
- pipeline compatible prod pour Facebook / Instagram / TikTok:
  - **pas de scraping fragile**
  - usage d'APIs officielles quand disponibles
  - sinon soumission manuelle / semi-assistée avec validation admin

## Ce qu'il faut encore faire avant publication
1. Renseigner les vraies clés dans :
   - `frontend/config.runtime.js`
   - secrets Supabase Edge Functions
2. Créer les buckets Storage :
   - `partner-logos`
   - `event-posters`
   - `roadbooks`
3. Déployer le SQL de `supabase/sql/schema.sql`
4. Déployer les Edge Functions
5. Configurer Stripe:
   - produits/prices partenaires
   - produit/price soumission événement
   - webhook
6. Configurer Google Cloud:
   - Places API
   - Routes/Directions selon ton plan
   - JavaScript Maps si tu veux une carte intégrée
7. Finaliser juridiquement les textes:
   - mentions légales
   - politique de confidentialité
   - CGU/CGV
   - cookies / CMP
8. Activer les emails transactionnels (Resend ou autre)
9. Vérifier les domaines et redirect URLs Auth Supabase

## Variables à fournir
Voir:
- `frontend/config.runtime.example.js`
- `supabase/functions/_shared/env.example.ts`

## Déploiement rapide
- Front : GitHub Pages
- Backend : Supabase project
- Emails : Resend
- Paiement : Stripe

Détails complets dans `docs/deployment-guide.md`.
