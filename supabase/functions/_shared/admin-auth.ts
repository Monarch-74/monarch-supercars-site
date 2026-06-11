// deno-lint-ignore-file no-explicit-any
// MONARCH SUPERCARS - Helper partagé pour sécuriser les fonctions Admin
// Vérifie que la requête provient d'un utilisateur connecté ayant le rôle "admin"
// dans la table public.profiles. Lève une erreur sinon.

export async function requireAdmin(req: Request, supabase: any): Promise<any> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw new Error("Authentification requise.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData?.user) {
    throw new Error("Session invalide.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    throw new Error("Accès réservé à l'administrateur.");
  }

  return userData.user;
}
