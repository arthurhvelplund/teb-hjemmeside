import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

function request(fields, headers = {}) {
  const body = new URLSearchParams({
    formular: "kontakt",
    formular_startet: String(Date.now() - 5000),
    website: "",
    navn: "Testperson",
    email: "test@example.com",
    besked: "Dette er en rigtig testbesked.",
    ...fields
  });

  return new Request("https://teb-tistrup.dk/api/formular", {
    method: "POST",
    headers: {
      Origin: "https://teb-tistrup.dk",
      Referer: "https://teb-tistrup.dk/kontakt.html",
      "Sec-Fetch-Site": "same-origin",
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers
    },
    body
  });
}

function environment() {
  return {
    TEB_EMAIL: {
      async send() {
        return { messageId: "test-message-id" };
      }
    }
  };
}

test("accepterer en normalt udfyldt kontaktformular", async () => {
  const response = await worker.fetch(request(), environment());
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), "/tak.html");
});

test("afviser honeypot-spam", async () => {
  const response = await worker.fetch(request({ website: "https://spam.example" }), environment());
  assert.equal(response.status, 400);
});

test("afviser formularer sendt øjeblikkeligt", async () => {
  const response = await worker.fetch(request({ formular_startet: String(Date.now()) }), environment());
  assert.equal(response.status, 400);
});

test("afviser indsendelser uden korrekt henvisningsside", async () => {
  const response = await worker.fetch(request({}, { Referer: "https://spam.example/" }), environment());
  assert.equal(response.status, 403);
});

test("kræver Turnstile-token når en hemmelig nøgle er konfigureret", async () => {
  const env = environment();
  env.TURNSTILE_SITE_KEY = "site-key";
  env.TURNSTILE_SECRET_KEY = "secret";
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 400);
});

test("udleverer den offentlige Turnstile-nøgle til formularsiden", async () => {
  const response = await worker.fetch(
    new Request("https://teb-tistrup.dk/api/formular/config"),
    { TURNSTILE_SITE_KEY: "site-key", TURNSTILE_SECRET_KEY: "secret" }
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { turnstileSiteKey: "site-key" });
});

test("aktiverer ikke Turnstile hvis kun én nøgle er konfigureret", async () => {
  const configResponse = await worker.fetch(
    new Request("https://teb-tistrup.dk/api/formular/config"),
    { TURNSTILE_SITE_KEY: "site-key" }
  );
  assert.deepEqual(await configResponse.json(), { turnstileSiteKey: "" });

  const submitResponse = await worker.fetch(request(), {
    ...environment(),
    TURNSTILE_SITE_KEY: "site-key"
  });
  assert.equal(submitResponse.status, 503);
});
