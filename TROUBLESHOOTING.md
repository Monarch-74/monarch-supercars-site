# 🔧 MONARCH V5 - Guide de Dépannage

## 🚨 Erreurs Courantes et Solutions

---

### ❌ "SUPABASE_SERVICE_ROLE_KEY not found"

**Symptôme:** Les Edge Functions retournent une erreur d'authentification.

**Cause:** Le secret n'est pas configuré dans Supabase.

**Solution:**

```bash
1. Aller dans Supabase Dashboard > Settings > Secrets
2. Ajouter:
   - Nom: SUPABASE_SERVICE_ROLE_KEY
   - Valeur: (copier de Settings > API > Service Role Secret)
3. Déployer les functions:
   supabase functions deploy --all
```

---

### ❌ "STRIPE_SECRET_KEY non configuré"

**Symptôme:** Les paiements échouent avec une erreur `500`.

**Cause:** Les clés Stripe manquent dans les secrets Supabase.

**Solution:**

```bash
1. Aller sur <https://dashboard.stripe.com/apikeys>
2. Copier "Secret key" (sk_live_... ou sk_test_...)
3. Ajouter dans Supabase Secrets:
   - STRIPE_SECRET_KEY: sk_live_XXX
   - STRIPE_WEBHOOK_SECRET: whsec_XXX
4. Déployer functions:
   supabase functions deploy create-event-checkout create-partner-checkout
```

---

### ❌ "Erreur 401 depuis callEdge"

**Symptôme:** Les requêtes du frontend vers les Edge Functions échouent.

**Cause:** Mauvaise authentification ou CORS.

**Solution:**

```javascript
// Vérifier dans main.js que callEdge envoie les bons headers:
{
  "Content-Type": "application/json",
  "Authorization": "Bearer " + cfg.SUPABASE_ANON_KEY,
  "apikey": cfg.SUPABASE_ANON_KEY,
}
```

Vérifier `frontend/config.runtime.js`:

- `SUPABASE_URL`: `<https://xmzvgjkwsifunkmfkvin.supabase.co>`
- `SUPABASE_ANON_KEY`: `sb_publishable_...`
- `EDGE_BASE_URL`: `<https://xmzvgjkwsifunkmfkvin.functions.supabase.co>`

---

### ❌ "Événements non visibles publiquement"

**Symptôme:** Les événements approuvés n'apparaissent pas sur le site.

**Cause:** Row Level Security (RLS) empêche l'accès.

**Solution:**

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'events';

create policy "events_public_read_approved" on public.events
for select using (status = 'approved');
```

---

### ❌ "Message de contact non reçu"

**Symptôme:** Le formulaire de contact ne génère pas d'email.

**Cause:** `RESEND_API_KEY` manquante ou invalide.

**Solution:**

```bash
1. Aller sur <https://resend.com/api-keys>
2. Copier la clé API (re_...)
3. Ajouter dans Supabase Secrets:
   - RESEND_API_KEY: re_XXX
   - ADMIN_EMAIL: admin@votredomaine.com
4. Tester via le formulaire de contact
```

---

### ❌ "Stripe payment fails - Invalid Price"

**Symptôme:** La création du checkout Stripe échoue.

**Cause:** Le `STRIPE_*_PRICE_ID` est incorrect ou n'existe pas.

**Solution:**

```bash
1. Aller sur <https://dashboard.stripe.com/products>
2. Créer deux produits:
   - "Partenaire Premium" - Prix: €25
   - "Soumission Événement" - Prix: €5
3. Copier les price_id
4. Ajouter les IDs dans Supabase Secrets:
   - STRIPE_PARTNER_PRICE_ID: price_XXX
   - STRIPE_EVENT_PRICE_ID: price_YYY
5. Redéployer:
   supabase functions deploy create-event-checkout create-partner-checkout
```

---

### ❌ "OPENAI_API_KEY not found"

**Symptôme:** La génération d'itinéraire IA échoue.

**Cause:** La clé OpenAI n'est pas configurée.

**Solution:**

```bash
1. Aller sur <https://platform.openai.com/api-keys>
2. Créer une clé API
3. Ajouter `OPENAI_API_KEY` dans Supabase Secrets
4. Redéployer:
   supabase functions deploy ai-roadtrip-plan
```

---

### ❌ "GOOGLE_MAPS_API_KEY missing"

**Symptôme:** Les recherches d'événements retournent 0 résultats.

**Cause:** La clé Google Maps est manquante ou désactivée.

**Solution:**

```bash
1. Aller sur <https://cloud.google.com/console>
2. Créer un projet
3. Activer les APIs:
   - Maps Embed API
   - Places API
   - Maps JavaScript API
4. Créer deux API Keys
5. Ajouter `GOOGLE_MAPS_API_KEY` dans Supabase Secrets
```

---

### ❌ "Empty response from Supabase Edge Function"

**Symptôme:** La function retourne une réponse vide.

**Cause:** Erreur d'exécution non capturée.

**Solution:**

```bash
1. Aller dans Supabase > Functions > [FUNCTION_NAME]
2. Consulter les logs
3. Corriger l'erreur et redéployer
```

---

### ❌ "Network error when calling Edge Function"

**Symptôme:** Les functions sont inaccessibles.

**Cause:** CORS, domaine invalide ou EDGE_BASE_URL incorrect.

**Solution:**

```bash
curl -X POST https://xmzvgjkwsifunkmfkvin.functions.supabase.co/contact-intake \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

## 📞 Ressources

- [Supabase Docs](https://supabase.com/docs)
- [Stripe Docs](https://stripe.com/docs)
- [Deno Docs](https://docs.deno.com)
- [OpenAI API](https://platform.openai.com/docs)
- [Google Cloud](https://cloud.google.com/docs)

---

**Last updated:** June 2026
**Status:** Production Ready ✅
