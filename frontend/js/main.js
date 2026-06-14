// Configuration
var cfg = window.MONARCH_CONFIG || {};
var supabaseClient = null;

if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) {
  supabaseClient = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );
}

// Départements par pays
var REGIONS = {
  France: [
    "01 - Ain", "02 - Aisne", "03 - Allier", "04 - Alpes-de-Haute-Provence", "05 - Hautes-Alpes",
    "06 - Alpes-Maritimes", "07 - Ardèche", "08 - Ardennes", "09 - Ariège", "10 - Aube",
    "11 - Aude", "12 - Aveyron", "13 - Bouches-du-Rhône", "14 - Calvados", "15 - Cantal",
    "16 - Charente", "17 - Charente-Maritime", "18 - Cher", "19 - Corrèze", "2A - Corse-du-Sud",
    "2B - Haute-Corse", "21 - Côte-d'Or", "22 - Côtes-d'Armor", "23 - Creuse", "24 - Dordogne",
    "25 - Doubs", "26 - Drôme", "27 - Eure", "28 - Eure-et-Loir", "29 - Finistère",
    "30 - Gard", "31 - Haute-Garonne", "32 - Gers", "33 - Gironde", "34 - Hérault",
    "35 - Ille-et-Vilaine", "36 - Indre", "37 - Indre-et-Loire", "38 - Isère", "39 - Jura",
    "40 - Landes", "41 - Loir-et-Cher", "42 - Loire", "43 - Haute-Loire", "44 - Loire-Atlantique",
    "45 - Loiret", "46 - Lot", "47 - Lot-et-Garonne", "48 - Lozère", "49 - Maine-et-Loire",
    "50 - Manche", "51 - Marne", "52 - Haute-Marne", "53 - Mayenne", "54 - Meurthe-et-Moselle",
    "55 - Meuse", "56 - Morbihan", "57 - Moselle", "58 - Nièvre", "59 - Nord",
    "60 - Oise", "61 - Orne", "62 - Pas-de-Calais", "63 - Puy-de-Dôme", "64 - Pyrénées-Atlantiques",
    "65 - Hautes-Pyrénées", "66 - Pyrénées-Orientales", "67 - Bas-Rhin", "68 - Haut-Rhin", "69 - Rhône",
    "70 - Haute-Saône", "71 - Saône-et-Loire", "72 - Sarthe", "73 - Savoie", "74 - Haute-Savoie",
    "75 - Paris", "76 - Seine-Maritime", "77 - Seine-et-Marne", "78 - Yvelines", "79 - Deux-Sèvres",
    "80 - Somme", "81 - Tarn", "82 - Tarn-et-Garonne", "83 - Var", "84 - Vaucluse",
    "85 - Vendée", "86 - Vienne", "87 - Haute-Vienne", "88 - Vosges", "89 - Yonne",
    "90 - Territoire de Belfort", "91 - Essonne", "92 - Hauts-de-Seine", "93 - Seine-Saint-Denis",
    "94 - Val-de-Marne", "95 - Val-d'Oise"
  ],
  Belgique: [
    "Bruxelles-Capitale", "Anvers", "Brabant flamand", "Brabant wallon",
    "Flandre-Occidentale", "Flandre-Orientale", "Hainaut", "Liège",
    "Limbourg", "Luxembourg", "Namur"
  ],
  Suisse: [
    "Argovie", "Appenzell Rhodes-Extérieures", "Appenzell Rhodes-Intérieures",
    "Bâle-Campagne", "Bâle-Ville", "Berne", "Fribourg", "Genève",
    "Glaris", "Grisons", "Jura", "Lucerne", "Neuchâtel", "Nidwald",
    "Obwald", "Saint-Gall", "Schaffhouse", "Schwytz", "Soleure",
    "Tessin", "Thurgovie", "Uri", "Valais", "Vaud", "Zoug", "Zurich"
  ],
  Allemagne: [
    "Bade-Wurtemberg", "Bavière", "Berlin", "Brandebourg", "Brême",
    "Hambourg", "Hesse", "Mecklembourg-Poméranie-Occidentale",
    "Basse-Saxe", "Rhénanie-du-Nord-Westphalie", "Rhénanie-Palatinat",
    "Sarre", "Saxe", "Saxe-Anhalt", "Schleswig-Holstein", "Thuringe"
  ],
  Italie: [
    "Abruzzes", "Basilicate", "Calabre", "Campanie", "Émilie-Romagne",
    "Frioul-Vénétie Julienne", "Latium", "Ligurie", "Lombardie",
    "Marches", "Molise", "Piémont", "Pouilles", "Sardaigne",
    "Sicile", "Toscane", "Trentin-Haut-Adige", "Ombrie",
    "Vallée d'Aoste", "Vénétie"
  ]
};

