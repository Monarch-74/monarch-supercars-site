# 🔐 MONARCH V5 - Configuration Authentification Supabase

## 1.1 Fournisseurs d'authentification

Aller dans **Authentication > Providers**.

### Email (recommandé)

- ✅ Activer l'authentification par email
- Disable Signup: OFF
- Confirm email: OFF
- Secure email change: OFF

### Social (Optionnel)

- GitHub
- Google
- Discord

## 1.2 Redirect URLs

Aller dans **Authentication > URL Configuration**.

Ajouter les URLs:

- <https://www.monarch-supercars.app/>
- <https://www.monarch-supercars.app/admin.html>
- <https://www.monarch-supercars.app/roadtrip.html>
- <http://localhost:5000/>
- <http://localhost:8000/>

## 1.3 JWT Secret

Aller dans **Settings > API > JWT Settings**.

- JWT Expiration: 3600 secondes
- Token Expiration: 604800 secondes
- Ne pas modifier le JWT Secret

---

## 2. Tester l'authentification

### Test 1: Inscription

```bash
curl -X POST https://xmzvgjkwsifunkmfkvin.supabase.co/auth/v1/signup \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'
```

### Test 2: Connexion

```bash
curl -X POST "https://xmzvgjkwsifunkmfkvin.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'
```

### Test 3: Frontend

1. Aller sur <https://www.monarch-supercars.app/register.html>
2. Créer un compte
3. Vérifier la redirection vers le dashboard

---

## 3. Vérifier les utilisateurs

```sql
SELECT id, email, created_at FROM auth.users;
SELECT id, full_name, role FROM public.profiles;
SELECT id, user_id, expires_at FROM auth.sessions;
```

---

## 4. Rôles et permissions

### Rôles

- `user`: client
- `partner`: partenaire
- `admin`: modération

### Assigner un rôle

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');
```

---

## 5. Sécurité

- ✅ Utiliser `SUPABASE_ANON_KEY` pour le frontend
- ✅ Utiliser `SUPABASE_SERVICE_ROLE_KEY` uniquement dans les functions
- ✅ Ne pas exposer les secrets dans Git
