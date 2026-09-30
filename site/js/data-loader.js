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
    if (titleEl && data.subtitle) {
      titleEl.textContent = data.subtitle.replace(/^Syv mennesker/, "Ni mennesker");
    }
    var descEl = document.querySelector("[data-bind='bestyrelse.description']");
    if (descEl && data.description) {
      descEl.textContent = data.description.replace("består af 7 medlemmer", "består af 9 medlemmer");
    }
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
})();