function el(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showNotice(node, message, type) {
  if (!node) return;
  node.className = "notice " + (type || "success");
  node.textContent = message;
  node.classList.remove("hide");
}

function initRegionSelectors() {
  var countrySelect = document.querySelector('select[name="country"]');
  var regionSelect = document.querySelector('select[name="department"]');

  if (!countrySelect || !regionSelect) return;

  function refreshRegions() {
    var regions = REGIONS[countrySelect.value] || [];
    regionSelect.innerHTML = '<option value="">Choisir...</option>';

    for (var i = 0; i < regions.length; i++) {
      regionSelect.innerHTML +=
        '<option value="' + escapeHtml(regions[i]) + '">' +
        escapeHtml(regions[i]) +
        "</option>";
    }
  }

  countrySelect.addEventListener("change", refreshRegions);
  refreshRegions();
}

function initAudioControl() {
  var audio = el("backgroundMusic");
  var btn = el("soundToggle");

  if (!audio || !btn) return;

  audio.volume = 0.5;

  var isMuted = localStorage.getItem("monarch_audio_muted") === "true";

  if (isMuted) {
    btn.textContent = "🔇";
  } else {
    audio.play().catch(function () {});
    btn.textContent = "🔊";
  }

  btn.addEventListener("click", function () {
    if (audio.paused) {
      audio.play().catch(function () {});
      btn.textContent = "🔊";
      localStorage.setItem("monarch_audio_muted", "false");
    } else {
      audio.pause();
      btn.textContent = "🔇";
      localStorage.setItem("monarch_audio_muted", "true");
    }
  });
}

function initCookieBanner() {
  var choice = localStorage.getItem("monarch_cookie_choice");
  var banner = el("cookieBanner");

  if (!choice && banner) {
    banner.classList.remove("hide");
  }
}

// 🔥🔥🔥 VERSION FINALE DE callEdge AVEC HEADERS SUPABASE 🔥🔥🔥
function callEdge(fnName, body) {
  if (!cfg.EDGE_BASE_URL) {
    return Promise.reject(new Error("EDGE_BASE_URL non configuré"));
  }

  var url = cfg.EDGE_BASE_URL.replace(/\/$/, "") + "/" + fnName;

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + cfg.SUPABASE_ANON_KEY,
      "apikey": cfg.SUPABASE_ANON_KEY
    },
    body: JSON.stringify(body || {})
  }).then(function (res) {
    return res.text().then(function (text) {
      if (!text) {
        throw new Error("Réponse vide de Supabase Edge Function");
      }

      var data;

      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Réponse non JSON :", text);
        throw new Error("Réponse Supabase non valide");
      }

      if (!res.ok) {
        throw new Error(data.error || "Erreur " + fnName);
      }

      return data;
    });
  });
}

// Vérifie que l'utilisateur est connecté avant d'utiliser une fonctionnalité réservée aux membres.
// Affiche un message avec liens connexion/inscription si ce n'est pas le cas.
function requireLogin(container) {
  if (!supabaseClient) {
    return Promise.resolve(true);
  }

  return supabaseClient.auth.getSession().then(function (result) {
    var session = result.data && result.data.session;

    if (session) return true;

    if (container) {
      container.innerHTML =
        '<div class="notice error">Vous devez créer un compte gratuit ou vous connecter pour utiliser cette fonctionnalité. ' +
        '<a class="event-link" href="login.html">Connexion</a> · ' +
        '<a class="event-link" href="register.html">Inscription gratuite</a></div>';
    }

    return false;
  });
}

function formatEventDate(value) {
  if (!value) return "Date non précisée";

  var d = String(value).trim();

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;

  var parsed = new Date(d);

  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("fr-FR");
  }

  return d;
}

function getEventTimestamp(value) {
  if (!value) return 9999999999999;

  var d = String(value).trim();

  var matchFr = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (matchFr) {
    return new Date(
      Number(matchFr[3]),
      Number(matchFr[2]) - 1,
      Number(matchFr[1])
    ).getTime();
  }

  var parsed = new Date(d);
  if (!isNaN(parsed.getTime())) return parsed.getTime();

  return 9999999999999;
}

function getRegionFromEvent(ev, selectedDepartment) {
  if (selectedDepartment) return selectedDepartment;
  if (ev.venue_name) return ev.venue_name;
  return "Région non précisée";
}

