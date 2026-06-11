# Corrections appliquées

J'ai corrigé les blocages principaux qui empêchaient de continuer proprement :

1. Suppression de l'appel OpenAI direct côté navigateur
   - Suppression de `askAI()` dans `frontend/js/main.js`.
   - Suppression du bloc HTML qui appelait `askAI()` dans `frontend/index.html`.
   - Raison : une clé OpenAI ne doit jamais être utilisée dans le front. Il faut passer par `supabase/functions/ai-roadtrip-plan`.

2. Sécurisation de la configuration runtime
   - `main.js` ignore maintenant les valeurs `REPLACE_ME`.
   - Avant, `REPLACE_ME` était considéré comme une vraie valeur et pouvait créer des erreurs Supabase.
   - `callEdge()` affiche maintenant une erreur claire si `EDGE_BASE_URL` n'est pas configuré.

3. Correction de `frontend/roadtrip.html`
   - La fin du fichier était cassée : les balises `<script>` étaient insérées dans un `onclick` de bouton.
   - Les scripts sont maintenant chargés correctement.
   - L'audio utilise le fichier local `assets/audio/...`.

4. Correction de l'audio sur l'accueil
   - L'accueil utilise maintenant l'audio local au lieu d'une URL GitHub Pages codée en dur.

## Étape suivante obligatoire

Renseigner `frontend/config.runtime.js` avec tes vraies valeurs :

```js
window.MONARCH_CONFIG = {
  SUPABASE_URL: "https://TON-PROJET.supabase.co",
  SUPABASE_ANON_KEY: "TA_CLE_ANON_SUPABASE",
  EDGE_BASE_URL: "https://TON-PROJET.functions.supabase.co",
  GOOGLE_MAPS_BROWSER_KEY: "",
  STRIPE_PUBLISHABLE_KEY: "",
  APP_ENV: "production"
};
```

Puis déployer les Edge Functions Supabase et ajouter les secrets côté Supabase, jamais dans le front.
