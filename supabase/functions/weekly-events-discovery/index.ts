// deno-lint-ignore-file no-explicit-any
// MONARCH SUPERCARS - Supabase Edge Function
// Chemin : supabase/functions/weekly-events-discovery/index.ts
//
// Tâche planifiée (pg_cron, 1x/semaine) : parcourt les zones (pays/département)
// où au moins une personne est abonnée aux alertes email (table event_alerts),
// réutilise la fonction ai-events-search existante pour chaque zone, et insère
// les événements réellement trouvés (jamais les suggestions générées par IA en
// mode secours de ai-events-search, reconnaissables à la présence de `note` dans
// sa réponse) en base avec status='pending_review' : un admin doit les valider
// avant qu'ils n'apparaissent sur le site. Rien n'est publié automatiquement.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (_req: Request): Promise<Response> => {
  try {
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
    const anonKey = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();

    if (!supabaseUrl || !serviceKey || !anonKey) {
      throw new Error("Secrets Supabase manquants (URL / SERVICE_ROLE_KEY / ANON_KEY)");
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const edgeBaseUrl = supabaseUrl.replace(".supabase.co", ".functions.supabase.co");

    // 1) Zones à scanner : pays/département distincts des abonnés aux alertes.
    const { data: alerts, error: alertsError } = await supabase
      .from("event_alerts")
      .select("country, department");

    if (alertsError) throw alertsError;

    const seenZones = new Set<string>();
    const targets = (alerts ?? []).filter((a: any) => {
      const key = `${a.country}|${a.department}`;
      if (seenZones.has(key)) return false;
      seenZones.add(key);
      return true;
    });

    let scanned = 0;
    let inserted = 0;
    let skippedFallback = 0;

    for (const target of targets) {
      scanned++;

      const res = await fetch(`${edgeBaseUrl}/ai-events-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anonKey}`,
          "apikey": anonKey,
        },
        body: JSON.stringify({ country: target.country, department: target.department }),
      });

      if (!res.ok) continue;

      const json = await res.json().catch(() => null);
      if (!json) continue;

      // ai-events-search ajoute `note` uniquement quand elle retombe sur des
      // suggestions générées par IA (aucun résultat web réel trouvé) : on ignore
      // ces cas pour l'automatisation, on ne publie jamais d'événements inventés.
      if (json.note) {
        skippedFallback++;
        continue;
      }

      const found = Array.isArray(json.events) ? json.events : [];

      for (const ev of found) {
        if (!ev.title) continue;

        const { data: existing } = await supabase
          .from("events")
          .select("id")
          .ilike("title", ev.title)
          .eq("department", target.department)
          .limit(1);

        if (existing && existing.length) continue;

        const { error: insertError } = await supabase.from("events").insert({
          title: ev.title,
          country: target.country,
          department: target.department,
          venue_name: ev.venue_name || null,
          event_date: parseFrenchDate(ev.event_date),
          poster_url: ev.poster_url || null,
          description: ev.summary || null,
          external_url: ev.source_url || null,
          source_type: "semi_assisted",
          external_source: "weekly-events-discovery",
          status: "pending_review",
        });

        if (!insertError) inserted++;
      }
    }

    return Response.json({ ok: true, zones_scanned: scanned, inserted, skipped_ai_fallback: skippedFallback });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
});

// ai-events-search renvoie event_date au format "DD/MM/YYYY" (toLocaleDateString("fr-FR"))
// ou null. On le convertit en "YYYY-MM-DD" pour la colonne `date` de la table events.
function parseFrenchDate(value: unknown): string | null {
  if (!value) return null;
  const match = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}