function injectEventsJsonLd(events) {
  var today = new Date().toISOString().slice(0, 10);

  var items = events
    .filter(function (ev) {
      return ev.title && ev.event_date && ev.event_date >= today;
    })
    .slice(0, 20)
    .map(function (ev) {
      var item = {
        "@type": "Event",
        "name": ev.title,
        "startDate": ev.event_date,
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "eventStatus": "https://schema.org/EventScheduled",
        "location": {
          "@type": "Place",
          "name": ev.venue_name || ev.title,
          "address": ev.address || ev.venue_name || ev.country || "France"
        },
        "organizer": {
          "@type": "Organization",
          "name": "MONARCH SUPERCARS",
          "url": "https://www.monarch-apps.fr/"
        },
        "url": ev.external_url || "https://www.monarch-apps.fr/events.html"
      };

      if (ev.description) item.description = ev.description;

      var image = ev.poster_url || ev.image_url;
      if (image) item.image = [image];

      return item;
    });

  var script = document.getElementById("eventsJsonLd");

  if (!items.length) {
    if (script) script.remove();
    return;
  }

  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "eventsJsonLd";
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": items
  });
}

function initCommunityEvents() {
  var container = el("communityEventsResults");

  if (!container || !supabaseClient) return;

  supabaseClient
    .from("events")
    .select("*")
    .eq("status", "approved")
    .order("event_date", { ascending: true })
    .then(function (res) {
      var data = res.data || [];

      if (res.error || !data.length) {
        container.className = "notice";
        container.innerHTML = "Aucun événement publié pour le moment.";
        return;
      }

      var html = "";

      data.forEach(function (ev) {
        html += '<div class="event-card">';

        if (ev.poster_url) {
          html +=
            '<img class="poster" src="' +
            escapeHtml(ev.poster_url) +
            '" alt="' +
            escapeHtml(ev.title || "") +
            '" />';
        }

        html += "<h3>" + escapeHtml(ev.title || "Événement automobile") + "</h3>";

        if (ev.description) {
          html += "<p>" + escapeHtml(ev.description).replaceAll("\n", "<br>") + "</p>";
        }

        html += '<p class="event-meta"><strong>Lieu :</strong> ' + escapeHtml(ev.venue_name || ev.address || "-") + "</p>";
        html += '<p class="event-meta"><strong>Date :</strong> ' + formatEventDate(ev.event_date) + "</p>";

        if (ev.external_url) {
          html +=
            '<a class="event-link" target="_blank" href="' +
            escapeHtml(ev.external_url) +
            '">Plus d\'informations</a>';
        }

        html += "</div>";
      });

      container.className = "";
      container.innerHTML = html;
      injectEventsJsonLd(data);
    })
    .catch(function () {
      container.className = "notice error";
      container.innerHTML = "Impossible de charger les événements.";
    });
}

function initEventSearch() {
  var form = el("eventSearchForm");
  var results = el("eventsResults");

  if (!form || !results) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    requireLogin(results).then(function (allowed) {
      if (!allowed) return;

      results.innerHTML = '<div class="notice">Recherche en cours...</div>';

      var formData = new FormData(form);
      var country = formData.get("country");
      var department = formData.get("department");

      callEdge("ai-events-search", {
        country: country,
        department: department
      })
      .then(function (data) {
        var events = data.events || [];

        if (events.length === 0) {
          results.innerHTML =
            '<div class="notice warning">Aucun événement trouvé.</div>';
          return;
        }

        events.sort(function (a, b) {
          return getEventTimestamp(a.event_date) - getEventTimestamp(b.event_date);
        });

        var grouped = {};

        events.forEach(function (ev) {
          var region = getRegionFromEvent(ev, department);
          var date = formatEventDate(ev.event_date);

          if (!grouped[region]) grouped[region] = {};
          if (!grouped[region][date]) grouped[region][date] = [];

          grouped[region][date].push(ev);
        });

        var html = "";

        Object.keys(grouped).forEach(function (region) {
          html += '<div class="region-block">';
          html += '<h2 style="color:#d4af37;margin-top:30px;">📍 ' + escapeHtml(region) + '</h2>';

          var dates = Object.keys(grouped[region]).sort(function (a, b) {
            return getEventTimestamp(a) - getEventTimestamp(b);
          });

          dates.forEach(function (date) {
            html += '<h3 style="color:white;margin-top:20px;border-bottom:1px solid #333;padding-bottom:8px;">📅 ' + escapeHtml(date) + '</h3>';

            grouped[region][date].forEach(function (ev) {
              html += '<div class="event-card">';

              if (ev.poster_url) {
                html +=
                  '<img class="poster" src="' +
                  escapeHtml(ev.poster_url) +
                  '" alt="' +
                  escapeHtml(ev.title) +
                  '" />';
              }

              html += '<h3>' + escapeHtml(ev.title || "Événement automobile") + '</h3>';
              html += '<p>' + escapeHtml(ev.summary || "Description non disponible.") + '</p>';
              html += '<p><strong>Lieu :</strong> ' + escapeHtml(ev.venue_name || "-") + '</p>';
              html += '<p><strong>Date :</strong> ' + escapeHtml(date) + '</p>';

              if (ev.source_url) {
                html +=
                  '<a class="btn secondary" target="_blank" href="' +
                  escapeHtml(ev.source_url) +
                  '">Voir la source</a>';
              }

              html += '</div>';
            });
          });

          html += '</div>';
        });

        results.innerHTML = html;
      })
      .catch(function (err) {
        console.error(err);
        results.innerHTML =
          '<div class="notice error">' + escapeHtml(err.message) + '</div>';
      });
    });
  });
}

