// deno-lint-ignore-file no-explicit-any
// MONARCH SUPERCARS - Supabase Edge Function
// Chemin : supabase/functions/google-directions/index.ts
// Calcule l'itinéraire détaillé (étape par étape) via Google Directions API.
// La clé GOOGLE_MAPS_API_KEY reste côté serveur (jamais exposée au frontend).

export {};

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function stripHtml(value: string): string {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

const MANEUVER_ICONS: Record<string, string> = {
  "turn-left": "⬅️",
  "turn-right": "➡️",
  "turn-sharp-left": "↖️",
  "turn-sharp-right": "↗️",
  "turn-slight-left": "↖️",
  "turn-slight-right": "↗️",
  "uturn-left": "↩️",
  "uturn-right": "↪️",
  "merge": "🔀",
  "fork-left": "↖️",
  "fork-right": "↗️",
  "ramp-left": "↖️",
  "ramp-right": "↗️",
  "roundabout-left": "🔄",
  "roundabout-right": "🔄",
  "straight": "⬆️",
  "ferry": "⛴️",
  "ferry-train": "🚆",
};

function maneuverIcon(maneuver?: string): string {
  if (!maneuver) return "⬆️";
  return MANEUVER_ICONS[maneuver] || "⬆️";
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Méthode non autorisée" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));

    const origin = String(body.origin || "").trim();
    const destination = String(body.destination || "").trim();
    const waypoints: string[] = Array.isArray(body.waypoints)
      ? body.waypoints.map((w: any) => String(w || "").trim()).filter(Boolean)
      : [];

    if (!origin || !destination) {
      return jsonResponse({ error: "Adresses de départ et d'arrivée requises." }, 400);
    }

    const apiKey = (Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "").trim();

    if (!apiKey) {
      return jsonResponse({ error: "GOOGLE_MAPS_API_KEY manquante" }, 400);
    }

    const params = new URLSearchParams({
      origin,
      destination,
      language: "fr",
      units: "metric",
      key: apiKey,
    });

    if (waypoints.length > 0) {
      params.set("waypoints", waypoints.map((w) => `via:${w}`).join("|"));
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK") {
      return jsonResponse(
        { error: `Google Directions: ${data.status}${data.error_message ? " - " + data.error_message : ""}` },
        400,
      );
    }

    const route = data.routes?.[0];

    if (!route) {
      return jsonResponse({ error: "Aucun itinéraire trouvé." }, 400);
    }

    const legs = (route.legs || []).map((leg: any) => ({
      start_address: leg.start_address || "",
      end_address: leg.end_address || "",
      distance: leg.distance?.text || "",
      duration: leg.duration?.text || "",
      steps: (leg.steps || []).map((step: any) => ({
        instruction: stripHtml(step.html_instructions || ""),
        distance: step.distance?.text || "",
        duration: step.duration?.text || "",
        maneuver: step.maneuver || "",
        icon: maneuverIcon(step.maneuver),
      })),
    }));

    return jsonResponse({
      total_distance: legs.reduce((sum: number, l: any, i: number) => sum + (route.legs[i].distance?.value || 0), 0),
      total_duration: legs.reduce((sum: number, l: any, i: number) => sum + (route.legs[i].duration?.value || 0), 0),
      legs,
      overview_polyline: route.overview_polyline?.points || "",
    });
  } catch (error) {
    console.log("GOOGLE DIRECTIONS ERROR:", error);

    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      400,
    );
  }
});
