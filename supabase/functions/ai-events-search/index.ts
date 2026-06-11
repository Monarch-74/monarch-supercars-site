// deno-lint-ignore-file no-explicit-any
// MONARCH SUPERCARS - Supabase Edge Function
// Chemin : supabase/functions/ai-events-search/index.ts

export {};

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const SERPAPIKEY = (Deno.env.get("SERPAPI_KEY") ?? "").trim();
const OPENAIAPIKEY = (Deno.env.get("OPENAI_API_KEY") ?? "").trim();

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

type EventCard = {
  title: string;
  summary?: string;
  venue_name?: string;
  event_date?: string | null;
  poster_url?: string | null;
  source_url?: string | null;
};

function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders,
  });
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

// Construit un lien de recherche Google fonctionnel à partir des informations
// disponibles sur un événement. Sert de secours quand aucune URL source fiable
// n'a été trouvée, pour que "Voir la source" mène toujours vers une page utile.
function buildSearchUrl(parts: Array<string | null | undefined>): string {
  const query = parts
    .map((part) => (part || "").toString().trim())
    .filter(Boolean)
    .join(" ");

  return `https://www.google.com/search?q=${encodeURIComponent(query || "événement automobile")}`;
}

function isValidHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function parseEventDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  const cleaned = String(dateStr).toLowerCase().trim();

  const moisFr: Record<string, number> = {
    janvier: 0,
    février: 1,
    fevrier: 1,
    mars: 2,
    avril: 3,
    mai: 4,
    juin: 5,
    juillet: 6,
    août: 7,
    aout: 7,
    septembre: 8,
    octobre: 9,
    novembre: 10,
    décembre: 11,
    decembre: 11,
  };

  const matchFr = cleaned.match(
    /(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/i,
  );

  if (matchFr) {
    const jour = Number.parseInt(matchFr[1], 10);
    const mois = moisFr[matchFr[2].toLowerCase()];
    const annee = Number.parseInt(matchFr[3], 10);

    if (Number.isFinite(jour) && mois !== undefined && Number.isFinite(annee)) {
      return new Date(annee, mois, jour);
    }
  }

  const matchSlash = cleaned.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (matchSlash) {
    const jour = Number.parseInt(matchSlash[1], 10);
    const mois = Number.parseInt(matchSlash[2], 10) - 1;
    const annee = Number.parseInt(matchSlash[3], 10);
    return new Date(annee, mois, jour);
  }

  const matchIso = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (matchIso) {
    return new Date(matchIso[0]);
  }

  return null;
}

function isFutureOrToday(eventDate: Date | null): boolean {
  if (!eventDate) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dateToCompare = new Date(eventDate);
  dateToCompare.setHours(0, 0, 0, 0);

  return dateToCompare >= today;
}

async function googleSearch(query: string): Promise<any[]> {
  if (!SERPAPIKEY) return [];

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "fr");
  url.searchParams.set("gl", "fr");
  url.searchParams.set("apikey", SERPAPIKEY);

  try {
    const res = await fetch(url.toString());
    console.log("GOOGLE STATUS:", res.status, query);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("GOOGLE ERROR:", res.status, errorText);
      return [];
    }

    const data = await res.json();
    return Array.isArray(data.organic_results) ? data.organic_results : [];
  } catch (error) {
    console.error("GOOGLE SEARCH EXCEPTION:", error);
    return [];
  }
}

async function googleImages(query: string): Promise<any[]> {
  if (!SERPAPIKEY) return [];

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_images");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "fr");
  url.searchParams.set("gl", "fr");
  url.searchParams.set("apikey", SERPAPIKEY);

  try {
    const res = await fetch(url.toString());
    console.log("IMAGES STATUS:", res.status, query);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("IMAGES ERROR:", res.status, errorText);
      return [];
    }

    const data = await res.json();
    return Array.isArray(data.images_results) ? data.images_results : [];
  } catch (error) {
    console.error("GOOGLE IMAGES EXCEPTION:", error);
    return [];
  }
}

