const destination = "afhvelplund@gmail.com";
const sender = "formular@teb-tistrup.dk";
const allowedOrigin = "https://teb-tistrup.dk";
const minimumCompletionTimeMs = 3000;
const maximumCompletionTimeMs = 2 * 60 * 60 * 1000;

function clean(value, maxLength = 5000) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

function header(value) {
  return clean(value, 200).replace(/[\r\n]+/g, " ");
}

function htmlEscape(value) {
  return clean(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function redirect(location, messageId) {
  const headers = { Location: location };
  if (messageId) headers["X-TEB-Email-Id"] = messageId;
  return new Response(null, { status: 303, headers });
}

function error(message, status = 400) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

function fieldRow(label, value) {
  if (!value) return "";
  return `<tr><th align="left" style="padding:8px 16px 8px 0;vertical-align:top">${htmlEscape(label)}</th><td style="padding:8px 0">${htmlEscape(value).replace(/\n/g, "<br>")}</td></tr>`;
}

async function verifyTurnstile(token, ip, secret) {
  try {
    const verification = new FormData();
    verification.append("secret", secret);
    verification.append("response", token);
    if (ip) verification.append("remoteip", ip);

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: verification
    });
    if (!response.ok) return false;

    const result = await response.json();
    return result.success === true
      && result.hostname === "teb-tistrup.dk"
      && result.action === "formular";
  } catch (verificationError) {
    console.error("TEB Turnstile verification failed", verificationError);
    return false;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/formular") {
      return new Response("TEB formular version 3 er aktiv.", {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });
    }
    if (request.method === "GET" && url.pathname === "/api/formular/config") {
      const turnstileConfigured = Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);
      return Response.json(
        { turnstileSiteKey: turnstileConfigured ? env.TURNSTILE_SITE_KEY : "" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    if (request.method !== "POST") return error("Kun POST er tilladt.", 405);

    if (Boolean(env.TURNSTILE_SITE_KEY) !== Boolean(env.TURNSTILE_SECRET_KEY)) {
      return error("Formularens spamkontrol er ikke konfigureret korrekt.", 503);
    }

    const origin = request.headers.get("Origin");
    const referer = request.headers.get("Referer") || "";
    const fetchSite = request.headers.get("Sec-Fetch-Site");
    if (origin !== allowedOrigin) {
      return error("Ugyldig afsender.", 403);
    }
    if (referer && !referer.startsWith(`${allowedOrigin}/`)) return error("Ugyldig afsender.", 403);
    if (fetchSite && fetchSite !== "same-origin") return error("Ugyldig afsender.", 403);

    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.includes("application/x-www-form-urlencoded")) {
      return error("Ugyldigt formularformat.", 415);
    }

    const declaredLength = Number(request.headers.get("Content-Length") || 0);
    if (declaredLength > 20_000) return error("Formularen er for stor.", 413);

    const body = await request.text();
    if (body.length > 20_000) return error("Formularen er for stor.", 413);
    const form = new URLSearchParams(body);
    if (clean(form.get("website"), 200)) {
      return error("Din browser har udfyldt et skjult spamfelt. Gå tilbage, ryd formularen og prøv igen.");
    }

    const now = Date.now();
    const startedAt = Number(form.get("formular_startet"));
    const completionTime = now - startedAt;
    if (!Number.isFinite(startedAt) || completionTime < minimumCompletionTimeMs || completionTime > maximumCompletionTimeMs) {
      return error("Formularen blev sendt for hurtigt eller er udløbet. Genindlæs siden og prøv igen.", 400);
    }

    if (env.TURNSTILE_SECRET_KEY) {
      const token = clean(form.get("cf-turnstile-response"), 2048);
      const ip = request.headers.get("CF-Connecting-IP") || "";
      if (!token || !(await verifyTurnstile(token, ip, env.TURNSTILE_SECRET_KEY))) {
        return error("Spamkontrollen kunne ikke godkende indsendelsen. Prøv venligst igen.", 400);
      }
    }

    const type = clean(form.get("formular"), 30);
    const name = clean(form.get("navn"), 150);
    const email = clean(form.get("email"), 254);
    const phone = clean(form.get("tlf"), 50);
    const message = clean(form.get("besked"), 5000);

    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return error("Udfyld navn og en gyldig e-mailadresse.");
    }

    let subject;
    let rows;
    if (type === "kontakt") {
      if (!message) return error("Skriv venligst en besked.");
      subject = `Kontaktformular – ${header(form.get("emne")) || "TEB"}`;
      rows = [
        fieldRow("Navn", name),
        fieldRow("E-mail", email),
        fieldRow("Telefon", phone),
        fieldRow("Emne", clean(form.get("emne"), 200)),
        fieldRow("Besked", message)
      ].join("");
    } else if (type === "indmeldelse") {
      const address = clean(form.get("adresse"), 300);
      const membership = clean(form.get("medlemstype"), 200);
      if (!address || !membership) return error("Udfyld adresse og medlemstype.");
      subject = `Ny indmeldelse – ${header(name)}`;
      rows = [
        fieldRow("Navn", name),
        fieldRow("Adresse", address),
        fieldRow("E-mail", email),
        fieldRow("Telefon", phone),
        fieldRow("Medlemstype", membership),
        fieldRow("Besked", message)
      ].join("");
    } else {
      return error("Ukendt formular.");
    }

    const html = `<html><body><h2>${htmlEscape(subject)}</h2><table>${rows}</table><p style="margin-top:24px;color:#666">Sendt fra formularen på teb-tistrup.dk</p></body></html>`;
    const text = `${subject}\n\n${rows.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")}`;

    try {
      const result = await env.TEB_EMAIL.send({
        from: { email: sender, name: "TEB Hjemmeside" },
        to: destination,
        replyTo: email,
        subject,
        html,
        text
      });
      if (!result?.messageId) {
        throw new Error("Cloudflare Email Sending returnerede ikke et messageId.");
      }
      console.log(JSON.stringify({ event: "teb_form_email_accepted", messageId: result.messageId, type }));
      return redirect("/tak.html", result.messageId);
    } catch (sendError) {
      console.error("TEB form email failed", sendError);
      return error("E-mailafsendelsen mislykkedes. Skriv direkte til afhvelplund@gmail.com.", 503);
    }
  }
};
