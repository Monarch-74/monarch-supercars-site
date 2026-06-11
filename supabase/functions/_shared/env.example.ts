// 🔐 Secrets à configurer dans Supabase Settings > Secrets
// ÉTAPES:
// 1. Aller dans https://app.supabase.com > Votre Project > Settings > Secrets
// 2. Ajouter chaque clé ci-dessous
// 3. Déployer les Edge Functions après chaque ajout

// ========== SUPABASE ==========
// SUPABASE_URL
// URL de votre projet Supabase
// Trouvé dans: Settings > API > Project Settings > API URL
// Exemple: https://xmzvgjkwsifunkmfkvin.supabase.co

// SUPABASE_SERVICE_ROLE_KEY
// Clé secrète pour accès total (NE PAS COMMITER!)
// Trouvé dans: Settings > API > Project Settings > Service Role Secret
// Exemple: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// ========== STRIPE ==========
// STRIPE_SECRET_KEY
// Trouvé dans: https://dashboard.stripe.com/apikeys
// Commençant par: sk_live_ ou sk_test_
// ⚠️ NE PAS PARTAGER - TEST KEY D'ABORD!

// STRIPE_WEBHOOK_SECRET
// Trouvé dans: https://dashboard.stripe.com/webhooks
// Ajouter endpoint: https://VOTRE_PROJECT.functions.supabase.co/stripe-webhook
// Commençant par: whsec_

// STRIPE_PARTNER_PRICE_ID
// Créer dans: https://dashboard.stripe.com/products
// Produit: "Partenaire Premium" - Prix: €25
// Trouvé dans le produit: price_1234567890...

// STRIPE_EVENT_PRICE_ID
// Créer dans: https://dashboard.stripe.com/products
// Produit: "Soumission Événement" - Prix: €5
// Trouvé dans le produit: price_0987654321...

// ========== OPENAI ==========
// OPENAI_API_KEY
// Trouvé dans: https://platform.openai.com/api-keys
// Créer nouvelle clé > Copier
// Commençant par: sk-proj-

// ========== GOOGLE ==========
// GOOGLE_MAPS_API_KEY
// Trouvé dans: https://cloud.google.com/console > APIs & Services > Credentials
// Créer API Key > Copier
// Restreindre à: Maps, Places, Directions APIs

// ========== SERPAPI (OPTIONNEL) ==========
// SERPAPI_KEY
// Trouvé dans: https://serpapi.com/dashboard
// Pour recherche Google personnalisée (ai-events-search)

// ========== EMAILS ==========
// RESEND_API_KEY
// Trouvé dans: https://resend.com/api-keys
// Commençant par: re_

// ADMIN_EMAIL
// Adresse email pour recevoir les messages de contact
// Exemple: admin@monarch-supercars.app

// ========== CONFIGURATION ==========
// APP_BASE_URL (OPTIONNEL)
// URL complète de votre application
// Exemple: https://www.monarch-supercars.app
// Utilisée pour les liens dans les emails

// EMAIL_FROM (OPTIONNEL)
// Adresse d'envoi des emails
// Exemple: noreply@monarch-supercars.app

