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
    // Formes complètes
    janvier: 0, février: 1, fevrier: 1,
    mars: 2, avril: 3, mai: 4, juin: 5,
    juillet: 6, août: 7, aout: 7,
    septembre: 8, octobre: 9, novembre: 10,
    décembre: 11, decembre: 11,
    // Abréviations courantes (presse, réseaux sociaux, Google snippets)
    "janv": 0, "jan": 0,
    "févr": 1, "fév": 1, "fevr": 1, "fev": 1,
    // mars → pas abrégé
    "avr": 3,
    // mai, juin → pas abrégés
    "juil": 6, "jul": 6,
    "aoû": 7, "aou": 7,
    "sept": 8, "sep": 8,
    "oct": 9,
    "nov": 10,
    "déc": 11, "dec": 11,
  };

  // Normalise la chaîne : supprime les points d'abréviation pour que
  // "déc." → "déc", "janv." → "janv", etc.
  const cleanedRaw = String(dateStr).toLowerCase().trim();
  const cleaned = cleanedRaw.replace(/\b([a-zéèêëàâùûôîïœæç]+)\./g, "$1");

  // Regex mois FR complets + abréviations (sans le point, déjà supprimé ci-dessus)
  const MOIS_FR_RE = [
    "janvier","janv","jan",
    "f[ée]vrier","f[ée]vr","f[ée]v","fevrier","fevr","fev",
    "mars","avr(?:il)?",
    "mai","juin",
    "juil(?:let)?","jul",
    "ao[uû]t","ao[uû]","aout","aou",
    "septembre","sept","sep",
    "octobre","oct",
    "novembre","nov",
    "d[ée]cembre","d[ée]c","decembre","dec",
  ].join("|");

  const matchFr = cleaned.match(
    new RegExp(`(\\d{1,2})\\s+(${MOIS_FR_RE})\\s+(\\d{4})`, "i"),
  );

  if (matchFr) {
    const jour = Number.parseInt(matchFr[1], 10);
    const mois = moisFr[matchFr[2].toLowerCase().replace(/[éè]/g,"e").replace(/[û]/g,"u").replace(/[ô]/g,"o")];
    const annee = Number.parseInt(matchFr[3], 10);

    if (Number.isFinite(jour) && mois !== undefined && Number.isFinite(annee)) {
      return new Date(annee, mois, jour);
    }
  }

  // Format numérique : DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (Suisse/Allemagne/Italie)
  const matchSlash = cleaned.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (matchSlash) {
    const jour = Number.parseInt(matchSlash[1], 10);
    const mois = Number.parseInt(matchSlash[2], 10) - 1;
    const annee = Number.parseInt(matchSlash[3], 10);
    if (jour >= 1 && jour <= 31 && mois >= 0 && mois < 12 && annee >= 2020) {
      return new Date(annee, mois, jour);
    }
  }

  const matchIso = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (matchIso) {
    return new Date(matchIso[0]);
  }

  // ── Mois en allemand (Suisse alémanique, Allemagne) ──
  const moisDe: Record<string, number> = {
    januar: 0, jan: 0,
    februar: 1, feb: 1,
    "märz": 2, marz: 2, mrz: 2,
    april: 3, apr: 3,
    mai: 4,
    juni: 5, jun: 5,
    juli: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    oktober: 9, okt: 9,
    november: 10, nov: 10,
    dezember: 11, dez: 11,
  };
  const MOIS_DE_RE = "januar|jan|februar|feb|m[äa]rz|mrz|april|apr|mai|juni?|juli?|august|aug|september|sept?|oktober|okt|november|nov|dezember|dez";
  // "13. Dezember 2025" / "13. Dez. 2025"
  const matchDe = cleaned.match(
    new RegExp(`(\\d{1,2})\\.?\\s+(${MOIS_DE_RE})\\.?\\s+(\\d{4})`, "i"),
  );
  if (matchDe) {
    const jour = Number.parseInt(matchDe[1], 10);
    const key = matchDe[2].toLowerCase().replace(/ä/g, "a");
    const mois = moisDe[key];
    const annee = Number.parseInt(matchDe[3], 10);
    if (Number.isFinite(jour) && mois !== undefined && Number.isFinite(annee)) {
      return new Date(annee, mois, jour);
    }
  }
  // "Dezember 2025" / "Dez. 2025" (mois + année sans jour)
  const matchDeMonthYear = cleaned.match(
    new RegExp(`\\b(${MOIS_DE_RE})\\.?\\s+(\\d{4})\\b`, "i"),
  );
  if (matchDeMonthYear) {
    const key = matchDeMonthYear[1].toLowerCase().replace(/ä/g, "a");
    const mois = moisDe[key];
    const annee = Number.parseInt(matchDeMonthYear[2], 10);
    if (mois !== undefined && Number.isFinite(annee)) return new Date(annee, mois, 1);
  }

  // ── Mois en italien (Tessin, Val d'Aoste, Italie) ──
  const moisIt: Record<string, number> = {
    gennaio: 0, gen: 0,
    febbraio: 1, feb: 1,
    marzo: 2, mar: 2,
    aprile: 3, apr: 3,
    maggio: 4, mag: 4,
    giugno: 5, giu: 5,
    luglio: 6, lug: 6,
    agosto: 7, ago: 7,
    settembre: 8, set: 8,
    ottobre: 9, ott: 9,
    novembre: 10, nov: 10,
    dicembre: 11, dic: 11,
  };
  const MOIS_IT_RE = "gennaio|gen|febbraio|feb|marzo|mar|aprile|apr|maggio|mag|giugno|giu|luglio|lug|agosto|ago|settembre|set|ottobre|ott|novembre|nov|dicembre|dic";
  const matchIt = cleaned.match(
    new RegExp(`(\\d{1,2})\\s+(${MOIS_IT_RE})\\.?\\s+(\\d{4})`, "i"),
  );
  if (matchIt) {
    const jour = Number.parseInt(matchIt[1], 10);
    const mois = moisIt[matchIt[2].toLowerCase()];
    const annee = Number.parseInt(matchIt[3], 10);
    if (Number.isFinite(jour) && mois !== undefined && Number.isFinite(annee)) {
      return new Date(annee, mois, jour);
    }
  }
  const matchItMonthYear = cleaned.match(
    new RegExp(`\\b(${MOIS_IT_RE})\\.?\\s+(\\d{4})\\b`, "i"),
  );
  if (matchItMonthYear) {
    const mois = moisIt[matchItMonthYear[1].toLowerCase()];
    const annee = Number.parseInt(matchItMonthYear[2], 10);
    if (mois !== undefined && Number.isFinite(annee)) return new Date(annee, mois, 1);
  }

  // Format anglais avec jour : "April 19, 2026" / "19 April 2026"
  const moisEn: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };
  const matchEnMdy = cleaned.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})[,\s]+(\d{4})\b/i,
  );
  if (matchEnMdy) {
    const mois = moisEn[matchEnMdy[1].toLowerCase()];
    const jour = Number.parseInt(matchEnMdy[2], 10);
    const annee = Number.parseInt(matchEnMdy[3], 10);
    if (mois !== undefined && Number.isFinite(jour) && Number.isFinite(annee)) {
      return new Date(annee, mois, jour);
    }
  }
  const matchEnDmy = cleaned.match(
    /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i,
  );
  if (matchEnDmy) {
    const jour = Number.parseInt(matchEnDmy[1], 10);
    const mois = moisEn[matchEnDmy[2].toLowerCase()];
    const annee = Number.parseInt(matchEnDmy[3], 10);
    if (mois !== undefined && Number.isFinite(jour) && Number.isFinite(annee)) {
      return new Date(annee, mois, jour);
    }
  }

  // Jour + mois sans année : "20 juin", "samedi 20 juin", "le 20 juin prochain"
  // → on utilise l'année courante ; si la date est dans le passé, elle sera filtrée.
  const matchDayMonthFr = cleaned.match(
    new RegExp(`\\b(\\d{1,2})\\s+(${MOIS_FR_RE})\\b(?!\\s+\\d{4})`, "i"),
  );
  if (matchDayMonthFr) {
    const jour = Number.parseInt(matchDayMonthFr[1], 10);
    const mois = moisFr[matchDayMonthFr[2].toLowerCase().replace(/[éè]/g,"e").replace(/[û]/g,"u").replace(/[ô]/g,"o")];
    if (Number.isFinite(jour) && mois !== undefined) {
      const currentYear = new Date().getFullYear();
      return new Date(currentYear, mois, jour);
    }
  }
  const MOIS_EN_RE = "january|february|march|april|may|june|july|august|september|october|november|december";
  const matchDayMonthEn = cleaned.match(
    new RegExp(`\\b(\\d{1,2})\\s+(${MOIS_EN_RE})\\b(?!\\s+\\d{4})`, "i"),
  );
  if (matchDayMonthEn) {
    const moisEnMap: Record<string,number> = {
      january:0,february:1,march:2,april:3,may:4,june:5,
      july:6,august:7,september:8,october:9,november:10,december:11,
    };
    const mois = moisEnMap[matchDayMonthEn[2].toLowerCase()];
    const jour = Number.parseInt(matchDayMonthEn[1], 10);
    if (mois !== undefined && Number.isFinite(jour)) {
      return new Date(new Date().getFullYear(), mois, jour);
    }
  }
  const matchMonthDayEn = cleaned.match(
    new RegExp(`\\b(${MOIS_EN_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?![,\\s]*\\d{4})`, "i"),
  );
  if (matchMonthDayEn) {
    const moisEnMap2: Record<string,number> = {
      january:0,february:1,march:2,april:3,may:4,june:5,
      july:6,august:7,september:8,october:9,november:10,december:11,
    };
    const mois = moisEnMap2[matchMonthDayEn[1].toLowerCase()];
    const jour = Number.parseInt(matchMonthDayEn[2], 10);
    if (mois !== undefined && Number.isFinite(jour)) {
      return new Date(new Date().getFullYear(), mois, jour);
    }
  }

  // Format mois + année sans jour : "Mars 2026", "déc. 2025", "mars-avril 2026"
  // On prend le 1er jour du mois — suffit pour déterminer si c'est passé ou futur.
  // Note : MOIS_FR_RE inclut désormais toutes les abréviations (déc, janv, févr…)
  const moisEnKeys = "january|february|march|april|may|june|july|august|september|october|november|december";

  const matchFrMonthYear = cleaned.match(
    new RegExp(`\\b(${MOIS_FR_RE})(?:\\s*[-/]\\s*(?:${MOIS_FR_RE}))?\\s+(\\d{4})\\b`, "i"),
  );
  if (matchFrMonthYear) {
    const mois = moisFr[matchFrMonthYear[1].toLowerCase().replace(/[éè]/g,"e").replace(/[û]/g,"u").replace(/[ô]/g,"o")];
    const annee = Number.parseInt(matchFrMonthYear[2], 10);
    if (mois !== undefined && Number.isFinite(annee)) {
      return new Date(annee, mois, 1);
    }
  }

  const matchEnMonthYear = cleaned.match(
    new RegExp(`\\b(${moisEnKeys})(?:\\s*[-/]\\s*(?:${moisEnKeys}))?\\s+(\\d{4})\\b`, "i"),
  );
  if (matchEnMonthYear) {
    const mois = moisEn[matchEnMonthYear[1].toLowerCase()];
    const annee = Number.parseInt(matchEnMonthYear[2], 10);
    if (mois !== undefined && Number.isFinite(annee)) {
      return new Date(annee, mois, 1);
    }
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

  const prompt = `Tu es un expert en événements automobiles en Europe. Pour la région suivante : ${location}, propose jusqu'à 8 événements automobiles À VENIR (à partir du ${new Date().toISOString().slice(0,10)}) pour les années ${year} et ${year + 1}. Types d'événements : rassemblements, cars & coffee, rasso, expositions de véhicules, véhicules américains, F1, run automobile, drive, DreamCars Day, Motors Addict, Oldtimer Treffen (si région germanophone), raduno auto (si région italophone), concours d'élégance, drift, stock-car, etc. NE PROPOSE PAS d'événements passés. Retourne uniquement un JSON valide sous la forme d'une liste d'objets : { title, summary, venue_name, event_date (format JJ/MM/AAAA ou AAAA-MM-JJ — doit être >= ${new Date().toISOString().slice(0,10)}), source_url }. Si tu n'as pas la date exacte, indique null. Ne donne pas de texte supplémentaire.`;

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
  // ── Mots-clés multilingues (Suisse, Belgique, Italie, Allemagne) ──
  // Allemand — avec exclusion Elektroauto
  "Automobilveranstaltung {loc} {year} -Elektroauto",
  "Oldtimer Treffen {loc} {year}",
  "Auto Meeting {loc} {year} -elektrisch",
  "Sportwagen Treffen {loc} {year}",
  "Fahrzeugtreffen {loc} {year}",
  "Oldtimertreffen {loc} {year}",
  "Motorrad Treffen {loc} {year}",
  "US Car Treffen {loc} {year}",
  "Youngtimer Treffen {loc} {year}",
  "Rallye Automobil {loc} {year} -elektrisch",
  "Concours d'Élégance {loc} {year}",
  "bevorstehende Automobilevents {loc} {year}",
  "#OldtimerTreffen {loc} {year}",
  "#AutoTreffen {loc} {year}",
  "#ClassicCars {loc} {year}",
  "site:facebook.com Oldtimer Treffen {loc} {year}",
  "site:facebook.com Auto Meeting {loc} {year}",
  "site:instagram.com #oldtimertreffen {loc}",
  // Italien — avec exclusion elettrico
  "raduno auto {loc} {year} -elettrico",
  "manifestazione auto {loc} {year}",
  "raduno sportive {loc} {year}",
  "raduno storiche {loc} {year}",
  "eventi auto {loc} {year} -elettrico",
  "incontro auto {loc} {year}",
  "Concorso d'Eleganza {loc} {year}",
  "#raduniauto {loc} {year}",
  "#eventoauto {loc} {year}",
  "site:facebook.com raduno auto {loc} {year}",
  // Belge / néerlandais — avec exclusion elektrisch
  "autoshow {loc} {year} -elektrisch",
  "oldtimer rally {loc} {year}",
  "autorallyé {loc} {year}",
  "voiture classique {loc} {year}",
  "site:facebook.com oldtimer rally {loc}",
  // Général (FR)
  "rassemblement automobile {loc} {year}",
  "rencontre automobile {loc} {year}",
  "meeting automobile {loc} {year}",
  "meeting auto {loc} {year}",
  "sortie automobile {loc} {year}",
  "balade automobile {loc} {year}",
  "club automobile {loc} {year}",
  "expo automobile {loc} {year}",
  "salon automobile {loc} {year}",
  "concours d'élégance {loc} {year}",
  "Concours d'Élégance {loc} {year}",
  "Concorso d'Eleganza {loc} {year}",
  "concours elegance automobile {loc} {year}",
  "Concours of Elegance {loc} {year}",
  "exposition voitures de collection {loc} {year}",
  "exposition de véhicules {loc} {year}",
  "festival automobile {loc} {year}",
  "rasso automobile {loc} {year}",
  "rasso auto {loc} {year}",
  "grand événement automobile {loc} {year}",
  "grands événements automobiles {loc} {year}",
  "run automobile {loc} {year}",
  "drive automobile {loc} {year}",
  "drive event {loc} {year}",
  "véhicules américains {loc} {year}",
  "american cars {loc} {year}",
  "rassemblement véhicules de collection {loc} {year}",
  "rassemblement de véhicules de collection {loc} {year}",
  // Compétitions / sport automobile
  "rallye automobile {loc} {year}",
  "rallye automobile régional {loc} {year}",
  "rallye automobile national {loc} {year}",
  "rallye automobile historique {loc} {year}",
  "championnat de France des rallyes automobile {loc} {year}",
  "course de côte automobile {loc} {year}",
  "course automobile {loc} {year}",
  "course de voitures {loc} {year}",
  "autocross automobile {loc} {year}",
  "slalom automobile {loc} {year}",
  "gymkhana automobile {loc} {year}",
  "endurance automobile {loc} {year}",
  "journée circuit automobile {loc} {year}",
  "roulage circuit automobile {loc} {year}",
  "karting automobile {loc} {year}",
  "Formule 1 {loc} {year}",
  "F1 {loc} {year}",
  "grand prix F1 {loc} {year}",
  // Motor Show / Auto Show
  "Motor Show {loc} {year}",
  "Motorshow {loc} {year}",
  "Auto Show {loc} {year}",
  "Autoshow {loc} {year}",
  "Salon de l'Auto {loc} {year}",
  "Salon de Genève {year}",
  "Geneva Motor Show {year}",
  "Mondial de l'Auto {year}",
  "Autosalon {loc} {year}",
  "#MotorShow {loc} {year}",
  "#AutoShow {loc} {year}",
  "#SalonAuto {loc} {year}",
  "site:facebook.com Motor Show {loc}",
  "site:instagram.com #motorshow {loc}",
  // Général (EN)
  "cars and coffee {loc} {year}",
  "Cars & Coffee {loc} {year}",
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
  "vintage upcoming events {loc} {year}",
  "exotic car gathering {loc} {year}",
  "luxury car event {loc} {year}",
  "wonderland {loc} {year}",
  "Wonderland cars {loc} {year}",
  // Clubs de marque
  "Ferrari Club {loc} {year}",
  "Ferrari événement {loc} {year}",
  "Porsche Club {loc} {year}",
  "Porsche événement {loc} {year}",
  "Lamborghini Club {loc} {year}",
  "Lamborghini événement {loc} {year}",
  "Bugatti Club {loc} {year}",
  "McLaren Club {loc} {year}",
  "Aston Martin Club {loc} {year}",
  "Aston Martin événement {loc} {year}",
  "Mercedes AMG Club {loc} {year}",
  "BMW M Club {loc} {year}",
  "Audi Sport Club {loc} {year}",
  "Mustang Club {loc} {year}",
  "Mustang événement {loc} {year}",
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
  "#VehiculesAmericains {loc} {year}",
  "#AmericanMuscle {loc} {year}",
  "#Rasso {loc} {year}",
  "#RunAuto {loc} {year}",
  "#BaladeAutomobile {loc} {year}",
  "#BaladeAuto {loc} {year}",
  "#BaladeSportive {loc} {year}",
  "#BaladePrestige {loc} {year}",
  "#DriveEvent {loc} {year}",
  "#F1 {loc} {year}",
  // Supercars / hypercars / prestige — noms d'events courants sur les réseaux
  "Motor Sportive Day {loc} {year}",
  "Motor Tour {loc} {year}",
  "Motor Tour automobile {loc} {year}",
  "Supercar Sunday {loc} {year}",
  "Supercar Saturday {loc} {year}",
  "Hypercar Hunt {loc} {year}",
  "Hypercar Day {loc} {year}",
  "GT Drive {loc} {year}",
  "GT Meeting {loc} {year}",
  "GT Event {loc} {year}",
  "Open GT {loc} {year}",
  "Prestige Drive {loc} {year}",
  "Elite Drive {loc} {year}",
  "Elite Meet {loc} {year}",
  "Exotic Drive {loc} {year}",
  "Sportive & Prestige {loc} {year}",
  "Sportive et Prestige {loc} {year}",
  "Balade Prestige {loc} {year}",
  "Balade Sportive {loc} {year}",
  "Défilé Prestige {loc} {year}",
  "Parade Supercars {loc} {year}",
  "Supercars of France {loc} {year}",
  "Supercars United {loc} {year}",
  "Voitures de Sport {loc} {year}",
  "Voitures Sportives {loc} {year}",
  "Voitures de Prestige {loc} {year}",
  "Supercar Experience {loc} {year}",
  "Hypercar Experience {loc} {year}",
  "Track Experience {loc} {year}",
  "Supercar Meet {loc} {year}",
  "Supercars Meeting {loc} {year}",
  "Supercar Gathering {loc} {year}",
  "Hypercar Meet {loc} {year}",
  "Hypercars Event {loc} {year}",
  "Prestige Cars {loc} {year}",
  "Luxury Cars Event {loc} {year}",
  "Exotic Cars {loc} {year}",
  "Dream Cars {loc} {year}",
  "Supercar Rally {loc} {year}",
  "Hypercar Rally {loc} {year}",
  "Ferrari Meeting {loc} {year}",
  "Lamborghini Meeting {loc} {year}",
  "McLaren Meeting {loc} {year}",
  "Porsche Meeting {loc} {year}",
  "Aston Martin Meeting {loc} {year}",
  "Bugatti Meeting {loc} {year}",
  "Koenigsegg Meeting {loc} {year}",
  "Pagani Meeting {loc} {year}",
  // Réseaux sociaux — Facebook (recherches par type d'événement, pas par personne)
  "site:facebook.com événement rassemblement automobile {loc} {year}",
  "site:facebook.com cars and coffee {loc} {year}",
  "site:facebook.com supercar meeting {loc} {year}",
  "site:facebook.com supercar sunday {loc} {year}",
  "site:facebook.com Motor Sportive Day {loc} {year}",
  "site:facebook.com Motor Tour automobile {loc} {year}",
  "site:facebook.com GT Drive {loc} {year}",
  "site:facebook.com Sportive Prestige {loc} {year}",
  "site:facebook.com hypercar event {loc} {year}",
  "site:facebook.com/events automobile {loc} {year}",
  "site:facebook.com rasso auto {loc} {year}",
  "site:facebook.com exposition véhicules {loc} {year}",
  "site:facebook.com véhicules américains {loc} {year}",
  "site:facebook.com KMH automobile {loc} {year}",
  "site:facebook.com Motors Addict Leman {loc} {year}",
  "site:facebook.com DreamCars Day {loc} {year}",
  "site:facebook.com voitures prestige événement {loc} {year}",
  "site:facebook.com balade prestige {loc} {year}",
  // Réseaux sociaux — Instagram (hashtags événementiels)
  "site:instagram.com rassemblement automobile {loc} {year}",
  "site:instagram.com cars and coffee {loc} {year}",
  "site:instagram.com #supercars {loc} {year}",
  "site:instagram.com #carmeet {loc} {year}",
  "site:instagram.com #rasso {loc} {year}",
  "site:instagram.com #motorsportiveday {loc}",
  "site:instagram.com #motortour {loc}",
  "site:instagram.com #supercarsunday {loc}",
  "site:instagram.com #hypercarday {loc}",
  "site:instagram.com #supercarsoffrance",
  "site:instagram.com #frenchsupercars",
  "site:instagram.com #voituresdeprestige {loc}",
  "site:instagram.com #sportiveetprestige {loc}",
  "site:instagram.com #gtmeeting {loc}",
  "site:instagram.com #gumball3000",
  "site:instagram.com #supercarownerscircle {loc}",
  "site:instagram.com #rivierasupercars",
  "site:instagram.com #gtdrive {loc}",
  "site:instagram.com #prestidetour {loc}",
  "site:facebook.com GT Tour {loc}",
  "site:facebook.com Prestige Tour {loc}",
  "site:facebook.com Supercar Owners Circle {loc}",
  "site:facebook.com Gumball {loc}",
  "site:facebook.com Ferrari Challenge {loc}",
  "site:facebook.com Porsche Carrera Cup {loc}",
  "site:facebook.com Lamborghini Super Trofeo {loc}",
  "site:facebook.com GT Spirit {loc}",
  "site:facebook.com Drivers Club {loc}",
  "site:instagram.com KMH automobile {loc}",
  "site:instagram.com Motors Addict Leman {loc}",
  "site:instagram.com #hotrod {loc}",
  "site:instagram.com #customcar {loc}",
  "site:instagram.com #americancars {loc}",
  "site:instagram.com #forevertwowheels {loc}",
  "site:instagram.com #rockabilly {loc}",
  "site:instagram.com #kustomkulture {loc}",
  // Stock-car
  "stock-car {loc} {year}",
  "stock car {loc} {year}",
  "course de stock-car {loc} {year}",
  "championnat stock-car {loc} {year}",
  "#stockcar {loc} {year}",
  "#stockcarfrance {loc} {year}",
  "#coursedestock {loc} {year}",
  // Drift — termes & hashtags
  "drift {loc} {year}",
  "journée drift {loc} {year}",
  "drift show {loc} {year}",
  "drift battle {loc} {year}",
  "drift competition {loc} {year}",
  "Drift Masters {loc} {year}",
  "Formula Drift {loc} {year}",
  "rassemblement drift {loc} {year}",
  "#drift {loc} {year}",
  "#drifting {loc} {year}",
  "#driftcar {loc} {year}",
  "#driftshow {loc} {year}",
  "#driftbattle {loc} {year}",
  "#driftfrance {loc} {year}",
  "#driftlife {loc} {year}",
  "#driftking {loc} {year}",
  "#FormulaDrift {loc} {year}",
  "#DriftMasters {loc} {year}",
  // JDM / drift / japonaises
  "JDM Meet {loc} {year}",
  "JDM Meeting {loc} {year}",
  "Japanese Cars {loc} {year}",
  "Japanese Car Meet {loc} {year}",
  "JDM Festival {loc} {year}",
  "Japanese Performance Cars {loc} {year}",
  "Tokyo Drift Event {loc} {year}",
  "Drift Event {loc} {year}",
  "Drift Day {loc} {year}",
  "Drift Session {loc} {year}",
  "Drift Festival {loc} {year}",
  "Nissan Meet {loc} {year}",
  "Supra Meet {loc} {year}",
  "Skyline Meet {loc} {year}",
  "GTR Meet {loc} {year}",
  "Honda Meet {loc} {year}",
  "Civic Meet {loc} {year}",
  "Type R Meet {loc} {year}",
  "Mazda Rotary {loc} {year}",
  "RX7 Meet {loc} {year}",
  "RX8 Meet {loc} {year}",
  "Subaru Meet {loc} {year}",
  "WRX Meet {loc} {year}",
  "Mitsubishi Evolution Meet {loc} {year}",
  // Performance allemande / européenne
  "BMW M Meeting {loc} {year}",
  "BMW Performance {loc} {year}",
  "AMG Meeting {loc} {year}",
  "Mercedes AMG Event {loc} {year}",
  "Audi RS Meeting {loc} {year}",
  "Renault Sport Meeting {loc} {year}",
  "Alpine Meeting {loc} {year}",
  "Lotus Meeting {loc} {year}",
  // Classic / youngtimer / américaines / custom / hot rod
  "Classic Cars {loc} {year}",
  "Vintage Cars {loc} {year}",
  "Historic Cars {loc} {year}",
  "Oldtimer {loc} {year}",
  "Youngtimer {loc} {year}",
  "Youngtimer Meeting {loc} {year}",
  "Collection Cars {loc} {year}",
  "Retro Cars {loc} {year}",
  "Bourse Auto {loc} {year}",
  "Bourse d'échange {loc} {year}",
  "Anciennes mécaniques {loc} {year}",
  "American Muscle {loc} {year}",
  "American Cars Meeting {loc} {year}",
  "Véhicules US {loc} {year}",
  "rassemblement véhicules US {loc} {year}",
  "American Cars {loc} {year}",
  "American Night {loc} {year}",
  "US Cars {loc} {year}",
  "US Bikes {loc} {year}",
  "Hot Rod {loc} {year}",
  "Hot Rod Show {loc} {year}",
  "Custom Car {loc} {year}",
  "Custom Car Show {loc} {year}",
  "Kustom Car {loc} {year}",
  "Kustom Kulture {loc} {year}",
  "Chopper {loc} {year}",
  "Harley Davidson {loc} {year}",
  "moto américaine {loc} {year}",
  "Two Wheels {loc} {year}",
  "Forever Two Wheels {loc} {year}",
  "Custom Bike {loc} {year}",
  "Rockabilly {loc} {year}",
  "Rockabilly Car Show {loc} {year}",
  "L'Ouest Américain {loc} {year}",
  "Western Car Show {loc} {year}",
  "Country Car Show {loc} {year}",
  "Mustang {loc} {year}",
  "Dodge Charger {loc} {year}",
  "Camaro {loc} {year}",
  "Corvette {loc} {year}",
  "Dodge Viper {loc} {year}",
  "Shelby {loc} {year}",
  // Motorsport / circuit
  "Circuit Day {loc} {year}",
  "Open Pitlane {loc} {year}",
  "Time Attack {loc} {year}",
  "Hill Climb {loc} {year}",
  "Rallye Touristique {loc} {year}",
  "Rallye Prestige {loc} {year}",
  "Rallye Supercars {loc} {year}",
  "Endurance Event {loc} {year}",
  "Motorsport Festival {loc} {year}",
  // Marques (recherche large)
  "Ferrari {loc} {year}",
  "Lamborghini {loc} {year}",
  "Porsche {loc} {year}",
  "McLaren {loc} {year}",
  "Aston Martin {loc} {year}",
  "Bentley {loc} {year}",
  "Rolls-Royce {loc} {year}",
  "Maserati {loc} {year}",
  "Lotus {loc} {year}",
  "Alpine {loc} {year}",
  "BMW M {loc} {year}",
  "Mercedes AMG {loc} {year}",
  "Audi RS {loc} {year}",
  "Nissan GT-R {loc} {year}",
  "Toyota Supra {loc} {year}",
  "Honda Type R {loc} {year}",
  "Subaru STI {loc} {year}",
  "Mitsubishi Evolution {loc} {year}",
  // Hashtags supplémentaires
  "#carmeeting {loc} {year}",
  "#dreamcars {loc} {year}",
  "#jdm {loc} {year}",
  "#jdmmeet {loc} {year}",
  "#porscheclub {loc} {year}",
  "#ferrariclub {loc} {year}",
  "#lamborghiniclub {loc} {year}",
  "#automobileevent {loc} {year}",
  "#supercarlife {loc} {year}",
  "#carspotting {loc} {year}",
  "#petrolhead {loc} {year}",
  "#petrolheads {loc} {year}",
  "#carscene {loc} {year}",
  "#mustang {loc} {year}",
  "#astonmartin {loc} {year}",
  "#kmh {loc} {year}",
  "#dreamcarsday {loc} {year}",
  // US Vehicles / Hot Rod / Custom / Two Wheels
  "#HotRod {loc} {year}",
  "#HotRodShow {loc} {year}",
  "#CustomCar {loc} {year}",
  "#KustomKulture {loc} {year}",
  "#AmericanCars {loc} {year}",
  "#VehiculesUS {loc} {year}",
  "#USCars {loc} {year}",
  "#Chopper {loc} {year}",
  "#HarleyDavidson {loc} {year}",
  "#CustomBike {loc} {year}",
  "#TwoWheels {loc} {year}",
  "#ForeverTwoWheels {loc} {year}",
  "#FTW {loc} {year}",
  "#Rockabilly {loc} {year}",
  "#AmericanMuscle {loc} {year}",
  "#AmericanNight {loc} {year}",
  "#OuestAmericain {loc} {year}",
  // Hashtags supercars/hypercars — réseaux sociaux FR/EN
  "#motorsportiveday {loc} {year}",
  "#motortour {loc} {year}",
  "#SupercarSunday {loc} {year}",
  "#SupercarSaturday {loc} {year}",
  "#HypercarDay {loc} {year}",
  "#HypercarHunt {loc} {year}",
  "#GTMeeting {loc} {year}",
  "#GTDrive {loc} {year}",
  "#GTTour {loc} {year}",
  "#PrestigeDrive {loc} {year}",
  "#PrestigeTour {loc} {year}",
  "#EliteDrive {loc} {year}",
  "#SportiveEtPrestige {loc} {year}",
  "#BaladePrestige {loc} {year}",
  "#SupercarsOfFrance {loc} {year}",
  "#SupercarsUnited {loc} {year}",
  "#FrenchSupercars {loc} {year}",
  "#VoituresDePrestige {loc} {year}",
  "#VoituresDeSport {loc} {year}",
  "#SupercarExperience {loc} {year}",
  "#HypercarExperience {loc} {year}",
  "#SupercarsOfInstagram {loc} {year}",
  "#ExoticDrive {loc} {year}",
  "#LuxuryCarEvent {loc} {year}",
  // Rallyes & communautés avec identité forte
  "#Gumball3000 {loc} {year}",
  "#Cannonball {loc} {year}",
  "#GrandTour {loc} {year}",
  "#SupercarOwnersCircle {loc} {year}",
  "#SOC {loc} {year}",
  "#DriversClub {loc} {year}",
  "#GTSpirit {loc} {year}",
  "#RivieraSupercars {loc} {year}",
  "#MonacoSupercars {loc} {year}",
  "#FerrariChallenge {loc} {year}",
  "#LamborghiniSuperTrofeo {loc} {year}",
  "#PorscheCarreraCup {loc} {year}",
  "#BlancpainGT {loc} {year}",
  "#GTWorldChallenge {loc} {year}",
  "#TheDrive {loc} {year}",
  "#ContinentalDrive {loc} {year}",
  // F1 / Rallye — passionnés de sport automobile
  "#F1 {loc} {year}",
  "#Formula1 {loc} {year}",
  "#GrandPrix {loc} {year}",
  "#WRC {loc} {year}",
  "#Rallye {loc} {year}",
  "#RallyCar {loc} {year}",
  "#LeMansClassic {year}",
  "#TourAuto {year}",
  "#RallyeDesPrincesses {year}",
  "#GrandPrixHistorique {loc} {year}",
  "#RetroMobile {year}",
  "#ConcoursDelegance {loc} {year}",
  "#ConcoursDElegance {loc} {year}",
  "#ConcorsoEleganza {loc} {year}",
  "#ConcoursOfElegance {loc} {year}",
  "#ConcoursElegance {loc} {year}",
  "#rassopleingaz {loc} {year}",
];

