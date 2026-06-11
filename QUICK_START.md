# 🚀 MONARCH V5 - QUICK START (5 étapes pour publication)

## ⏱️ Temps Estimé: 30 minutes

---

## 1️⃣ COPIER LES CLÉS SUPABASE (5 min)

### Pour `frontend/config.runtime.js` (Déjà fait ✅)

```javascript
window.MONARCH_CONFIG = {
  SUPABASE_URL: "https://xmzvgjkwsifunkmfkvin.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
  EDGE_BASE_URL: "https://xmzvgjkwsifunkmfkvin.functions.supabase.co",
  STRIPE_PUBLISHABLE_KEY: "pk_live_...", // ← Votre clé Stripe
  GOOGLE_MAPS_BROWSER_KEY: "AIzaSy...", // ← Optionnel
  APP_ENV: "production"
};
```

---

## 2️⃣ AJOUTER LES SECRETS SUPABASE (10 min)

Aller dans: **Supabase Dashboard > Settings > Secrets**

```text
✅ SUPABASE_URL = https://xmzvgjkwsifunkmfkvin.supabase.co
✅ SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIs...

❌ À OBTENIR:
- STRIPE_SECRET_KEY (stripe.com/docs)
- STRIPE_WEBHOOK_SECRET (webhook signing secret)
- STRIPE_PARTNER_PRICE_ID (produit Stripe)
- STRIPE_EVENT_PRICE_ID (produit Stripe)
- OPENAI_API_KEY (platform.openai.com)
- GOOGLE_MAPS_API_KEY (cloud.google.com)
- RESEND_API_KEY (resend.com)
- ADMIN_EMAIL (votre email admin)
```

**Après chaque secret ajouté:**

```bash
supabase functions deploy [nom-function]
```

---

## 3️⃣ DÉPLOYER LA BASE DE DONNÉES (5 min)

### Option A: Via UI Supabase (Recommandé)

1. Aller dans **SQL Editor**
2. Copier-coller `supabase/sql/schema.sql`
3. Cliquer "Execute"
4. Attendre ✅

### Option B: Via CLI

```bash
supabase db push
```

### Créer les Buckets Storage

1. **Storage > New Bucket**
2. Créer 3 buckets publics:
   - `partner-logos`
   - `event-posters`
   - `roadbooks`

---

## 4️⃣ DÉPLOYER LES EDGE FUNCTIONS (5 min)

```bash
# À la racine du projet:
cd supabase
supabase functions deploy --all

# Ou individuellement:
supabase functions deploy admin-dashboard
supabase functions deploy contact-intake
supabase functions deploy create-event-checkout
supabase functions deploy create-partner-checkout
supabase functions deploy stripe-webhook
supabase functions deploy ai-events-search
supabase functions deploy ai-roadtrip-plan
supabase functions deploy admin-update-status
supabase functions deploy send-transactional-email
```

