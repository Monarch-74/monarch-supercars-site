# 🔑 Guide des clés à obtenir

## Temps estimé: 15 minutes pour obtenir toutes les clés

---

## 1️⃣ STRIPE (5 min)

**Site:** [stripe.com](https://stripe.com)

### Créer un compte Stripe

1. Aller sur [stripe.com](https://stripe.com)
2. Cliquer sur "Sign up"
3. Remplir les informations demandées
4. Vérifier l'email

### Obtenir les clés Stripe

1. Dashboard > Settings > API Keys
2. Copier :
   - `Secret Key` → `STRIPE_SECRET_KEY`
   - `Publishable Key` → `STRIPE_PUBLISHABLE_KEY`

### Créer 2 produits Stripe

1. Dashboard > Products
2. Produit 1: Partenaire Premium
   - Nom: "Partenaire Premium"
   - Type: One-time
   - Prix: €25 (ou autre montant)
   - Copier `Price ID` → `STRIPE_PARTNER_PRICE_ID`
3. Produit 2: Soumission Événement
   - Nom: "Soumission Événement"
   - Type: One-time
   - Prix: €5 (ou autre montant)
   - Copier `Price ID` → `STRIPE_EVENT_PRICE_ID`

### Configurer le webhook Stripe

1. Dashboard > Developers > Webhooks > Add endpoint
2. URL: `https://xmzvgjkwsifunkmfkvin.functions.supabase.co/stripe-webhook`
3. Events: `checkout.session.completed`
4. Copier Signing Secret → `STRIPE_WEBHOOK_SECRET`

---

## 2️⃣ GOOGLE CLOUD (5 min)

**Site:** [console.cloud.google.com](https://console.cloud.google.com)

### Créer un projet Google Cloud

1. Aller sur [console.cloud.google.com](https://console.cloud.google.com)
2. Cliquer sur "Create Project"
3. Nommer le projet "Monarch"
4. Créer le projet

### Activer les APIs Google Maps

1. Rechercher "Maps"
2. Activer :
   - Google Maps JavaScript API
   - Maps Embed API
   - Places API
   - Directions API

### Créer les clés API Google

1. APIs & Services > Credentials > Create Credentials > API Key
2. Créer une clé serveur (restrictions: Google Maps APIs)
   - Copier → `GOOGLE_MAPS_API_KEY`
3. Créer une clé navigateur (restrictions: Browser key)
   - Copier → `GOOGLE_MAPS_BROWSER_KEY`

---

## 3️⃣ OPENAI (3 min)

**Site:** [platform.openai.com](https://platform.openai.com)

### Créer un compte OpenAI

1. Aller sur [platform.openai.com](https://platform.openai.com)
2. S'inscrire
3. Vérifier l'email

### Obtenir la clé OpenAI

1. Aller dans Settings > API keys
2. Cliquer sur "Create new secret key"
3. Copier la clé
4. Utiliser cette valeur pour `OPENAI_API_KEY`

### Ajouter un crédit OpenAI

1. Billing > Add to balance
2. Ajouter au moins $5 pour les tests

---

## 4️⃣ RESEND (2 min)

**Site:** [resend.com](https://resend.com)

### Créer un compte Resend

1. Aller sur [resend.com](https://resend.com)
2. S'inscrire avec email ou GitHub
3. Valider l'email

### Obtenir la clé Resend

1. Aller dans API Keys
2. Cliquer sur "Create API key"
3. Copier la clé
4. Utiliser cette valeur pour `RESEND_API_KEY`

### Note Resend

- En mode test, les emails s'envoient vers `to@resend.dev`
- En production, utiliser la clé live

---

## 5️⃣ SERPAPI (Optionnel - 2 min)

**Site:** [serpapi.com](https://serpapi.com)

### Créer un compte SerpAPI

1. Aller sur [serpapi.com](https://serpapi.com)
2. S'inscrire
3. Valider l'email

### Obtenir la clé SerpAPI

1. Dashboard > API key
2. Copier la clé
3. Utiliser cette valeur pour `SERPAPI_KEY`

### Gratuité SerpAPI

- 100 requêtes/mois gratuites
- Pour plus, consulter [https://serpapi.com/pricing](https://serpapi.com/pricing)

---

## 📋 Checklist des clés à obtenir

```text
STRIPE:
[ ] STRIPE_SECRET_KEY = sk_...
[ ] STRIPE_PUBLISHABLE_KEY = pk_...
[ ] STRIPE_WEBHOOK_SECRET = whsec_...
[ ] STRIPE_PARTNER_PRICE_ID = price_...
[ ] STRIPE_EVENT_PRICE_ID = price_...

GOOGLE:
[ ] GOOGLE_MAPS_API_KEY = AIzaSy... (server)
[ ] GOOGLE_MAPS_BROWSER_KEY = AIzaSy... (browser)

OPENAI:
[ ] OPENAI_API_KEY = sk-proj-...

RESEND:
[ ] RESEND_API_KEY = re_...

OPTIONNEL:
[ ] SERPAPI_KEY = ...

SUPABASE (déjà ici):
[ ] SUPABASE_URL = https://...
[ ] SUPABASE_ANON_KEY = sb_publishable_...
[ ] SUPABASE_SERVICE_ROLE_KEY = eyJh...
```

---

## 🔐 Où les mettre

### Frontend (`frontend/config.runtime.js`)

```javascript
SUPABASE_URL           // Public
SUPABASE_ANON_KEY      // Public
STRIPE_PUBLISHABLE_KEY // Public
GOOGLE_MAPS_BROWSER_KEY // Public
```

### Backend (Supabase Secrets)

```text
SUPABASE_URL                    // Secret
SUPABASE_SERVICE_ROLE_KEY       // Secret
STRIPE_SECRET_KEY               // Secret
STRIPE_WEBHOOK_SECRET           // Secret
STRIPE_PARTNER_PRICE_ID         // Secret
STRIPE_EVENT_PRICE_ID           // Secret
OPENAI_API_KEY                  // Secret
GOOGLE_MAPS_API_KEY             // Secret
RESEND_API_KEY                  // Secret
```

---

## ⚠️ Important : clés test vs live

### Avant publication

- Stripe : utiliser `sk_test_...` et `pk_test_...`
- Google : utiliser une clé test ou restreindre la clé production
- OpenAI : compte test avec crédit pour essais

### Après publication

- Remplacer `sk_test_...` par `sk_live_...`
- Remplacer `pk_test_...` par `pk_live_...`

---

## 🚀 Ordre recommandé

1. Stripe (~5 min)
2. Google Cloud (~5 min)
3. OpenAI (~3 min)
4. Resend (~2 min)
5. SerpAPI (~2 min, optionnel)

Total : ~15 minutes

---

## ✅ Après avoir les clés

1. Ajouter les clés publiques dans `frontend/config.runtime.js`
2. Ajouter les clés secrètes dans Supabase Settings > Secrets
3. Déployer les Edge Functions : `supabase functions deploy --all`
4. Tester chaque fonction
5. Publier

---

C'est bon, on y va ! 🚀
