import { EmailMessage } from "cloudflare:email";

const destination = "afhvelplund@gmail.com";
const sender = "formular@teb-tistrup.dk";
const allowedOrigin = "https://teb-tistrup.dk";

function clean(value, maxLength = 5000) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

function header(value) {
  return clean(value, 200).replace(/[\r\n]+/g, " ");
}

function encodedHeader(value) {
  const bytes = new TextEncoder().encode(header(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `=?UTF-8?B?${btoa(binary)}?=`;
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

function redirect(location) {
  return new Response(null, { status: 303, headers: { Location: location } });
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

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return error("Kun POST er tilladt.", 405);

    const origin = request.headers.get("Origin");
    if (origin !== allowedOrigin) return error("Ugyldig afsender.", 403);

    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.includes("application/x-www-form-urlencoded")) {
      return error("Ugyldigt formularformat.", 415);
    }

    const declaredLength = Number(request.headers.get("Content-Length") || 0);
    if (declaredLength > 20_000) return error("Formularen er for stor.", 413);

    const body = await request.text();
    if (body.length > 20_000) return error("Formularen er for stor.", 413);
    const form = new URLSearchParams(body);
    if (clean(form.get("website"), 200)) return redirect("/tak.html");

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

    const boundary = `teb-${crypto.randomUUID()}`;
    const html = `<html><body><h2>${htmlEscape(subject)}</h2><table>${rows}</table><p style="margin-top:24px;color:#666">Sendt fra formularen på teb-tistrup.dk</p></body></html>`;
    const raw = [
      `From: TEB Hjemmeside <${sender}>`,
      `To: ${destination}`,
      `Reply-To: ${header(email)}`,
      `Subject: ${encodedHeader(subject)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary=\"${boundary}\"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      `${subject}\n\n${rows.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")}`,
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "",
      html,
      `--${boundary}--`
    ].join("\r\n");

    await env.TEB_EMAIL.send(new EmailMessage(sender, destination, raw));
    return redirect("/tak.html");
  }
};
