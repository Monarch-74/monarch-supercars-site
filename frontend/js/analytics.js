// MONARCH SUPERCARS - Mesure d'audience (pages vues, sessions, durée de consultation)
// Enregistre une ligne par page consultée dans public.analytics_sessions et met à
// jour sa durée pendant que la page reste ouverte. Utilisé par le dashboard admin.
(function () {
  if (!window.MONARCH_CONFIG || !window.supabase) return;

  var client = window.supabase.createClient(
    window.MONARCH_CONFIG.SUPABASE_URL,
    window.MONARCH_CONFIG.SUPABASE_ANON_KEY
  );

  var SESSION_KEY = "monarch_session_id";
  var sessionId = sessionStorage.getItem(SESSION_KEY);

  if (!sessionId) {
    sessionId = (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  var startedAt = Date.now();
  var rowId = (window.crypto && window.crypto.randomUUID)
    ? window.crypto.randomUUID()
    : String(Date.now()) + "-" + Math.random().toString(16).slice(2);

  client
    .from("analytics_sessions")
    .insert({ id: rowId, session_id: sessionId, path: window.location.pathname })
    .then(function () {})
    .catch(function () {});

  function reportDuration() {
    if (!rowId) return;
    var duration = Math.round((Date.now() - startedAt) / 1000);

    client
      .from("analytics_sessions")
      .update({ duration_seconds: duration })
      .eq("id", rowId)
      .then(function () {})
      .catch(function () {});
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") reportDuration();
  });

  window.addEventListener("pagehide", reportDuration);
  setInterval(reportDuration, 30000);
})();
