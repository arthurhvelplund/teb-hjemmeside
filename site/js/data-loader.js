/* TEB – data-loader.js
 * --------------------------------------------------------------
 * Lille script der henter indhold fra /data/*.json og indsætter
 * det i siden. Det betyder at redaktører kan rette fx bestyrelsen
 * via Decap CMS (admin-panelet) – uden at en udvikler skal røre HTML.
 *
 * Hvert renderXxx-kald er valgfrit: kører kun hvis sidens HTML
 * indeholder det rigtige mount-element (fx #bestyrelse-mount).
 * Det betyder at filen kan inkluderes på alle sider, men kun gør
 * noget på de sider hvor der faktisk er noget at rendere.
 * -------------------------------------------------------------- */
(function () {
  "use strict";

  var DATA_BASE = "data/"; // relativt til den side scriptet køres på

  function fetchJSON(name) {
    return fetch(DATA_BASE + name + ".json", { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("Kunne ikke hente " + name + ".json (" + r.status + ")");
        return r.json();
      });
  }

  // Sikker tekst-escape (vi indsætter brugerredigeret indhold)
  function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Formatér dansk telefonnummer til tel:-link (+45 + cifre)
  function telHref(phone) {
    if (!phone) return null;
    var digits = String(phone).replace(/[^0-9]/g, "");
    if (!digits) return null;
    if (digits.length === 8) digits = "45" + digits;
    return "tel:+" + digits;
  }

  // ---------- Bestyrelsen (om-foreningen.html) ----------
  function renderBestyrelse(data) {
    var grid = document.getElementById("bestyrelse-mount");
    if (!grid) return;

    var html = (data.members || []).map(function (m) {
      var contact = "";
      if (m.address || m.phone || m.email) {
        var parts = [];
        if (m.address) parts.push(esc(m.address));
        if (m.phone) {
          var tel = telHref(m.phone);
          parts.push(tel
            ? '<a href="' + tel + '">' + esc(m.phone) + "</a>"
            : esc(m.phone));
        }
        if (m.email) {
          parts.push('<a href="mailto:' + esc(m.email) + '">' + esc(m.email) + "</a>");
        }
        contact = '<div class="contact">' + parts.join("<br>") + "</div>";
      }
      return ''
        + '<div class="person">'
        +   '<span class="role">' + esc(m.role) + '</span>'
        +   '<h3>' + esc(m.name) + '</h3>'
        +   contact
        + '</div>';
    }).join("");
    grid.innerHTML = html;

    // Overskrift, underoverskrift og beskrivelse (valgfrit)
    var titleEl = document.querySelector("[data-bind='bestyrelse.title']");
    if (titleEl && data.subtitle) titleEl.textContent = data.subtitle;
    var descEl = document.querySelector("[data-bind='bestyrelse.description']");
    if (descEl && data.description) descEl.textContent = data.description;
    var eyebrowEl = document.querySelector("[data-bind='bestyrelse.eyebrow']");
    if (eyebrowEl && data.title) eyebrowEl.textContent = data.title;

    // Revisorer
    var revisorMount = document.getElementById("revisorer-mount");
    if (revisorMount) {
      var names = (data.auditors || []).map(function (a) { return esc(a.name); });
      revisorMount.innerHTML = names.join("<br>");
    }
  }

  // ---------- Repræsentanter (om-foreningen.html) ----------
  function renderRepraesentanter(data) {
    var mount = document.getElementById("repraesentanter-mount");
    if (!mount) return;
    var html = (data.items || []).map(function (it) {
      return "<strong>" + esc(it.body) + ":</strong> " + esc(it.persons);
    }).join("<br>");
    mount.innerHTML = html;
  }

  // ---------- Forside-tal (index.html) ----------
  function renderForside(data) {
    var b = document.querySelector("[data-bind='forside.borgere']");
    var v = document.querySelector("[data-bind='forside.virksomheder']");
    var a = document.querySelector("[data-bind='forside.aar']");
    if (b && data.borgere) b.textContent = data.borgere + " borgere";
    if (v && data.virksomheder) v.textContent = data.virksomheder + " virksomheder";
    if (a && data.aar) a.textContent = data.aar + " år i byens tjeneste";
  }

  // ---------- Indlæg / nyhedsfeed ----------
  // Formatér ISO-dato til "1. maj 2026"
  var DA_MONTHS = ["januar","februar","marts","april","maj","juni","juli","august","september","oktober","november","december"];
  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return esc(iso);
    return d.getDate() + ". " + DA_MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  // Lille markdown-til-HTML hvis marked-biblioteket er indlæst,
  // ellers en simpel fallback (linjeskift + paragrafer).
  function md(s) {
    if (!s) return "";
    if (typeof window.marked !== "undefined") {
      try { return window.marked.parse(String(s)); } catch (e) { /* fallthrough */ }
    }
    // Simpel fallback: split på dobbelt-linjeskift, escape, lav <p>.
    return String(s)
      .split(/\n\s*\n/)
      .map(function (para) { return "<p>" + esc(para).replace(/\n/g, "<br>") + "</p>"; })
      .join("");
  }

  // Sortér opslag efter dato (nyeste først)
  function sortByDate(items) {
    return (items || []).slice().sort(function (a, b) {
      return (b.date || "").localeCompare(a.date || "");
    });
  }

  // Lav en sluggified URL-streng til anker-links
  function slugify(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "aa")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Forsidens "Seneste nyt"-widget – viser de 3 nyeste opslag som teasere
  function renderSenesteNyt(data) {
    var mount = document.getElementById("seneste-nyt-mount");
    if (!mount) return;
    var items = sortByDate(data.items).slice(0, 3);
    if (items.length === 0) {
      mount.innerHTML = '<p style="opacity:0.7;">Ingen opslag endnu.</p>';
      return;
    }
    mount.innerHTML = items.map(function (it) {
      var img = it.image
        ? '<div class="post-card-img"><img src="' + esc(it.image) + '" alt=""></div>'
        : '';
      var summary = it.summary
        ? '<p>' + esc(it.summary) + '</p>'
        : '';
      var slug = slugify(it.title);
      return ''
        + '<a class="post-card" href="nyt.html#' + esc(slug) + '">'
        +   img
        +   '<div class="post-card-body">'
        +     '<span class="post-date">' + esc(formatDate(it.date)) + '</span>'
        +     '<h3>' + esc(it.title) + '</h3>'
        +     summary
        +     '<span class="arrow">Læs mere →</span>'
        +   '</div>'
        + '</a>';
    }).join("");
  }

  // /nyt.html – fuld liste af opslag
  function renderNytFeed(data) {
    var mount = document.getElementById("nyt-feed-mount");
    if (!mount) return;
    var items = sortByDate(data.items);
    if (items.length === 0) {
      mount.innerHTML = '<p style="opacity:0.7;">Der er ikke postet noget endnu. Kig forbi senere.</p>';
      return;
    }
    mount.innerHTML = items.map(function (it) {
      var slug = slugify(it.title);
      var img = it.image
        ? '<div class="post-img"><img src="' + esc(it.image) + '" alt=""></div>'
        : '';
      var author = it.author
        ? ' · <span class="post-author">' + esc(it.author) + '</span>'
        : '';
      return ''
        + '<article class="post" id="' + esc(slug) + '">'
        +   '<header>'
        +     '<span class="post-date">' + esc(formatDate(it.date)) + author + '</span>'
        +     '<h2>' + esc(it.title) + '</h2>'
        +   '</header>'
        +   img
        +   '<div class="post-body">' + md(it.body) + '</div>'
        + '</article>';
    }).join('<hr class="post-sep">');
  }

  // ---------- Kør de relevante render-funktioner ----------
  // Hver fetch-fejl logges men stopper ikke de andre.
  function safe(promiseFactory) {
    try {
      return promiseFactory().catch(function (err) { console.warn(err); });
    } catch (err) {
      console.warn(err);
      return Promise.resolve();
    }
  }

  if (document.getElementById("bestyrelse-mount")) {
    safe(function () { return fetchJSON("bestyrelsen").then(renderBestyrelse); });
  }
  if (document.getElementById("repraesentanter-mount")) {
    safe(function () { return fetchJSON("repraesentanter").then(renderRepraesentanter); });
  }
  if (document.querySelector("[data-bind^='forside.']")) {
    safe(function () { return fetchJSON("forside").then(renderForside); });
  }
  if (document.getElementById("seneste-nyt-mount") || document.getElementById("nyt-feed-mount")) {
    safe(function () {
      return fetchJSON("indlaeg").then(function (data) {
        renderSenesteNyt(data);
        renderNytFeed(data);
      });
    });
  }
})();
