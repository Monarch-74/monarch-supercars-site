from pathlib import Path

text = '''# ✅ MONARCH V5 - Checklist Déploiement Rapide

## 📋 Résumé des Corrections

- ✅ `config.runtime.js` - Clés Stripe & Google Maps ajoutées
- ✅ `create-event-checkout` - Gestion des erreurs améliorée
- ✅ `create-partner-checkout` - Récupération du montant Stripe dynamique

---

## 🚀 ÉTAPE 1 : Configuration Supabase (5 min)

### 1.1 Créer le projet Supabase

1. Aller sur [supabase.com](https://supabase.com) et se connecter
2. Créer un nouveau projet (EU si possible pour RGPD)
3. **Note votre URL et clés** :
   - `SUPABASE_URL` (copier depuis Settings > API)
   - `SUPABASE_ANON_KEY` (service_role - public)
   - `SUPABASE_SERVICE_ROLE_KEY` (secret - ne jamais committer!)

### 1.2 Secrets Supabase (Edge Functions)

Aller dans **Settings > Secrets** et ajouter :

```text
SUPABASE_URL = votre_url
SUPABASE_SERVICE_ROLE_KEY = votre_service_role_key

STRIPE_SECRET_KEY = sk_live_XXX ou sk_test_XXX
STRIPE_WEBHOOK_SECRET = whsec_XXX
STRIPE_PARTNER_PRICE_ID = price_XXX
STRIPE_EVENT_PRICE_ID = price_XXX

OPENAI_API_KEY = sk-XXX
SERPAPI_KEY = XXX

GOOGLE_MAPS_API_KEY = AIzaSyXXX

RESEND_API_KEY = re_XXX
ADMIN_EMAIL = admin@votredomaine.com
```

### 1.3 Déployer le Schéma SQL

1. Aller dans **SQL Editor** dans Supabase
2. Copier le contenu de `supabase/sql/schema.sql`
3. Exécuter le script complet

### 1.4 Créer les Buckets Storage

Aller dans **Storage** et créer 3 buckets publics :

- `partner-logos`
- `event-posters`
- `roadbooks`

---

## 🔧 ÉTAPE 2 : Edge Functions (5 min)

### 2.1 Déployer les functions

```bash
# Depuis la racine du projet
supabase functions deploy admin-dashboard
supabase functions deploy admin-update-status
supabase functions deploy ai-events-search
supabase functions deploy ai-roadtrip-plan
supabase functions deploy contact-intake
supabase functions deploy create-event-checkout
supabase functions deploy create-partner-checkout
supabase functions deploy stripe-webhook
supabase functions deploy send-transactional-email
```

### 2.2 Vérifier les URLs

Chaque function doit être accessible à :

```text
https://xmzvgjkwsifunkmfkvin.functions.supabase.co/[FUNCTION_NAME]
```

---

## 💳 ÉTAPE 3 : Stripe (10 min)

### 3.1 Créer les Produits

1. Aller sur [dashboard.stripe.com/products](https://dashboard.stripe.com/products)
2. **Créer Produit "Partenaire Premium"**
   - Nom : "Partenaire Premium"
   - Prix : €25 (ou votre montant)
   - **Copier le `price_id`** → `STRIPE_PARTNER_PRICE_ID`

3. **Créer Produit "Soumission Événement"**
   - Nom : "Soumission Événement"
   - Prix : €5 (ou votre montant)
   - **Copier le `price_id`** → `STRIPE_EVENT_PRICE_ID`

### 3.2 Webhook Stripe

1. Aller dans **Developers > Webhooks**
2. Ajouter endpoint :

```text
https://xmzvgjkwsifunkmfkvin.functions.supabase.co/stripe-webhook
```

3. Events : `checkout.session.completed`
4. **Copier le Signing Secret** → `STRIPE_WEBHOOK_SECRET`

### 3.3 Clés API Stripe

1. Aller dans **Settings > API Keys**
2. **Copier Secret Key** → `STRIPE_SECRET_KEY`
3. **Copier Publishable Key** → mettre dans `frontend/config.runtime.js`

---

## 🗺️ ÉTAPE 4 : APIs Externes (10 min)

### 4.1 Google Cloud

1. Aller sur [cloud.google.com/console](https://cloud.google.com/console)
2. Créer un projet
3. Activer les APIs :
   - Google Maps Platform
   - Places API
   - Directions API
4. Créer deux clés API :
   - **Browser Key** → `GOOGLE_MAPS_BROWSER_KEY` (config.runtime.js)
   - **Server Key** → `GOOGLE_MAPS_API_KEY` (Supabase secrets)

### 4.2 OpenAI

1. Aller sur [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Créer une clé API
3. **Copier** → `OPENAI_API_KEY` (Supabase secrets)

### 4.3 SerpAPI (Recherche Google)

1. S'inscrire sur [serpapi.com](https://serpapi.com)
2. Copier la clé API
3. **Copier** → `SERPAPI_KEY` (Supabase secrets)

### 4.4 Resend (Emails)

1. S'inscrire sur [resend.com](https://resend.com)
2. Copier la clé API
3. **Copier** → `RESEND_API_KEY` (Supabase secrets)

---

## 🌐 ÉTAPE 5 : Frontend (5 min)

### 5.1 Mettre à jour la config

Éditer `frontend/config.runtime.js` :

```text
window.MONARCH_CONFIG = {
  SUPABASE_URL: "https://xmzvgjkwsifunkmfkvin.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
  EDGE_BASE_URL: "https://xmzvgjkwsifunkmfkvin.functions.supabase.co",
  STRIPE_PUBLISHABLE_KEY: "pk_live_XXXXX", // ← Mettre votre clé
  GOOGLE_MAPS_BROWSER_KEY: "AIzaSyXXXXXX", // ← Optionnel
  APP_ENV: "production"
};
```

### 5.2 Déployer sur GitHub Pages

```bash
git add .
git commit -m "Production deployment"
git push origin main
```

Aller dans **Settings > Pages** et activer GitHub Pages sur la branche `main`.

---

## ✅ ÉTAPE 6 : Tests Avant Publication

### 6.1 Tester les formulaires

- [ ] Formulaire de contact → Email reçu
- [ ] Soumission événement → Redirection Stripe
- [ ] Inscription partenaire → Redirection Stripe
- [ ] Admin dashboard → Données visibles

### 6.2 Tester les payments

- [ ] Paiement partenaire → Status "paid" en BD
- [ ] Paiement événement → Status "pending_review" en BD
- [ ] Event approuvé → Visible publiquement

### 6.3 Tester la recherche

- [ ] Recherche événements → Résultats
- [ ] Road trip IA → Itinéraire généré

---

## 📱 ÉTAPE 7 : Domaine Custom (5 min)

### 7.1 Domaine + DNS

1. Acheter un domaine (Godaddy, Namecheap, etc.)
2. Configurer le DNS :
   - `A` record → `185.199.108.153`
   - `A` record → `185.199.109.153`
   - `A` record → `185.199.110.153`
   - `A` record → `185.199.111.153`
3. Dans GitHub Pages Settings → Custom domain → `www.monarch-supercars.app`

### 7.2 Supabase Auth URLs

Aller dans **Authentication > Providers > Email** :

- Authorized redirect URLs : `[www.monarch-supercars.app](https://www.monarch-supercars.app)`

---

## 🔐 ÉTAPE 8 : Sécurité (5 min)

### 8.1 Row Level Security (RLS)

Vérifier dans Supabase SQL :

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

Tous les tableaux doivent avoir `rowsecurity = true`.

### 8.2 Secrets

- ✅ Jamais committer `SUPABASE_SERVICE_ROLE_KEY`
- ✅ Jamais committer `STRIPE_SECRET_KEY`
- ✅ Utiliser `.gitignore` pour les fichiers sensibles
- ✅ Utiliser les Secrets Supabase pour les Edge Functions

---

## 🚀 DÉPLOIEMENT FINAL

### Checklist Pre-Launch

- [ ] Tous les secrets Supabase configurés
- [ ] DB schema déployé
- [ ] Edge Functions déployées
- [ ] Stripe products créés et webhook actif
- [ ] config.runtime.js mis à jour
- [ ] Tests passés
- [ ] Domaine custom configuré
- [ ] Cookies policy OK
- [ ] Privacy policy OK
- [ ] CGU/CGV OK

### Commandes pour déployer

```bash
# 1. Vérifier le statut
supabase status

# 2. Déployer le schema (une fois)
supabase db push

# 3. Déployer les functions
supabase functions deploy --all

# 4. Pousser le frontend
git push origin main

# 5. Vérifier sur : https://www.monarch-supercars.app
```

---

## ❌ Problèmes Courants

### "Error: SUPABASE_SERVICE_ROLE_KEY not found"

→ Ajouter le secret dans Supabase Settings > Secrets

### "Erreur 401 depuis Edge Function"

→ Vérifier que l'authentification est correcte dans main.js
'''

Path('DEPLOYMENT_CHECKLIST.md').write_text(text, encoding='utf-8')
