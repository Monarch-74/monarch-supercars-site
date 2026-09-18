// deno-lint-ignore-file no-explicit-any
// MONARCH SUPERCARS - Invite un membre (compte Monarch existant) sur un road trip.
// Seul le propriétaire du road trip peut inviter. L'email doit correspondre à un
// compte déjà inscrit : on ne crée pas de compte ni n'envoie d'email externe ici,
// l'invité verra l'invitation apparaître dans son suivi road trip une fois connecté.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: cors });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: "Méthode non autorisée" }, 405);

  try {
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const supabaseKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
    if (!supabaseUrl || !supabaseKey) throw new Error("Secrets Supabase manquants");

    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new Error("Authentification requise.");

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) throw new Error("Session invalide, merci de vous reconnecter.");
    const callerId = userData.user.id;

    const body = await req.json().catch(() => ({} as any));
    const roadtripId = String(body.roadtrip_id || "").trim();
    const email = String(body.email || "").trim().toLowerCase();

    if (!roadtripId || !email) {
      return jsonResponse({ error: "roadtrip_id et email requis." }, 400);
    }

    // Le propriétaire du road trip est le seul autorisé à inviter.
    const { data: trip, error: tripError } = await supabase
      .from("roadtrip_requests")
      .select("id,user_id")
      .eq("id", roadtripId)
      .single();

    if (tripError || !trip || trip.user_id !== callerId) {
      throw new Error("Vous n'êtes pas autorisé à inviter des membres sur ce road trip.");
    }

    // Recherche d'un compte Monarch existant pour cet email (pas de création de compte ici).
    const { data: usersList, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw new Error("Impossible de vérifier les comptes existants.");

    const invitee = (usersList?.users || []).find(
      (u: any) => (u.email || "").toLowerCase() === email,
    );

    if (!invitee) {
      return jsonResponse(
        { error: "Aucun compte Monarch n'existe avec cet email. La personne doit d'abord créer un compte gratuit." },
        404,
      );
    }

    if (invitee.id === callerId) {
      return jsonResponse({ error: "Vous êtes déjà le propriétaire de ce road trip." }, 400);
    }

    const { data: member, error: insertError } = await supabase
      .from("roadtrip_members")
      .upsert(
        {
          roadtrip_id: roadtripId,
          user_id: invitee.id,
          email: invitee.email,
          invited_by: callerId,
          role: "member",
          status: "invited",
          responded_at: null,
        },
        { onConflict: "roadtrip_id,user_id" },
      )
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    return jsonResponse({
      ok: true,
      member: {
        id: member.id,
        email: member.email,
        status: member.status,
      },
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      400,
    );
  }
});