// Événements/associations nommés explicitement (toujours interrogés, indépendamment
// de la rotation quotidienne) pour ne pas manquer ces rendez-vous récurrents.
const NAMED_EVENT_TEMPLATES: string[] = [
  // Événements récurrents FR
  "Carburacoeur {loc} {year}",
  "Le Rallye du Coeur {loc} {year}",
  "Autoxperience {loc} {year}",
  "Cars & Smile {loc} {year}",
  "Vintage Mécanic {loc} {year}",
  "Auto Rétro {loc} {year}",
  "exposition de véhicules anciens {loc} {year}",
  "amicale des véhicules anciens {loc} {year}",
  "Grand Prix automobile {loc} {year}",
  // Stock-car
  "stock-car {loc} {year}",
  "stock car {loc} {year}",
  "course de stock-car {loc} {year}",
  "rassemblement stock-car {loc} {year}",
  "championnat stock-car {loc} {year}",
  "stock-car France {year}",
  "site:facebook.com stock-car {loc}",
  "site:instagram.com #stockcar {loc}",
  // Drift — toutes variantes prioritaires
  "drift {loc} {year}",
  "drift event {loc} {year}",
  "journée drift {loc} {year}",
  "session drift {loc} {year}",
  "drift show {loc} {year}",
  "drift battle {loc} {year}",
  "drift competition {loc} {year}",
  "championnat de France de drift {loc} {year}",
  "Drift Masters {loc} {year}",
  "Formula Drift {loc} {year}",
  "Formule Drift {loc} {year}",
  "rassemblement drift {loc} {year}",
  "meeting drift {loc} {year}",
  "site:facebook.com drift {loc}",
  "site:facebook.com journée drift {loc}",
  "site:facebook.com drift show {loc}",
  "site:instagram.com #drift {loc}",
  "site:instagram.com #driftshow {loc}",
  "site:instagram.com #driftfrance {loc}",
  "baptême de piste {loc} {year}",
  "vieilles mécaniques {loc} {year}",
  "rasso auto {loc} {year}",
  "rasso plein gaz {loc} {year}",
  "Rasso Plein Gaz {loc} {year}",
  // Concours d'élégance — toutes variantes, tous pays, tous départements
  "concours d'élégance {loc} {year}",
  "Concours d'Élégance {loc} {year}",
  "concours d'elegance {loc} {year}",
  "concours elegance automobile {loc} {year}",
  // Variante italienne (Italie, Tessin CH, Val d'Aoste)
  "Concorso d'Eleganza {loc} {year}",
  "concorso eleganza {loc} {year}",
  // Variante anglaise (Belgique, Suisse alémanique)
  "Concours of Elegance {loc} {year}",
  "car elegance show {loc} {year}",
  // Facebook & Instagram
  "site:facebook.com concours d'élégance {loc}",
  "site:facebook.com concorso eleganza {loc}",
  "site:instagram.com #concourselegance {loc}",
  "site:instagram.com #concorsoeleganza {loc}",
  "site:instagram.com #concoursofelegance {loc}",
  // Grands concours nommés (toujours cherchés)
  "Chantilly Arts et Élégance {year}",
  "Chantilly Arts & Elegance {year}",
  "Concours d'Élégance Château de Coppet {year}",
  "Concours d'Élégance Coppet Suisse {year}",
  "Concours d'Élégance Coppet {year}",
  "Concours d'Élégance Suisse {year}",
  "Concours d'Élégance France {year}",
  "Concours d'Élégance Belgique {year}",
  "Concours d'Élégance Italie {year}",
  "Concorso d'Eleganza Villa d'Este {year}",
  "Villa d'Este Concorso {year}",
  "Cartier Style et Luxe {year}",
  "Pebble Beach Concours {year}",
  // F1 / Formule / Grands Prix
  "Grand Prix de Monaco {year}",
  "Grand Prix de France F1 {year}",
  "Grand Prix de Belgique {year}",
  "Grand Prix d'Italie Monza {year}",
  "Grand Prix d'Abu Dhabi {year}",
  "Formula 1 {loc} {year}",
  "F1 Grand Prix {loc} {year}",
  "Paddock Club F1 {year}",
  "Fan Zone F1 {loc} {year}",
  "F1 Fanzone {loc} {year}",
  "Formula E {loc} {year}",
  "Formule 2 {loc} {year}",
  "F2 {loc} {year}",
  // Rallye haut de gamme
  "Rallye Monte-Carlo {year}",
  "Tour de Corse {year}",
  "Rallye des Princesses {year}",
  "Tour Auto Optic {year}",
  "Tour Auto {loc} {year}",
  "Le Mans Classic {year}",
  "Grand Prix Historique {loc} {year}",
  "Grand Prix de Pau {year}",
  "Nürburgring 24h {year}",
  "24h du Mans {year}",
  "Spa Francorchamps {loc} {year}",
  "WRC {loc} {year}",
  "Championnat WRC {loc} {year}",
  "Trophée Andros {loc} {year}",
  "Hill Climb {loc} {year}",
  "Pikes Peak {year}",
  "Chronos Days {loc} {year}",
  "Speed Festival {loc} {year}",
  "Festival Automobile International {year}",
  "Rétromobile {year}",
  "Salon Rétromobile {year}",
  "Automédon {year}",
  // Motor Show / Salons auto
  "Motor Show {loc} {year}",
  "Salon de l'Auto {loc} {year}",
  "Salon de Genève {year}",
  "Geneva Motor Show {year}",
  "Mondial de l'Auto {year}",
  "Autosalon {loc} {year}",
  // Communautés / associations connues
  "DreamCars Day {loc} {year}",
  "DreamCarsDay {loc} {year}",
  "Motors Addict Leman {loc} {year}",
  "Motors Addict {loc} {year}",
  "KMH automobile {loc} {year}",
  "KMH {loc} {year}",
  "Wonderland cars {loc} {year}",
  "Forever Two Wheels {loc} {year}",
  "FTW Forever Two Wheels {loc} {year}",
  // Events supercars/hypercars courants sur les réseaux
  "Motor Sportive Day {loc} {year}",
  "Motor Tour automobile {loc} {year}",
  "Supercar Sunday {loc} {year}",
  "Supercar Saturday {loc} {year}",
  "Hypercar Day {loc} {year}",
  "Hypercar Hunt {loc} {year}",
  "GT Drive {loc} {year}",
  "GT Meeting {loc} {year}",
  "GT Tour {loc} {year}",
  "Prestige Drive {loc} {year}",
  "Prestige Tour {loc} {year}",
  "Continental Drive {loc} {year}",
  "Alpine GT Drive {loc} {year}",
  "Sportive et Prestige {loc} {year}",
  "Balade Prestige {loc} {year}",
  "Parade Supercars {loc} {year}",
  "Supercars of France {loc} {year}",
  "Supercars United {loc} {year}",
  // Rallyes & communautés supercars à identité forte (équivalent FTW pour GT/supercars)
  "Gumball 3000 {loc} {year}",
  "Cannonball {loc} {year}",
  "The Cannonball {loc} {year}",
  "1000 Miles {loc} {year}",
  "Mille Miglia {loc} {year}",
  "Grand Tour {loc} {year}",
  "Supercar Owners Circle {loc} {year}",
  "SOC Supercar {loc} {year}",
  "Drivers Club {loc} {year}",
  "HP Club {loc} {year}",
  "GT Spirit {loc} {year}",
  "Riviera Supercars {loc} {year}",
  "Côte d'Azur Supercars {loc} {year}",
  "Monaco Supercars {loc} {year}",
  "Saint Tropez Cars {loc} {year}",
  "Cannes Supercars {loc} {year}",
  "Ferrari Challenge {loc} {year}",
  "Lamborghini Super Trofeo {loc} {year}",
  "Porsche Carrera Cup {loc} {year}",
  "Blancpain GT {loc} {year}",
  "GT World Challenge {loc} {year}",
  "Radical Cup {loc} {year}",
  "Sport Auto Club {loc} {year}",
  "Exotic Car Drive {loc} {year}",
  "The Drive {loc} {year}",
  "Elite Car Drive {loc} {year}",
  // Balades automobiles — toutes variantes
  "balade automobile {loc} {year}",
  "balade sportive {loc} {year}",
  "balade prestige {loc} {year}",
  "balade supercars {loc} {year}",
  "balade voitures de sport {loc} {year}",
  "balade voitures de collection {loc} {year}",
  "balade voitures anciennes {loc} {year}",
  "balade en voiture {loc} {year}",
  "site:facebook.com balade automobile {loc}",
  "site:instagram.com #baladeautomobile {loc}",
  // Divers
  "run automobile {loc} {year}",
  "véhicules américains {loc} {year}",
  "american cars meeting {loc} {year}",
  "Formule 1 {loc} {year}",
  "Grand Prix F1 {loc} {year}",
  "rassemblement de véhicules de collection {loc} {year}",
  "grand événement automobile {loc} {year}",
  // Associations / events US Vehicles & Two Wheels — Facebook
  "site:facebook.com Forever Two Wheels {loc}",
  "site:facebook.com FTW Forever Two Wheels {loc}",
  "site:facebook.com véhicules US {loc}",
  "site:facebook.com hot rod {loc}",
  "site:facebook.com custom car {loc}",
  "site:facebook.com american cars {loc}",
  "site:facebook.com moto américaine {loc}",
  // "Rassemblements de France" — page/groupe Facebook de référence pour les events auto FR, triés par région
  "site:facebook.com \"Rassemblements de France\" {loc}",
  "\"Rassemblements de France\" Facebook {loc} {year}",
  "Rassemblements de France {loc} {year}",
  // Autres sources Facebook
  "site:facebook.com Motors Addict Leman {loc}",
  "site:facebook.com KMH automobile {loc}",
  "site:facebook.com DreamCars Day {loc}",
  "site:facebook.com Motor Sportive Day {loc}",
  "site:facebook.com Supercar Sunday {loc}",
  "site:facebook.com supercar event {loc}",
  "site:facebook.com hypercar event {loc}",
  "site:facebook.com voitures prestige {loc}",
  "site:facebook.com rassemblement sportives {loc}",
  "site:facebook.com rassemblements automobiles {loc}",
];