async function analyzeImage(imageUrl: string): Promise<any | null> {
  if (!OPENAIAPIKEY || !imageUrl) return null;

  const today = getTodayDate();

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAIAPIKEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Aujourd'hui nous sommes le ${today}.
Lis cette affiche d'événement automobile.
Retourne uniquement un JSON valide :
{
  "title": "",
  "date": null,
  "lieu": "",
  "description": "",
  "isfuture": true
}
Si tu ne peux pas déterminer la date, mets "date": null et "isfuture": true.`,
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      console.log("OPENAI STATUS:", res.status, await res.text());
      return null;
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content ?? "{}";
    const clean = String(text)
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(clean);
  } catch (error) {
    console.log("OPENAI ERROR:", error);
    return null;
  }
}

async function generateFallbackEvents(location: string, year: number): Promise<EventCard[]> {
  if (!OPENAIAPIKEY) return [];

  const prompt = `Tu es un expert en événements automobiles en Europe. Pour la région suivante : ${location}, année ${year}, propose jusqu'à 6 événements automobiles à venir ou récents. Retourne uniquement un JSON valide sous la forme d'une liste d'objets avec ces champs : title, summary, venue_name, event_date (format JJ/MM/AAAA ou AAAA-MM-JJ), source_url. Si tu n'as pas la date exacte, indique "À confirmer". Ne donne pas de texte supplémentaire.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAIAPIKEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Tu es un assistant expert en événements automobiles." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      console.log("OPENAI FALLBACK STATUS:", res.status, await res.text());
      return [];
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content ?? "[]";
    const clean = String(text).replace(/```json/g, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed)) return [];

    // L'IA ne peut pas garantir l'existence réelle d'une URL qu'elle invente :
    // on construit donc toujours un lien de recherche Google fiable pour ces
    // événements générés (le lien "Voir la source" doit fonctionner à coup sûr).
    return parsed.map((item: any) => ({
      title: item.title || "Événement automobile",
      summary: item.summary || "Description non disponible.",
      venue_name: item.venue_name || "Lieu à confirmer",
      event_date: item.event_date || null,
      poster_url: null,
      source_url: buildSearchUrl([item.title, item.venue_name, location]),
    }));
  } catch (error) {
    console.log("FALLBACK ERROR:", error);
    return [];
  }
}

// Liste élargie de mots-clés / hashtags pour la recherche d'événements automobiles
// (rassemblements, cars & coffee, supercars, track days, clubs de marque, réseaux sociaux...)
const ALL_QUERY_TEMPLATES: string[] = [
  // Général (FR)
  "rassemblement automobile {loc} {year}",
  "rencontre automobile {loc} {year}",
  "meeting auto {loc} {year}",
  "sortie automobile {loc} {year}",
  "balade automobile {loc} {year}",
  "club automobile {loc} {year}",
  "expo automobile {loc} {year}",
  "salon automobile {loc} {year}",
  "concours d'élégance {loc} {year}",
  "exposition voitures de collection {loc} {year}",
  "festival automobile {loc} {year}",
  // Compétitions / sport automobile
  "rallye automobile {loc} {year}",
  "rallye régional {loc} {year}",
  "rallye national {loc} {year}",
  "rallye historique {loc} {year}",
  "championnat de France des rallyes {loc} {year}",
  "course de côte {loc} {year}",
  "autocross {loc} {year}",
  "slalom automobile {loc} {year}",
  "gymkhana automobile {loc} {year}",
  "endurance automobile {loc} {year}",
  "journée circuit {loc} {year}",
  "roulage circuit {loc} {year}",
  "karting compétition {loc} {year}",
  // Général (EN)
  "cars and coffee {loc} {year}",
  "supercar meeting {loc} {year}",
  "supercar event {loc} {year}",
  "hypercar meeting {loc} {year}",
  "track day {loc} {year}",
  "trackday {loc} {year}",
  "classic cars meeting {loc} {year}",
  "classic car show {loc} {year}",
  "car show {loc} {year}",
  "car meet {loc} {year}",
  "vintage car rally {loc} {year}",
  "exotic car gathering {loc} {year}",
  "luxury car event {loc} {year}",
  "wonderland {loc} {year}",
  // Clubs de marque
  "Ferrari Club {loc} {year}",
  "Porsche Club {loc} {year}",
  "Lamborghini Club {loc} {year}",
  "Bugatti Club {loc} {year}",
  "McLaren Club {loc} {year}",
  "Aston Martin Club {loc} {year}",
  "Mercedes AMG Club {loc} {year}",
  "BMW M Club {loc} {year}",
  "Audi Sport Club {loc} {year}",
  // Hashtags
  "#CarsAndCoffee {loc} {year}",
  "#Supercars {loc} {year}",
  "#SupercarSunday {loc} {year}",
  "#CarMeet {loc} {year}",
  "#CarShow {loc} {year}",
  "#Trackday {loc} {year}",
  "#ClassicCars {loc} {year}",
  "#Hypercars {loc} {year}",
  "#RassemblementAuto {loc} {year}",
  "#ExoticCars {loc} {year}",
  // Réseaux sociaux ciblés
  "site:facebook.com événement rassemblement automobile {loc} {year}",
  "site:facebook.com cars and coffee {loc} {year}",
  "site:facebook.com supercar meeting {loc} {year}",
  "site:facebook.com/events automobile {loc} {year}",
  "site:instagram.com rassemblement automobile {loc} {year}",
  "site:instagram.com cars and coffee {loc} {year}",
  "site:instagram.com #supercars {loc} {year}",
  "site:instagram.com #carmeet {loc} {year}",
];

// Événements/marques nommés explicitement (toujours interrogés, indépendamment
// de la rotation quotidienne) pour ne pas manquer ces rendez-vous récurrents.
const NAMED_EVENT_TEMPLATES: string[] = [
  "Carburacoeur {loc} {year}",
  "Le Rallye du Coeur {loc} {year}",
  "Autoxperience {loc} {year}",
  "Cars & Smile {loc} {year}",
  "Vintage Mécanic {loc} {year}",
  "Auto Rétro {loc} {year}",
  "exposition de véhicules anciens {loc} {year}",
  "amicale des véhicules anciens {loc} {year}",
  "Grand Prix automobile {loc} {year}",
  "drift event {loc} {year}",
  "baptême de piste {loc} {year}",
  "vieilles mécaniques {loc} {year}",
  "rasso auto {loc} {year}",
];

// Mots-clés priorisés pour la recherche d'affiches/images (Google Images)
const IMAGE_QUERY_TEMPLATES: string[] = [
  "rassemblement automobile {loc} {year}",
  "cars and coffee {loc} {year}",
  "supercar meeting {loc} {year}",
  "track day {loc} {year}",
  "classic cars meeting {loc} {year}",
  "Ferrari Club {loc} {year}",
  "#CarsAndCoffee {loc} {year}",
  "#Cars&Coffee {loc} {year}",
  "#Supercars {loc} {year}",
  "rallye automobile {loc} {year}",
  "course de côte {loc} {year}",
];

// Sélectionne `count` modèles dans `templates` à partir d'un offset, avec retour au début (rotation).
function rotateSelect(templates: string[], count: number, offset: number): string[] {
  const n = templates.length;
  const result: string[] = [];

  for (let i = 0; i < count && i < n; i++) {
    result.push(templates[(offset + i) % n]);
  }

  return result;
}

// Exécute `fn` sur chaque élément de `items` avec un maximum de `limit` appels en parallèle.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const current = next++;
      results[current] = await fn(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return createJsonResponse({ error: "Méthode non autorisée. Utilise POST." }, 405);
  }

  try {
    if (!SERPAPIKEY) {
      console.error("ERREUR: SERPAPI_KEY non configurée");
      return createJsonResponse({ error: "SERPAPI_KEY manquante. Configurez-la dans Supabase." }, 500);
    }

    if (!OPENAIAPIKEY) {
      console.error("ERREUR: OPENAI_API_KEY non configurée");
      return createJsonResponse({ error: "OPENAI_API_KEY manquante. Configurez-la dans Supabase." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const country = String(body.country || "France");
    const department = String(body.department || "");
    const today = getTodayDate();

    console.log("BODY:", body);
    console.log("TODAY:", today);
    console.log("SERPAPI OK:", Boolean(SERPAPIKEY));
    console.log("OPENAI OK:", Boolean(OPENAIAPIKEY));

    const currentYear = new Date().getFullYear();
    const baseLocation = `${department} ${country}`.trim();

    // Rotation quotidienne pour balayer progressivement toute la liste de mots-clés
    // sans dépasser le nombre d'appels API par recherche.
    const dayIndex = Math.floor(Date.now() / 86400000);

    const PRIORITY_TEMPLATES = [
      "rassemblement automobile {loc} {year}",
      "cars and coffee {loc} {year}",
      "supercar meeting {loc} {year}",
      "rallye automobile {loc} {year}",
    ];

    const rotatedTemplates = rotateSelect(ALL_QUERY_TEMPLATES, 4, dayIndex);
    const webTemplates = Array.from(new Set([...PRIORITY_TEMPLATES, ...NAMED_EVENT_TEMPLATES, ...rotatedTemplates]));
    const imageTemplates = rotateSelect(IMAGE_QUERY_TEMPLATES, 3, dayIndex);

    const fillTemplate = (tpl: string) =>
      tpl.replace("{loc}", baseLocation).replace("{year}", String(currentYear));

    const webQueries = webTemplates.map(fillTemplate);
    const imageQueries = imageTemplates.map((tpl) => `affiche ${fillTemplate(tpl)}`);

    console.log(`SEARCHING ${webQueries.length} WEB QUERIES + ${imageQueries.length} IMAGE QUERIES`);

    const [webResultsArrays, imageResultsArrays] = await Promise.all([
      mapWithConcurrency(webQueries, 5, (q) => googleSearch(q)),
      mapWithConcurrency(imageQueries, 3, (q) => googleImages(q)),
    ]);

    const webResults = webResultsArrays.flat();
    const imageResults = imageResultsArrays.flat();

    const events: EventCard[] = [];

    const analyzedImages = await mapWithConcurrency(imageResults.slice(0, 8), 3, async (img: any) => {
      const imageUrl = img.original || img.thumbnail || "";
      const analyzed = await analyzeImage(imageUrl);
      return { img, imageUrl, analyzed };
    });

    for (const { img, imageUrl, analyzed } of analyzedImages) {
      if (analyzed?.isfuture === false) {
        console.log("SKIPPED IMAGE PAST:", analyzed?.title);
        continue;
      }

      const parsedDate = parseEventDate(analyzed?.date);
      if (parsedDate && !isFutureOrToday(parsedDate)) {
        console.log("SKIPPED IMAGE PARSED PAST:", analyzed?.title, analyzed?.date);
        continue;
      }

      const imageTitle = analyzed?.title || img.title || "Événement automobile";
      const imageVenue = analyzed?.lieu || img.source || null;

      events.push({
        title: imageTitle,
        summary: analyzed?.description || img.title || "Affiche trouvée via Google Images.",
        venue_name: imageVenue || "Source web",
        event_date: analyzed?.date || null,
        poster_url: imageUrl || null,
        source_url: isValidHttpUrl(img.link)
          ? img.link
          : isValidHttpUrl(imageUrl)
          ? imageUrl
          : buildSearchUrl([imageTitle, imageVenue, baseLocation]),
      });
    }

    for (const r of webResults.slice(0, 50)) {
      const parsedDate = parseEventDate(r.snippet);

      if (parsedDate && !isFutureOrToday(parsedDate)) {
        console.log("SKIPPED WEB PAST:", r.title);
        continue;
      }

      const webTitle = r.title || "Événement automobile";

      events.push({
        title: webTitle,
        summary: r.snippet || "",
        venue_name: r.source || "Source web",
        event_date: parsedDate ? parsedDate.toLocaleDateString("fr-FR") : null,
        poster_url: r.thumbnail || null,
        source_url: isValidHttpUrl(r.link) ? r.link : buildSearchUrl([webTitle, r.source, baseLocation]),
      });
    }

    const uniqueEvents = events.filter((event, index, array) => {
      const key = `${event.title}|${event.source_url}`;
      return array.findIndex((item) => `${item.title}|${item.source_url}` === key) === index;
    });

    // Filtre de pertinence géographique : si un département/région est sélectionné,
    // on ne garde que les événements dont le titre/résumé/lieu/source mentionnent
    // ce département (ex: "33 - Gironde" -> "Gironde"). Si rien ne correspond, le
    // fallback IA ci-dessous prendra le relais avec des suggestions ciblées sur
    // cette zone précise.
    const departmentLabel = department.includes(" - ")
      ? department.split(" - ").slice(1).join(" - ").trim()
      : department.trim();

    let relevantEvents = uniqueEvents;

    if (departmentLabel) {
      const needle = departmentLabel.toLowerCase();
      const matched = uniqueEvents.filter((event) => {
        const haystack = `${event.title} ${event.summary || ""} ${event.venue_name || ""} ${event.source_url || ""}`.toLowerCase();
        return haystack.includes(needle);
      });

      if (matched.length > 0) {
        relevantEvents = matched;
      } else {
        relevantEvents = [];
      }
    }

    relevantEvents.sort((a, b) => {
      const dateA = parseEventDate(a.event_date);
      const dateB = parseEventDate(b.event_date);

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return dateA.getTime() - dateB.getTime();
    });

    if (relevantEvents.length === 0) {
      const fallbackEvents = await generateFallbackEvents(baseLocation, currentYear);
      if (fallbackEvents.length > 0) {
        console.log(`RETURNING ${fallbackEvents.length} FALLBACK EVENTS`);
        return createJsonResponse({
          events: fallbackEvents,
          note: uniqueEvents.length > 0
            ? "Les résultats trouvés ne correspondaient pas à la zone sélectionnée : suggestions générées par IA pour cette zone."
            : "Les résultats sont générés par IA car l'API de recherche réelle n'a pas renvoyé de données.",
        });
      }
    }

    console.log(`RETURNING ${relevantEvents.length} EVENTS`);

    return createJsonResponse({ events: relevantEvents });
  } catch (error) {
    console.error("AI EVENTS ERROR:", error);
    console.error("Stack:", error instanceof Error ? error.stack : "No stack");

    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Message:", errorMsg);

    return createJsonResponse(
      { error: `Erreur: ${errorMsg}` },
      500,
    );
  }
});