function initRegister() {
  var form = el("registerForm");

  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!supabaseClient) {
      showNotice(el("registerResult"), "Supabase non configuré", "error");
      return;
    }

    var formData = new FormData(form);
    var password = formData.get("password");
    var passwordConfirm = formData.get("password_confirm");

    if (passwordConfirm !== null && password !== passwordConfirm) {
      showNotice(el("registerResult"), "Les mots de passe ne correspondent pas.", "error");
      return;
    }

    var emailRedirectTo = window.location.href.replace(/register\.html.*$/, "login.html");

    supabaseClient.auth
      .signUp({
        email: formData.get("email"),
        password: password,
        options: {
          data: {
            full_name: formData.get("full_name")
          },
          emailRedirectTo: emailRedirectTo
        }
      })
      .then(function (result) {
        if (result.error) {
          showNotice(el("registerResult"), result.error.message, "error");
        } else {
          showNotice(el("registerResult"), "Compte créé avec succès ! Vérifiez vos emails pour confirmer votre adresse.");
        }
      });
  });
}

function initLogin() {
  var form = el("loginForm");

  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!supabaseClient) {
      showNotice(el("loginResult"), "Supabase non configuré", "error");
      return;
    }

    var formData = new FormData(form);

    supabaseClient.auth
      .signInWithPassword({
        email: formData.get("email"),
        password: formData.get("password")
      })
      .then(function (result) {
        if (result.error) {
          showNotice(el("loginResult"), result.error.message, "error");
        } else {
          showNotice(el("loginResult"), "Connexion réussie !");
        }
      });
  });
}

function initForgotPassword() {
  var toggle = el("forgotPasswordToggle");
  var form = el("forgotPasswordForm");

  if (!toggle || !form) return;

  toggle.addEventListener("click", function (e) {
    e.preventDefault();
    form.classList.toggle("hide");
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!supabaseClient) {
      showNotice(el("forgotPasswordResult"), "Supabase non configuré", "error");
      return;
    }

    var formData = new FormData(form);
    var redirectTo = window.location.href.replace(/login\.html.*$/, "reset-password.html");

    supabaseClient.auth
      .resetPasswordForEmail(formData.get("email"), { redirectTo: redirectTo })
      .then(function (result) {
        if (result.error) {
          showNotice(el("forgotPasswordResult"), result.error.message, "error");
        } else {
          showNotice(el("forgotPasswordResult"), "Email de réinitialisation envoyé. Vérifiez votre boîte de réception.");
          form.reset();
        }
      });
  });
}

function initResetPassword() {
  var form = el("resetPasswordForm");

  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!supabaseClient) {
      showNotice(el("resetPasswordResult"), "Supabase non configuré", "error");
      return;
    }

    var formData = new FormData(form);
    var password = formData.get("password");
    var passwordConfirm = formData.get("password_confirm");

    if (password !== passwordConfirm) {
      showNotice(el("resetPasswordResult"), "Les mots de passe ne correspondent pas.", "error");
      return;
    }

    supabaseClient.auth
      .updateUser({ password: password })
      .then(function (result) {
        if (result.error) {
          showNotice(el("resetPasswordResult"), result.error.message, "error");
        } else {
          showNotice(el("resetPasswordResult"), "Mot de passe mis à jour avec succès. Vous pouvez vous connecter.");
          form.reset();
        }
      });
  });
}

function initContact() {
  var form = el("contactForm");

  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var formData = new FormData(form);
    var data = {};

    formData.forEach(function (value, key) {
      data[key] = value;
    });

    callEdge("contact-intake", data)
      .then(function () {
        showNotice(el("contactResult"), "Message envoyé !");
        form.reset();
      })
      .catch(function (err) {
        showNotice(el("contactResult"), err.message, "error");
      });
  });
}

function initTranslateHint() {
  var btn = el("translateHintBtn");
  var panel = el("translateHintPanel");

  if (!btn || !panel) return;

  btn.addEventListener("click", function () {
    var isOpen = !panel.classList.contains("hide");
    panel.classList.toggle("hide");
    btn.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });

  document.addEventListener("click", function (e) {
    if (!panel.contains(e.target) && !btn.contains(e.target)) {
      panel.classList.add("hide");
      btn.setAttribute("aria-expanded", "false");
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  initAudioControl();
  initCookieBanner();
  initRegionSelectors();
  initCommunityEvents();
  initEventSearch();
  initRegister();
  initLogin();
  initForgotPassword();
  initResetPassword();
  initContact();
  initTranslateHint();
});