Vérifier: [Supabase Functions](https://app.supabase.com) > Functions > Voir chaque function ✅

---

## 5️⃣ PUBLIER SUR GITHUB PAGES (Automatique)

```bash
git add .
git commit -m "Production deployment - all fixes applied"
git push origin main

# Vérifier:
# 1. GitHub Actions > Deployments
# 2. Attendre le ✅
# 3. Aller sur: https://www.monarch-supercars.app
```

---

## 📋 CHECKLIST PRE-LAUNCH

### Configuration

- [ ] `config.runtime.js` mis à jour avec vraies clés
- [ ] Tous les secrets Supabase configurés
- [ ] Base de données déployée
- [ ] Buckets Storage créés
- [ ] Edge Functions déployées

### Externe

- [ ] Stripe: 2 produits créés + webhook ajouté
- [ ] Google Cloud: APIs activées + clés créées
- [ ] OpenAI: Account créé + clé API générée
- [ ] Resend: Account créé + clé API générée

### Test

- [ ] Inscription fonctionne
- [ ] Connexion fonctionne
- [ ] Formulaire contact → email reçu
- [ ] Paiement partenaire → URL Stripe reçue
- [ ] Paiement événement → URL Stripe reçue
- [ ] Admin dashboard → données visibles
- [ ] Recherche événements → résultats

### Avant Go Live

- [ ] Domain custom configuré
- [ ] HTTPS activé
- [ ] Mentions légales complétées
- [ ] Politique confidentialité complétée
- [ ] CGU/CGV complétées

---

## 🆘 SI ERREUR = Consulter `TROUBLESHOOTING.md`

```text
Problèmes courants:
1. "SUPABASE_SERVICE_ROLE_KEY not found" → voir TROUBLESHOOTING.md
2. "Erreur 401 depuis Edge Function" → vérifier headers dans main.js
3. "Événements non visibles" → vérifier RLS policies
4. "Paiement échoue" → vérifier STRIPE_PRICE_ID
5. "Email non reçu" → vérifier RESEND_API_KEY
```

**Voir:** `TROUBLESHOOTING.md` pour solution complète

---

## 📊 STRUCTURE DES FICHIERS CRÉÉS

```text
Fichiers de configuration:
✅ frontend/config.runtime.js - Clés publiques

Fichiers d'aide:
📄 DEPLOYMENT_CHECKLIST.md - Guide étape par étape (complet)
📄 AUTH_SETUP.md - Configuration authentification Supabase
📄 TROUBLESHOOTING.md - Résolution des erreurs courantes
📄 QUICK_START.md - CE FICHIER

Fichiers modifiés:
✅ supabase/functions/_shared/env.example.ts - Secrets expliqués
✅ supabase/functions/create-event-checkout/index.ts - Gestion erreurs
✅ supabase/functions/create-partner-checkout/index.ts - Amount dynamique
```

---

## 🎯 LES CORRECTIONS APPLIQUÉES

### 1. Config Runtime

- ✅ Ajout STRIPE_PUBLISHABLE_KEY
- ✅ Ajout GOOGLE_MAPS_BROWSER_KEY
- ✅ Vérification URLs

### 2. Edge Functions

- ✅ Meilleure gestion d'erreurs
- ✅ Vérification des secrets avant utilisation
- ✅ Logs améliorés
- ✅ Montants Stripe dynamiques

### 3. Documentation

- ✅ Guide déploiement complet
- ✅ Guide authentification
- ✅ Guide dépannage
- ✅ Checklist de publication

---

## 🔒 SÉCURITÉ

✅ **Fait:**

- Pas de clés secrètes dans le frontend
- SUPABASE_ANON_KEY publique (c'est normal)
- SERVICE_ROLE_KEY seulement dans Edge Functions
- CORS configuré correctement

❌ **À FAIRE:**

- [ ] Mettre les secrets dans `.env` (local only)
- [ ] Ajouter `.env` à `.gitignore`
- [ ] Vérifier HTTPS en production
- [ ] Configurer RLS policies (déjà dans schema.sql)

---

## ⚡ TEMPS RESTANT POUR DÉPLOYER

- Configuration Supabase: **10 min**
- Déployer DB + Functions: **10 min**
- Tests: **5 min**
- GitHub Push: **2 min**
- **TOTAL: ~30 minutes max** ⏱️

---

## 📞 BESOIN D'AIDE?

1. **Erreur technique** → Voir `TROUBLESHOOTING.md`
2. **Config Supabase** → Voir `DEPLOYMENT_CHECKLIST.md`
3. **Authentification** → Voir `AUTH_SETUP.md`
4. **Contacts externes:**
   - Supabase: [https://supabase.com/support](https://supabase.com/support)
   - Stripe: [https://stripe.com/support](https://stripe.com/support)
   - GitHub Pages: [https://docs.github.com/en/pages](https://docs.github.com/en/pages)

---

**🎉 Vous êtes prêt à la publication! Bon courage!** 🚀
