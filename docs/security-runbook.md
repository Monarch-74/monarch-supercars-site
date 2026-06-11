# Runbook sécurité

## Mesures incluses
- secrets côté serveur
- service role réservé aux Edge Functions
- front statique sans clé secrète
- RLS activé sur les tables principales
- webhook Stripe séparé

## À renforcer avant go-live
- vérifier toutes les policies RLS
- protéger les endpoints admin par JWT + rôle admin
- ajouter rate limiting
- journaliser les refus et anomalies
- mettre un WAF/CDN si besoin
- ajouter monitoring et alerting

## Incident response
1. désactiver immédiatement les clés compromises
2. régénérer les secrets
3. auditer `audit_logs`
4. vérifier paiements Stripe
5. geler les fonctions sensibles si nécessaire