// Mots-clés priorisés pour la recherche d'affiches/images (Google Images)
const IMAGE_QUERY_TEMPLATES: string[] = [
  "rassemblement automobile {loc} {year}",
  "cars and coffee {loc} {year}",
  "supercar meeting {loc} {year}",
  "Motor Sportive Day {loc} {year}",
  "Motor Tour automobile {loc} {year}",
  "Supercar Sunday {loc} {year}",
  "Hypercar Day {loc} {year}",
  "Sportive et Prestige {loc} {year}",
  "track day {loc} {year}",
  "classic cars meeting {loc} {year}",
  "Ferrari Club {loc} {year}",
  "#CarsAndCoffee {loc} {year}",
  "#Cars&Coffee {loc} {year}",
  "#Supercars {loc} {year}",
  "#SupercarSunday {loc} {year}",
  "#motorsportiveday {loc} {year}",
  "rallye automobile {loc} {year}",
  "course de côte {loc} {year}",
  "rasso automobile {loc} {year}",
  "véhicules américains {loc} {year}",
  "DreamCars Day {loc} {year}",
  "Motors Addict Leman {loc} {year}",
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
    const nextYear = currentYear + 1;
    const baseLocation = `${department} ${country}`.trim();

    // Rotation quotidienne pour balayer progressivement toute la liste de mots-clés
    // sans dépasser le nombre d'appels API par recherche.
    const dayIndex = Math.floor(Date.now() / 86400000);

    const PRIORITY_TEMPLATES = [
      // Requêtes avec biais "à venir / prochain / upcoming" — et exclusion des EV
      "rassemblement automobile {loc} {year} -électrique",
      "rassemblement automobile {loc} {year} à venir",
      "cars and coffee {loc} {year} prochain",
      "cars and coffee {loc} {year}",
      "supercar meeting automobile {loc} {year}",
      "rallye automobile {loc} {year} -électrique",
      "rasso auto {loc} {year}",
      "agenda événements automobile {loc} {year} -électrique",
      "prochains événements automobile {loc} {year}",
      "événements à venir automobile {loc} {year}",
      // Suisse : requêtes en allemand et italien — avec exclusion EV
      "Automobilveranstaltung {loc} {year} -Elektroauto",
      "Oldtimer Treffen {loc} {year}",
      "Auto Meeting {loc} {year} bevorstehend -elektrisch",
      "manifestazione auto {loc} {year} -elettrico",
      "raduno auto {loc} {year} -elettrico",
      // Source de référence FR
      "site:facebook.com \"Rassemblements de France\" {loc}",
      "\"Rassemblements de France\" {loc} {year}",
    ];

    // ── Noms bilingues des cantons suisses (FR → DE/IT) ──
    // Permet de chercher "Basel" quand l'utilisateur sélectionne "Bâle-Ville"
    const SWISS_CANTON_NAMES: Record<string, string[]> = {
      "bâle-ville":       ["Basel", "Basel-Stadt"],
      "bale-ville":       ["Basel", "Basel-Stadt"],
      "bâle-campagne":    ["Basel-Landschaft", "Baselland"],
      "bale-campagne":    ["Basel-Landschaft", "Baselland"],
      "genève":           ["Genf", "Geneva", "Ginevra"],
      "geneve":           ["Genf", "Geneva", "Ginevra"],
      "vaud":             ["Waadt"],
      "valais":           ["Wallis", "Vallese"],
      "fribourg":         ["Freiburg"],
      "neuchâtel":        ["Neuenburg"],
      "neuchatel":        ["Neuenburg"],
      "berne":            ["Bern"],
      "lucerne":          ["Luzern"],
      "zurich":           ["Zürich", "Zuerich"],
      "tessin":           ["Ticino"],
      "grisons":          ["Graubünden", "Grigioni"],
      "argovie":          ["Aargau"],
      "thurgovie":        ["Thurgau"],
      "soleure":          ["Solothurn"],
      "schaffhouse":      ["Schaffhausen"],
      "saint-gall":       ["St. Gallen", "Sankt Gallen"],
      "zoug":             ["Zug"],
      "glaris":           ["Glarus"],
      "schwyz":           ["Schwyz"],
      "uri":              ["Uri"],
      "obwald":           ["Obwalden"],
      "nidwald":          ["Nidwalden"],
      "jura":             ["Jura"],
      "appenzell rhodes-extérieures": ["Appenzell Ausserrhoden"],
      "appenzell rhodes-intérieures": ["Appenzell Innerrhoden"],
    };

    // Variantes de localisation : ajoute les noms bilingues pour la Suisse
    const locationVariants: string[] = [baseLocation];
    if (country === "Suisse" && department) {
      const deptLower = department.split(" - ").slice(1).join(" - ").trim().toLowerCase();
      const altNames = SWISS_CANTON_NAMES[deptLower] || [];
      altNames.forEach((alt) => locationVariants.push(`${alt} Suisse`));
    }

    // Templates remplis avec une année ET une localisation donnée
    const fillTemplate = (tpl: string, year: number, loc?: string) =>
      tpl.replace("{loc}", loc ?? baseLocation).replace("{year}", String(year));

    // Génère des requêtes pour toutes les variantes de localisation
    const fillForAllLocs = (tpls: string[], year: number): string[] =>
      locationVariants.flatMap((loc) => tpls.map((t) => fillTemplate(t, year, loc)));

    // Priorités et événements nommés pour CETTE année ET l'année prochaine (toutes localisations)
    const priorityCurrentYear = fillForAllLocs(PRIORITY_TEMPLATES, currentYear);
    const priorityNextYear    = fillForAllLocs(PRIORITY_TEMPLATES, nextYear);

    // Sélection réduite des NAMED templates : top 25 les plus polyvalents pour limiter le temps de réponse
    const TOP_NAMED = NAMED_EVENT_TEMPLATES.slice(0, 25);
    const namedCurrentYear = fillForAllLocs(TOP_NAMED, currentYear);
    const namedNextYear    = fillForAllLocs(TOP_NAMED, nextYear);

    // Rotation sur ALL_QUERY_TEMPLATES — localisation principale uniquement
    const rotatedCurrent = rotateSelect(ALL_QUERY_TEMPLATES, 8, dayIndex);
    const rotatedNext    = rotateSelect(ALL_QUERY_TEMPLATES, 4, dayIndex + Math.floor(ALL_QUERY_TEMPLATES.length / 2));
    const rotatedCurrentFilled = rotatedCurrent.map((t) => fillTemplate(t, currentYear));
    const rotatedNextFilled    = rotatedNext.map((t) => fillTemplate(t, nextYear));

    const webQueries = Array.from(new Set([
      ...priorityCurrentYear,
      ...priorityNextYear,
      ...namedCurrentYear,
      ...namedNextYear,
      ...rotatedCurrentFilled,
      ...rotatedNextFilled,
    ]));

    const imageTemplates = rotateSelect(IMAGE_QUERY_TEMPLATES, 3, dayIndex);
    const imageCurrentYear = imageTemplates.map((t) => `affiche ${fillTemplate(t, currentYear)}`);
    const imageNextYear = imageTemplates.slice(0, 1).map((t) => `affiche ${fillTemplate(t, nextYear)}`);
    const imageQueries = [...imageCurrentYear, ...imageNextYear];

    console.log(`SEARCHING ${webQueries.length} WEB QUERIES + ${imageQueries.length} IMAGE QUERIES`);

    const [webResultsArrays, imageResultsArrays] = await Promise.all([
      mapWithConcurrency(webQueries, 8, (q) => googleSearch(q)),
      mapWithConcurrency(imageQueries, 3, (q) => googleImages(q)),
    ]);

    const webResults = webResultsArrays.flat();
    const imageResults = imageResultsArrays.flat();

    const events: EventCard[] = [];

    // Analyse réduite à 6 images pour limiter les appels OpenAI
    const analyzedImages = await mapWithConcurrency(imageResults.slice(0, 6), 4, async (img: any) => {
      const imageUrl = img.original || img.thumbnail || "";
      const analyzed = await analyzeImage(imageUrl);
      return { img, imageUrl, analyzed };
    });

    for (const { img, imageUrl, analyzed } of analyzedImages) {
      if (analyzed?.isfuture === false) {
        console.log("SKIPPED IMAGE PAST:", analyzed?.title);
        continue;
      }

      let parsedDate = parseEventDate(analyzed?.date);
      // Fallback : date dans l'URL de l'image si l'analyse IA ne la donne pas
      if (!parsedDate && imageUrl) {
        const urlDateMatch = imageUrl.match(/[\/=](\d{4})[\/\-](\d{2})[\/\-](\d{2})(?:[\/\?\#]|$)/);
        if (urlDateMatch) {
          const y = Number.parseInt(urlDateMatch[1], 10);
          const m = Number.parseInt(urlDateMatch[2], 10) - 1;
          const d = Number.parseInt(urlDateMatch[3], 10);
          if (y >= 2020 && y <= 2030 && m >= 0 && m < 12 && d >= 1 && d <= 31) {
            parsedDate = new Date(y, m, d);
          }
        }
      }
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

    for (const r of webResults.slice(0, 120)) {
      // Tentative 1 : date dans le snippet (texte affiché par Google)
      let parsedDate = parseEventDate(r.snippet);

      // Tentative 2 : champ "date" retourné directement par SerpAPI pour les articles
      if (!parsedDate && r.date) {
        parsedDate = parseEventDate(String(r.date));
      }

      // Tentative 3 : date encodée dans l'URL (ex: ledauphinelibere.fr/2025/12/13/...)
      // Couvre les formats /YYYY/MM/DD/ et ?date=YYYY-MM-DD courants dans la presse
      if (!parsedDate && r.link) {
        const urlDateMatch = String(r.link).match(/[\/=](\d{4})[\/\-](\d{2})[\/\-](\d{2})(?:[\/\?\#]|$)/);
        if (urlDateMatch) {
          const y = Number.parseInt(urlDateMatch[1], 10);
          const m = Number.parseInt(urlDateMatch[2], 10) - 1;
          const d = Number.parseInt(urlDateMatch[3], 10);
          if (y >= 2020 && y <= 2030 && m >= 0 && m < 12 && d >= 1 && d <= 31) {
            parsedDate = new Date(y, m, d);
          }
        }
      }

      // Tentative 4 : date dans le titre (ex: "Rassemblement 13 déc. 2025")
      if (!parsedDate) {
        parsedDate = parseEventDate(r.title);
      }

      if (parsedDate && !isFutureOrToday(parsedDate)) {
        console.log("SKIPPED WEB PAST:", r.title, parsedDate.toISOString().slice(0, 10));
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

    // ── Filtre de pertinence : exclut les articles de presse qui ne sont PAS des événements ──
    // Un résultat est un événement probable s'il contient au moins un mot-clé événementiel.
    // S'il contient des mots-clés non-événementiels (actualité politique/fiscale/accident)
    // sans aucun mot-clé événementiel, il est exclu.
    function isLikelyEvent(title: string, summary: string): boolean {
      const text = `${title} ${summary}`.toLowerCase();

      const eventKw = [
        "rassemblement","rasso","meeting auto","meeting automobile","salon auto","salon de l'auto",
        "exposition auto","exposition voiture","expo auto","show auto","motor show","motorshow","auto show","autoshow",
        "événement automobile","evenement automobile","event auto","event voiture",
        "festival automobile","journée automobile","journee automobile",
        "cars and coffee","car show","car meet","car week",
        // Courses AUTOMOBILES spécifiques
        "course automobile","course de voiture","course de côte","course de vitesse auto",
        "course de voitures","course d'endurance","course sur circuit","rallye automobile",
        "rallye auto","rally auto","rally car",
        "drift","run auto","run automobile","balade automobile","balade voiture","sortie voiture",
        "oldtimer","treffen","raduno","manifestazione","concentrazione",
        "exposant voiture","inscription voiture","billet auto","programme automobile",
        "agenda automobile","agenda auto",
        "circuit automobile","paddock","track day","trackday",
        "à venir","prochain","prochaine","ce samedi","ce dimanche","ce weekend",
        "retrouvez","rendez-vous","rdv","venez nous",
        "concours d'élégance","concorso d'eleganza","congrès auto",
        "stock-car","drag race","gymkhana","autocross","supercar","hypercar",
        "voiture de sport","voiture sportive","voiture de collection","voiture ancienne",
        "véhicule ancien","véhicule de collection","véhicule américain",
      ];

      const nonEventKw = [
        // Actualité fiscale / politique
        "taxe sur les véhicules","taxe véhicule","impôt véhicule","vignette routière",
        "parlement","vote au","loi sur","décide de majorer","majoration de",
        // Accident / fait divers
        "accident mortel","accident grave","collision frontale","percuté","heurté",
        "blessé grave","décès sur la route","mort sur la route",
        // Économie / industrie
        "chiffres de ventes","ventes de voitures","marché automobile","industrie automobile",
        "rappel constructeur","défaut de fabrication",
        // Embouteillages / trafic
        "embouteillage","bouchon sur","trafic perturbé","route coupée",
        // Criminalité / divers
        "vol de voiture","volé sa voiture","carjacking",
        // ── Courses NON-AUTOMOBILES ──
        // Course à pied / athlétisme
        "course à pied","course de fond","course trail","course d'obstacles",
        "course de montagne","course urbaine","course nature",
        "marathon","semi-marathon","10 km","10km","5 km","5km",
        "trail running","trail run","cross country","nordic walking",
        // Athlétisme (le cas "Fribourg International Meeting")
        "athlétisme","athletisme","athletics",
        "saut à la perche","saut en hauteur","saut en longueur",
        "pole vault","high jump","long jump","triple jump",
        "lancer du javelot","lancer du disque","lancer du marteau","lancer du poids",
        "100 mètres","200 mètres","400 mètres","800 mètres","1500 mètres",
        "meeting d'athlétisme","meeting international d'athlétisme",
        "city event athletics","city athletics","sprinter","athlète","athlete",
        // Cyclisme
        "course cycliste","course de vélo","course vélo","course de vtt",
        "cyclisme","vélo de route","vtt compétition","bmx compétition",
        "tour de suisse cycliste","tour de france cycliste","tour cycliste",
        "critérium cycliste","cyclo-cross","gravel race","gran fondo",
        // Course de chevaux
        "course hippique","course de chevaux","hippodrome","pmu","quinté",
        "trot","galop compétition","obstacle équestre",
        // Course à ski / hivernale
        "course de ski","descente ski","slalom géant","combiné alpin",
        "ski de fond compétition","biathlon","course nordique",
        // Course nautique
        "course à la voile","régate","voile compétition","aviron course",
        "course de kayak","course de canoë",
        // Sports collectifs et autres
        "match de football","match de rugby","match de tennis","match de basketball",
        "tournoi de tennis","tournoi de football","tournoi de volleyball",
        "natation compétition","triathlon","ironman","duathlon",
        "patinage artistique","hockey sur glace match",
        "escalade compétition","judo compétition","karaté compétition",
        "course de karting" , // karting ≠ karting automobile si contexte enfant/loisir
        // Musique / concerts (sans voitures)
        "concert de","festival de musique","festival rock","festival jazz",
        "spectacle de danse","opéra","théâtre",
        // Foires / marchés généraux (non-auto)
        "marché de noël","foire agricole","foire artisanale",
        // ── Événements exclusivement véhicules électriques ──
        // Tous pays : FR / EN / DE (Suisse alémanique, Allemagne) / IT (Tessin, Italie)
        // (Monarch Supercars est axé moteurs thermiques / sport / prestige)

        // Français
        "rallye électrique","rallye en voiture électrique","rallye de voitures électriques",
        "rallye véhicules électriques","rallye véhicule électrique",
        "rallye touristique électrique","rallye zéro émission","rallye zéro carbone",
        "e-france","e france rallye","tour électrique","run électrique",
        "rallye voiture verte","rallye mobilité verte","rallye éco",
        "électromobilité","mobilité électrique événement",
        "rallye hybride électrique","challenge électrique automobile",
        "trophée véhicule électrique","coupe véhicule électrique",
        "concentration voitures électriques","rassemblement voitures électriques",

        // Anglais (Belgique, Suisse anglophone)
        "ev rally","ev run","electric vehicle rally","electric car rally",
        "electric vehicle event","electric car show focused","ev meeting",
        "zero emission rally","green car rally","e-mobility event",
        "electric car club","electric vehicle club",

        // Allemand (Suisse alémanique, Allemagne)
        "elektroauto rallye","elektroauto treffen","e-auto rallye","e-auto treffen",
        "elektromobilität veranstaltung","elektrofahrzeug treffen",
        "elektrofahrzeug rallye","stromer treffen","elektroauto event",
        "elektroauto tour","zero emission rallye","e-mobil treffen",
        "tesla treffen","e-fahrzeug","elektroauto club treffen",

        // Italien (Tessin, Italie)
        "rally elettrico","raduno auto elettriche","veicoli elettrici raduno",
        "rally veicoli elettrici","tour elettrico","concentrazione auto elettriche",
        "mobilità elettrica evento","auto elettrica raduno",
        "raduno tesla","rally emissioni zero","auto verde rally",

        // Néerlandais (Belgique)
        "elektrische auto rally","ev rally","elektrische voertuigen event",
        "groene auto rally","elektrische wagen treffen",
      ];

      const hasEvent = eventKw.some(kw => text.includes(kw));
      const hasNonEvent = nonEventKw.some(kw => text.includes(kw));

      // Si clairement non-événementiel ET aucun mot-clé événement → exclu
      if (hasNonEvent && !hasEvent) return false;

      return true;
    }

    const uniqueEvents = events
      .filter((event, index, array) => {
        const key = `${event.title}|${event.source_url}`;
        return array.findIndex((item) => `${item.title}|${item.source_url}` === key) === index;
      })
      .filter((event) => isLikelyEvent(event.title || "", event.summary || ""));

    // Filtre de pertinence géographique : si un département/région est sélectionné,
    // on ne garde que les événements dont le titre/résumé/lieu/source mentionnent
    // ce département (ex: "33 - Gironde" -> "Gironde"). Si rien ne correspond, le
    // fallback IA ci-dessous prendra le relais avec des suggestions ciblées sur
    // cette zone précise.
    //
    // Matching précis pour éviter les faux positifs du type :
    //   "Savoie" (73) qui matchait "Haute-Savoie" (74)
    //   "Loire" (42) qui matchait "Haute-Loire" (43) ou "Loire-Atlantique" (44)
    //   "Marne" (51) qui matchait "Haute-Marne" (52)
    //
    // Règle : le nom du département ne doit pas être précédé NI suivi d'une
    // lettre ou d'un tiret (ce qui indiquerait qu'il fait partie d'un nom composé).
    // On accepte également la présence du code numérique seul (ex: "73" dans
    // "(73)" ou "73000") comme correspondance fiable.
    // haystackFull : titre + résumé + lieu + URL  → pour le code numérique
    // haystackNoUrl : titre + résumé + lieu seulement → pour le nom (évite les faux
    //   positifs des chemins URL comme "/evenements-savoie/" ou "/agenda-haute-savoie/")
    function matchesDepartment(haystackFull: string, haystackNoUrl: string, deptCode: string, deptName: string): boolean {
      // --- 1. Correspondance par code numérique dans un contexte département ---
      // On exige que le code apparaisse dans un contexte typique :
      // "(73)", "73 -", "dép. 73", "dept73", code postal "73xxx"
      if (deptCode && /^\d+$/.test(deptCode)) {
        const codePatterns = [
          `\\(${deptCode}\\)`,                    // (73)  ← parenthèses, très fiable
          `\\b${deptCode}\\s+[-–]`,               // "73 -" ← espace requis : évite les slugs URL "/73-savoie/"
          `[-–]\\s+${deptCode}\\b`,               // "- 73" ← espace requis
          `\\bdép\\.?\\s*${deptCode}\\b`,         // dép. 73
          `\\bdept\\.?\\s*${deptCode}\\b`,        // dept 73
          `\\b${deptCode}[0-9]{3}\\b`,            // code postal 73000-73999
        ];
        if (codePatterns.some(p => new RegExp(p, "i").test(haystackFull))) {
          return true;
        }
      }

      if (!deptName) return false;

      // --- 2. Correspondance par nom — sur haystackNoUrl uniquement ---
      // On normalise tirets et underscores en espaces pour traiter uniformément
      // "haute-savoie" et "haute savoie" de la même façon.
      const h = haystackNoUrl.replace(/[-_]/g, " ").replace(/\s+/g, " ");
      const name = deptName.replace(/[-_]/g, " ").trim();
      const nameWords = name.split(" ");

      // Mots qui, placés AVANT le nom, indiquent un département composé différent :
      // "haute savoie" ≠ "savoie", "maine et loire" ≠ "loire"
      const prefixBlock = new Set([
        "haute", "haut", "bas", "basse", "val", "grand", "grande",
        "petit", "petite", "pas", "et", "saint",
      ]);

      // Mots qui, placés APRÈS le nom, indiquent un département composé différent :
      // "loire atlantique" ≠ "loire", "seine maritime" ≠ "seine"
      const suffixBlock = new Set([
        "atlantique", "maritime", "denis", "marne", "oise", "et",
        "blanc", "mont",
      ]);

      const words = h.split(" ");

      for (let i = 0; i <= words.length - nameWords.length; i++) {
        // Vérifie si la séquence de mots correspond au nom du département
        const seq = words.slice(i, i + nameWords.length);
        if (!seq.every((w, j) => w === nameWords[j])) continue;

        // Mot qui précède la séquence
        const prevWord = i > 0 ? words[i - 1] : "";
        if (prefixBlock.has(prevWord)) continue;  // ex. "haute" avant "savoie" → rejeté

        // Mot qui suit la séquence
        const nextWord = words[i + nameWords.length] ?? "";
        if (suffixBlock.has(nextWord)) continue;  // ex. "atlantique" après "loire" → rejeté

        return true;  // Correspondance valide
      }

      return false;
    }

    const deptParts = department.includes(" - ") ? department.split(" - ") : ["", department];
    const deptCode = deptParts[0].trim();
    const departmentLabel = deptParts.slice(1).join(" - ").trim() || department.trim();

    // Noms alternatifs bilingues pour le matching géographique (Suisse principalement)
    const deptAltNames: string[] = [];
    if (departmentLabel) {
      const deptLower = departmentLabel.toLowerCase();
      const alts = SWISS_CANTON_NAMES[deptLower] || [];
      alts.forEach((a) => deptAltNames.push(a.toLowerCase()));
    }

    let relevantEvents = uniqueEvents;

    if (departmentLabel) {
      const deptName = departmentLabel.toLowerCase();
      const matched = uniqueEvents.filter((event) => {
        const haystackFull  = `${event.title} ${event.summary || ""} ${event.venue_name || ""} ${event.source_url || ""}`.toLowerCase();
        const haystackNoUrl = `${event.title} ${event.summary || ""} ${event.venue_name || ""}`.toLowerCase();

        // Correspondance avec le nom FR du département
        if (matchesDepartment(haystackFull, haystackNoUrl, deptCode, deptName)) return true;

        // Correspondance avec les noms alternatifs (DE/IT pour Suisse)
        for (const alt of deptAltNames) {
          if (matchesDepartment(haystackFull, haystackNoUrl, "", alt)) return true;
        }

        return false;
      });

      if (matched.length > 0) {
        relevantEvents = matched;
      } else {
        relevantEvents = [];
      }
    }

    // ── Tri de qualité : événements avec date future proche en premier ──
    // Score : date connue future = prioritaire, date inconnue = neutre, passé = déjà filtré
    const now = Date.now();
    const FAR_FUTURE = 9_999_999_999_999;

    relevantEvents.sort((a, b) => {
      const dateA = parseEventDate(a.event_date);
      const dateB = parseEventDate(b.event_date);
      const tsA = dateA ? dateA.getTime() : FAR_FUTURE;
      const tsB = dateB ? dateB.getTime() : FAR_FUTURE;

      // Les dates futures proches d'abord, les sans-date après
      const scoreA = tsA === FAR_FUTURE ? FAR_FUTURE : Math.abs(tsA - now);
      const scoreB = tsB === FAR_FUTURE ? FAR_FUTURE : Math.abs(tsB - now);

      return scoreA - scoreB;
    });

    // Déduplique les titres trop similaires (ex: même événement via deux sources)
    const seenTitles = new Set<string>();
    relevantEvents = relevantEvents.filter((ev) => {
      const key = (ev.title || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
      if (seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    });

    if (relevantEvents.length === 0) {
      const rawFallback = await generateFallbackEvents(baseLocation, currentYear);
      const fallbackEvents = rawFallback.filter((ev) => {
        const parsed = parseEventDate(ev.event_date);
        return !parsed || isFutureOrToday(parsed);
      });
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