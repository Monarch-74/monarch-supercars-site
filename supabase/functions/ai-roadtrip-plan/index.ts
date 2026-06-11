// deno-lint-ignore-file no-explicit-any

export {};

const roadtripCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: roadtripCorsHeaders,
  });
}

async function createOpenAICompletion(apiKey: string, prompt: string): Promise<any> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content:
            "Tu es un expert road trip premium automobile, supercars, tourisme haut de gamme, hôtels, restaurants et itinéraires européens.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errorText}`);
  }

  return res.json();
}

async function insertRoadtripRequest(
  supabaseUrl: string,
  supabaseKey: string,
  body: any,
  summary: string,
  googleMapsUrl: string,
  wazeUrl: string,
): Promise<void> {
  await fetch(`${supabaseUrl}/rest/v1/roadtrip_requests`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      payload: body,
      ai_summary: summary,
      route_google_maps_url: googleMapsUrl,
      route_waze_url: wazeUrl,
    }),
  });
}

async function googlePlacesSearch(query: string): Promise<any[]> {
  const apiKey = (Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "").trim();

  if (!apiKey) {
    console.log("GOOGLE_MAPS_API_KEY missing");
    return [];
  }

  const url =
    "https://maps.googleapis.com/maps/api/place/textsearch/json?query=" +
    encodeURIComponent(query) +
    "&language=fr&key=" +
    apiKey;

  const res = await fetch(url.toString());
  const data = await res.json();

  console.log("GOOGLE PLACES:", res.status, query);

  if (!Array.isArray(data.results)) return [];

  return data.results
    .filter((place: any) => {
      if (!place.rating) return true;
      return Number(place.rating) >= 4.4;
    })
    .slice(0, 5);
}

function buildFullAddress(address?: string, region?: string, country?: string): string {
  return [address, region, country].filter(Boolean).join(", ");
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: roadtripCorsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Méthode non autorisée" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));

    const openaiKey = (Deno.env.get("OPENAI_API_KEY") ?? "").trim();
    if (!openaiKey) {
      return jsonResponse({ error: "OPENAI_API_KEY manquante" }, 400);
    }

    const startFull = buildFullAddress(
      body.start_address,
      body.start_region,
      body.start_country,
    );

    const endFull = buildFullAddress(
      body.end_address,
      body.end_region,
      body.end_country,
    );

    const searchZone = [
      body.start_region,
      body.end_region,
      body.start_country,
      body.end_country,
      body.preferences,
    ].filter(Boolean).join(" ");

    const [scenic, museums, restaurants, hotels] = await Promise.all([
      googlePlacesSearch(`points de vue panoramiques route automobile ${searchZone}`),
      googlePlacesSearch(`musée automobile exposition voiture collection ${searchZone}`),
      googlePlacesSearch(`restaurants très bien notés gastronomique premium parking sécurisé note 4.4 ${searchZone}`),
      googlePlacesSearch(`hôtels 4 étoiles luxe très bien notés parking sécurisé premium ${searchZone}`),
    ]);

    const prompt = `
Tu es l'assistant IA de MONARCH SUPERCARS.
Tu crées un roadbook premium automobile, clair, structuré et imprimable.

Données utilisateur :
${JSON.stringify(body, null, 2)}

Départ complet :
${startFull}

Arrivée complète :
${endFull}

Points de vue candidats :
${JSON.stringify(scenic, null, 2)}

Musées / expositions candidats :
${JSON.stringify(museums, null, 2)}

Restaurants candidats :
${JSON.stringify(restaurants, null, 2)}

Hôtels candidats :
${JSON.stringify(hotels, null, 2)}

Règles obligatoires :
- Respecte strictement les préférences utilisateur.
- Si l'utilisateur indique des villes, lieux ou activités obligatoires dans les préférences, tu dois les intégrer comme étapes officielles.
- Ne force jamais une ville fixe : utilise uniquement les lieux demandés par l'utilisateur.
- Si l'utilisateur demande une activité comme hélicoptère, jet ski, circuit, musée, château ou restaurant précis, ajoute une section "Activités demandées par l'utilisateur".
- Les restaurants doivent être uniquement des établissements très bien notés, idéalement note Google supérieure à 4.4/5.
- Privilégie les établissements premium, gastronomiques, avec parking sécurisé si possible.
- Évite les fast-foods, chaînes bas de gamme, restaurants mal notés ou avec peu d'avis.
- Les hôtels doivent être très bien notés et adaptés à une clientèle premium automobile.
- Si les données Google Places sont vides ou insuffisantes, propose des recommandations cohérentes mais indique que les contacts doivent être vérifiés.

Le roadbook doit contenir :
1. Résumé du trajet
2. Itinéraire jour par jour
3. Étapes obligatoires demandées par l'utilisateur
4. Points de vue à visiter
5. Musées automobiles / expositions
6. Restaurants recommandés très bien notés
7. Hôtels recommandés très bien notés
8. Contacts utiles si disponibles
9. Conseils timing : déjeuner, route, hôtel
10. Recommandations Google Maps / Waze

Retourne uniquement un JSON valide au format :
{
  "summary": "roadbook complet en texte imprimable",
  "stops": [
    {
      "name": "",
      "type": "viewpoint|museum|restaurant|hotel|activity|stop",
      "address": "",
      "reason": "",
      "rating": "",
      "contact": ""
    }
  ]
}
`;

    const response = await createOpenAICompletion(openaiKey, prompt);

    const rawText = response.choices?.[0]?.message?.content || "{}";
    const cleanText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsed: any;

    try {
      parsed = JSON.parse(cleanText);
    } catch {
      parsed = {
        summary: cleanText,
        stops: [],
      };
    }

    const stopAddresses = Array.isArray(parsed.stops)
      ? parsed.stops.map((s: any) => s.address).filter(Boolean)
      : [];

    const addresses = [startFull, ...stopAddresses, endFull].filter(Boolean);
    const encoded = addresses.map((a: string) => encodeURIComponent(a));

    const googleMapsUrl =
      addresses.length > 1
        ? `https://www.google.com/maps/dir/${encoded.join("/")}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(startFull)}`;

    const wazeUrl =
      `https://waze.com/ul?q=${encodeURIComponent(endFull || startFull)}&navigate=yes`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && supabaseKey) {
      try {
        await insertRoadtripRequest(
          supabaseUrl,
          supabaseKey,
          body,
          parsed.summary || "",
          googleMapsUrl,
          wazeUrl,
        );
      } catch (dbError) {
        console.log("SUPABASE INSERT WARNING:", dbError);
      }
    }

    return jsonResponse({
      summary: parsed.summary || "",
      stops: parsed.stops || [],
      google_maps_url: googleMapsUrl,
      waze_url: wazeUrl,
      scenic,
      museums,
      restaurants,
      hotels,
    });
  } catch (error) {
    console.log("AI ROADTRIP ERROR:", error);

    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      400,
    );
  }
});