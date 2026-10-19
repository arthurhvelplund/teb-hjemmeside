const pptxgen = require("pptxgenjs");
const { applyTheme } = require("/Users/marinushvelplund/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/c8609a1d-f6aa-4938-8609-ed74eba60b1b/ced99549-67dd-40e8-9bf6-140b5088d062/skills/pptx/scripts/apply_theme.js");

const THEME = { name: "TEB Tistrup", headFontFace: "Cambria", bodyFontFace: "Calibri",
  colors: { dk1:"1C1D18", lt1:"FFFFFF", dk2:"243B2B", lt2:"F6F1E4", accent1:"C45A3B", accent2:"3D6048", accent3:"8A9A6F", accent4:"A8C3C9", accent5:"E9B99F", accent6:"5B5A4F", hlink:"C45A3B", folHlink:"5B5A4F" } };

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Ét Tistrup – fælles kommunikation";
pres.author = "TEB";
const C = pres.SchemeColor;

pres.defineSlideMaster({ title: "MORK", background: { color: "243B2B" },
  objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.8, y: 2.3, w: 11.7, h: 2.2, fontSize: 48, bold: true, color: "FFFFFF", fontFace: "Cambria", valign: "middle", margin: 0 }, text: "" } }] });
pres.defineSlideMaster({ title: "LYS", background: { color: "F6F1E4" }, slideNumber: { x: 12.3, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: "5B5A4F", fontFace: "Calibri" },
  objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.7, y: 0.45, w: 11.9, h: 1.0, fontSize: 36, bold: true, color: "243B2B", fontFace: "Cambria", valign: "middle", margin: 0 }, text: "" } }] });

const T = (s, t) => s.addText(t, { placeholder: "title" });
const txt = (s, t, o) => s.addText(t, Object.assign({ isTextBox: true, fontFace: "Calibri", fontSize: 18, color: "1C1D18", margin: 0, valign: "top" }, o));
const bullets = (arr, o = {}) => arr.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < arr.length - 1, paraSpaceAfter: 8, ...o } }));
let sec = null;
const section = t => { sec = t; pres.addSection({ title: t }); };
const slide = (m, n) => { const s = pres.addSlide({ masterName: m, sectionTitle: sec }); if (n) s.addNotes(n); return s; };

// Dark divider/statement slide
function dark(title, sub, notes) {
  const s = slide("MORK", notes); T(s, title);
  if (sub) txt(s, sub, { x: 0.8, y: 4.7, w: 11.0, h: 1.2, fontSize: 22, color: "E9B99F" });
  return s;
}
// Screenshot placeholder
function shot(s, x, y, w, h, label) {
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: "FFFFFF" }, line: { color: "8A9A6F", width: 1.5, dashType: "dash" }, objectName: "Screenshot-pladsholder" });
  txt(s, [{ text: "Indsæt screenshot", options: { bold: true, breakLine: true, fontSize: 16, color: "3D6048" } }, { text: label, options: { fontSize: 14, color: "5B5A4F" } }], { x, y, w, h, align: "center", valign: "middle" });
}
// Channel slide
function channel(kat, navn, url, beskriv, notes) {
  const s = slide("LYS", notes); T(s, navn);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 1.7, w: 2.4, h: 0.42, rectRadius: 0.2, fill: { color: "C45A3B" }, objectName: "Kategori" });
  txt(s, kat, { x: 0.7, y: 1.7, w: 2.4, h: 0.42, fontSize: 13, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
  txt(s, beskriv, { x: 0.7, y: 2.5, w: 4.6, h: 2.2, fontSize: 18 });
  txt(s, [{ text: "Styrke: ", options: { bold: true, color: "3D6048" } }, { text: "udfyldes", options: { color: "5B5A4F", breakLine: true } },
          { text: "Svaghed: ", options: { bold: true, color: "C45A3B" } }, { text: "udfyldes", options: { color: "5B5A4F" } }], { x: 0.7, y: 5.2, w: 4.6, h: 1.2, fontSize: 16, paraSpaceAfter: 6 });
  shot(s, 5.8, 1.7, 6.8, 4.9, url);
  return s;
}
// Cards helper
function cards(s, items, y, h, fills) {
  const n = items.length, gap = 0.35, w = (11.9 - gap * (n - 1)) / n;
  items.forEach((it, i) => {
    const x = 0.7 + i * (w + gap);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fills ? fills[i] : "FFFFFF" }, line: { color: "D9CFB8", width: 1 }, objectName: "Kort " + (i + 1) });
    txt(s, [{ text: it[0], options: { bold: true, fontSize: 22, fontFace: "Cambria", color: fills ? "FFFFFF" : "243B2B", breakLine: true, paraSpaceAfter: 8 } }, { text: it[1], options: { fontSize: 16, color: fills ? "FFFFFF" : "1C1D18" } }], { x: x + 0.3, y: y + 0.3, w: w - 0.6, h: h - 0.6 });
  });
}

// ---------- DEL 1 ----------
section("1. Problemet");
dark("Ét Tistrup – ét sted at finde ud af, hvad der sker", "Tistrup Erhvervs- og Borgerforening (TEB)", "Velkomst. Kort: vi har et fælles problem, og vi vil gerne løse det sammen med jer.");
{ const s = slide("LYS", "Understreg at det ikke er TEB's mening – det er jeres. Vi har lyttet i hele 2025/26.");
  T(s, "Vi har lyttet");
  txt(s, "6", { x: 0.7, y: 1.8, w: 4.2, h: 2.6, fontSize: 150, bold: true, fontFace: "Cambria", color: "C45A3B", valign: "middle" });
  txt(s, "BID- og udviklingsmøder i 2025/2026", { x: 0.7, y: 4.5, w: 4.2, h: 1.0, fontSize: 22, color: "243B2B", bold: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.6, y: 1.9, w: 7.0, h: 3.9, rectRadius: 0.12, fill: { color: "243B2B" }, objectName: "Citat" });
  txt(s, [{ text: "Den gennemgående efterspørgsel på alle møder:", options: { fontSize: 18, color: "E9B99F", breakLine: true, paraSpaceAfter: 14 } }, { text: "”Vi har et problem med kommunikation i Tistrup.”", options: { fontSize: 32, bold: true, fontFace: "Cambria", color: "FFFFFF" } }], { x: 6.0, y: 2.3, w: 6.2, h: 3.1, valign: "middle" }); }
{ const s = slide("LYS", "Stil spørgsmålet højt og vent. Lad 3-4 personer svare. Pointen er, at svarene er forskellige.");
  T(s, "Som borger: hvor går du hen for at se, hvad der sker?");
  txt(s, "?", { x: 0.7, y: 1.7, w: 5.0, h: 4.8, fontSize: 280, bold: true, fontFace: "Cambria", color: "C45A3B", align: "center", valign: "middle" });
  txt(s, bullets(["Facebook?", "En hjemmeside?", "Opslagstavlen ved Brugsen?", "En ven?"], { fontSize: 28 }), { x: 6.2, y: 2.2, w: 6.4, h: 3.0 });
  txt(s, "Vi var uenige om svaret. Det var meget spredt.", { x: 6.2, y: 5.4, w: 6.4, h: 1.0, fontSize: 20, bold: true, color: "243B2B" }); }
{ const s = slide("LYS", "Samme øvelse, nu fra afsendersiden. Mange har en favorit – men ikke den samme.");
  T(s, "Som forening: hvor deler du dit arrangement?");
  txt(s, "Og hvem skal du kontakte for at komme med?", { x: 0.7, y: 1.7, w: 11.9, h: 0.6, fontSize: 22, color: "5B5A4F" });
  cards(s, [["Facebook", "Egen side eller gruppe"], ["Lokalavis", "Send til en redaktør"], ["Hjemmesider", "Send til flere forskellige"], ["Fysisk", "Flyers, tavler, lygtepæle"]], 2.8, 2.6, ["3D6048", "243B2B", "3D6048", "243B2B"]);
  txt(s, "Mange har deres fortrukne. Vi er ikke alle enige.", { x: 0.7, y: 5.9, w: 11.9, h: 0.7, fontSize: 22, bold: true, color: "C45A3B" }); }
{ const s = slide("LYS", "Overgang: nu viser vi, hvad vi fandt. Lad det gå hurtigt – hver kanal får ca. 10 sekunder.");
  T(s, "Så vi kortlagde alle kanaler. Advarsel: listen er lang");
  const k = [["Kommunalt", "3"], ["Lokale hjemmesider", "6+"], ["Facebook", "5"], ["Fysiske steder", "5"], ["Foreningernes egne", "?"]];
  const gap = 0.3, w = (11.9 - gap * 4) / 5;
  k.forEach((c, i) => { const x = 0.7 + i * (w + gap);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.3, w, h: 3.2, rectRadius: 0.12, fill: { color: i === 4 ? "C45A3B" : "FFFFFF" }, line: { color: "D9CFB8", width: 1 }, objectName: "Kategori " + (i + 1) });
    txt(s, c[1], { x, y: 2.5, w, h: 1.5, fontSize: 64, bold: true, fontFace: "Cambria", color: i === 4 ? "FFFFFF" : "C45A3B", align: "center", valign: "middle" });
    txt(s, c[0], { x: x + 0.2, y: 4.1, w: w - 0.4, h: 1.2, fontSize: 18, bold: true, color: i === 4 ? "FFFFFF" : "243B2B", align: "center" }); });
  txt(s, "Tal for kommunalt, hjemmesider, Facebook og fysiske steder er antal slides i gennemgangen. Rettes, hvis vi har glemt nogen.", { x: 0.7, y: 5.9, w: 11.9, h: 0.7, fontSize: 14, color: "5B5A4F" }); }

// ---------- DEL 2 ----------
section("2. Kanalerne");
channel("Kommunalt", "Fællesskaber Varde", "fællesskabervarde.dk – aktiviteter", "Varde Kommunes platform for foreninger og aktiviteter.");
channel("Kommunalt", "Pulsen i Vest", "pulsenivest.dk – kalender", "Regional kalender og nyheder for Vestjylland.");
channel("Kommunalt", "Ruban.nu", "ruban.nu", "Kommunal kanal vi også skal forholde os til.");
channel("Lokal hjemmeside", "Tistrupnyt.dk", "tistrupnyt.dk", "Lokale nyheder fra Tistrup.");
channel("Lokal hjemmeside", "Tistrupnews.dk", "tistrupnews.dk", "Endnu en lokal nyhedsside for Tistrup.");
channel("Lokal hjemmeside", "tistrupby.dk", "tistrupby.dk", "Hjemmeside om Tistrup by.");
channel("Lokal hjemmeside", "vores-tistrup.dk", "vores-tistrup.dk", "Lokal side for borgere i Tistrup.");
{ const s = channel("Lokal hjemmeside", "localnews.dk, Hodde og Ølgod", "localnews.dk + nabobyernes sider", "Lokalnyheder samt tilsvarende sider i nabobyerne – og flere til."); }
channel("Facebook-grupper", "Tre grupper", "Skærmbillede af hver gruppe", "Info – til og fra Tistrup. Os der bor i Tistrup og Hodde. Tistrup – fællesskab og dialog (TEB).");
channel("Facebook-sider", "Tistrup Nyt og TEB", "Skærmbillede af begge sider", "Tistrup Nyt og Tistrup Erhvervs- og Borgerforening.");
channel("Fysisk", "Flyers og byportaler", "Foto af flyer og byportal", "Uddeling af flyers til postkasser og de analoge byportaler.");
channel("Fysisk", "Infoskærme, tavler og lygtepæle", "Foto af skærm, tavle og lygtepæl", "Infoskærme, opslagstavler og lygtepæle i byen.");
{ const s = slide("LYS", "Her kender vi ikke det fulde antal endnu – det finder vi ud af. Sig 'mange'. Vis en collage.");
  T(s, "Og så alle foreningernes egne hjemmesider og Facebook-sider");
  const n = 8, cols = 4, gap = 0.25, w = (11.9 - gap * 3) / 4, h = 2.0;
  for (let i = 0; i < n; i++) { const x = 0.7 + (i % cols) * (w + gap), y = 1.8 + Math.floor(i / cols) * (h + gap);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: "FFFFFF" }, line: { color: "8A9A6F", width: 1, dashType: "dash" }, objectName: "Collage " + (i + 1) });
    txt(s, "Udklip " + (i + 1), { x, y, w, h, fontSize: 14, color: "5B5A4F", align: "center", valign: "middle" }); }
  txt(s, "[Antal] hjemmesider og Facebook-sider – endnu ikke talt op", { x: 0.7, y: 6.4, w: 11.9, h: 0.5, fontSize: 18, bold: true, color: "C45A3B" }); }
dark("Det kan simpelthen ikke passe", "Hver kilde har sine styrker og svagheder – men samlet er det uoverskueligt.", "Pause her. Lad billedet fra collagen sidde.");
{ const s = slide("LYS", "Brug det ærligt: vi ville invitere jer alle, men kunne ikke finde en opdateret liste nogen steder.");
  T(s, "Bonus: ingen har en opdateret foreningsliste");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 1.9, w: 5.6, h: 4.3, rectRadius: 0.12, fill: { color: "FFFFFF" }, line: { color: "D9CFB8", width: 1 }, objectName: "Kort" });
  txt(s, bullets(["Vi ville invitere jer alle til mødet", "Men fandt ingen opdateret liste over foreninger", "Hverken hos kommunen, på nettet eller hos os"], { fontSize: 20 }), { x: 1.0, y: 2.2, w: 5.0, h: 3.6 });
  txt(s, "Beklager, hvis du er en af dem, vi missede.", { x: 6.9, y: 2.2, w: 5.7, h: 2.0, fontSize: 32, bold: true, fontFace: "Cambria", color: "C45A3B", valign: "middle" });
  txt(s, "Det er selve problemet: hvis vi ikke kan finde jer, kan borgerne det heller ikke.", { x: 6.9, y: 4.5, w: 5.7, h: 1.4, fontSize: 18, color: "243B2B" }); }

// ---------- DEL 3 ----------
section("3. Løsningen");
dark("Så vi gør noget ved det", "TEB som paraply: alle kanaler består, men peger mod ét sted.", "Understreg: vi bygger ikke en ny konkurrent. Alle kan bruge deres egne kanaler som i dag.");
{ const s = slide("LYS", "Tre dele. Erhverv holdes ude af dette møde.");
  T(s, "Tre dele på den nye hjemmeside");
  cards(s, [["Foreninger", "Oversigt over alle foreninger, og jeres egen portal med login."], ["Kalender", "Vores egen fælles aktivitetskalender – her opretter I selv."], ["Det sker", "Overblik over alt det eksterne, vi linker ud til."]], 1.9, 4.3, ["243B2B", "C45A3B", "3D6048"]); }
{ const s = slide("LYS", "Her løser vi bonusproblemet: en levende foreningsliste, hvor foreningen selv holder oplysningerne ved lige.");
  T(s, "Foreninger: én opdateret liste");
  txt(s, bullets(["Søgbar oversigt over alle foreninger", "Basale oplysninger og formand", "Foreningen holder selv sine oplysninger opdateret"], { fontSize: 22 }), { x: 0.7, y: 1.9, w: 5.2, h: 4.5 });
  shot(s, 6.4, 1.9, 6.2, 4.5, "Foreningsoversigten på hjemmesiden"); }
{ const s = slide("LYS", "Ingen adgangskode: man skriver sin e-mail og får en engangskode. Enkelt for alle.");
  T(s, "Foreninger: jeres egen portal");
  const st = [["1", "Skriv din e-mail"], ["2", "Få en engangskode"], ["3", "Log ind"]];
  st.forEach((x, i) => { const cx = 0.7 + i * 2.55;
    s.addShape(pres.shapes.OVAL, { x: cx, y: 1.9, w: 0.9, h: 0.9, fill: { color: "C45A3B" }, objectName: "Trin " + x[0] });
    txt(s, x[0], { x: cx, y: 1.9, w: 0.9, h: 0.9, fontSize: 28, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
    txt(s, x[1], { x: cx - 0.2, y: 2.95, w: 2.3, h: 0.9, fontSize: 18, bold: true, color: "243B2B", align: "center" }); });
  txt(s, [{ text: "I portalen kan I:", options: { bold: true, breakLine: true, fontSize: 20, color: "243B2B", paraSpaceAfter: 8 } }, ...bullets(["Redigere jeres profil, billeder og links", "Se hvem der har adgang, og hvem der er formand", "Se og oprette jeres arrangementer"], { fontSize: 18 })], { x: 0.7, y: 4.2, w: 6.5, h: 2.5 });
  shot(s, 7.9, 1.9, 4.7, 4.6, "Foreningsportalen"); }
{ const s = slide("LYS", "Her ejer vi ikke indholdet – vi linker ud så godt vi kan. Alle kan stadig bruge de kanaler, de kender.");
  T(s, "Det sker: det eksterne samlet ét sted");
  txt(s, "Det, vi ikke selv er herre over. Vi linker ud.", { x: 0.7, y: 1.6, w: 11.9, h: 0.5, fontSize: 20, color: "5B5A4F" });
  const it = ["TEB's Facebook-opslag", "Fællesskaber Varde", "Pulsen i Vest", "Tistrup Nyt", "Tistrup News og Tistrup By", "Facebook-sider og -grupper"];
  it.forEach((t, i) => { const x = 0.7 + (i % 3) * 4.1, y = 2.5 + Math.floor(i / 3) * 1.9;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 3.8, h: 1.6, rectRadius: 0.12, fill: { color: "FFFFFF" }, line: { color: "D9CFB8", width: 1 }, objectName: "Link " + (i + 1) });
    txt(s, t, { x: x + 0.3, y, w: 3.2, h: 1.6, fontSize: 20, bold: true, color: "243B2B", valign: "middle" }); }); }
{ const s = slide("LYS", "Det er den vigtigste slide. Før: send til andre og vent. Nu: opret selv, ét sted.");
  T(s, "Hvorfor vores egen kalender?");
  const col = (x, head, col1, arr) => { s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.8, w: 5.8, h: 4.7, rectRadius: 0.12, fill: { color: col1 }, objectName: head });
    txt(s, [{ text: head, options: { bold: true, fontSize: 26, fontFace: "Cambria", color: "FFFFFF", breakLine: true, paraSpaceAfter: 14 } }, ...bullets(arr, { fontSize: 20, color: "FFFFFF" })], { x: x + 0.4, y: 2.2, w: 5.0, h: 4.0 }); };
  col(0.7, "Før", "5B5A4F", ["Man sendte sit arrangement til andre", "Tistrup Nyt eller andre sider oprettede det", "Man ventede og håbede"]);
  col(6.8, "Nu", "C45A3B", ["Du opretter selv dit arrangement", "Det vises på ét fælles sted", "Og kan komme ud i de analoge kanaler"]); }
{ const s = slide("LYS", "Ét arrangement ind, mange kanaler ud. Det er værdien. Understreg at det også er de analoge.");
  T(s, "Ét arrangement. Mange kanaler");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 2.8, w: 3.2, h: 2.0, rectRadius: 0.12, fill: { color: "C45A3B" }, objectName: "Input" });
  txt(s, "Du opretter ét arrangement", { x: 0.9, y: 2.8, w: 2.8, h: 2.0, fontSize: 22, bold: true, color: "FFFFFF", valign: "middle", align: "center" });
  const out = ["Digital kalender", "Flyers til postkasser", "Byportaler", "Infoskærme", "Opslagstavler", "Lygtepæle"];
  out.forEach((t, i) => { const y = 1.7 + i * 0.85;
    s.addShape(pres.shapes.LINE, { x: 3.9, y: Math.min(3.8, y + 0.33), w: 4.3, h: Math.max(0.001, Math.abs(y + 0.33 - 3.8)), line: { color: "8A9A6F", width: 1.5 }, flipV: y + 0.33 < 3.8, objectName: "Linje " + (i + 1) });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.2, y, w: 4.4, h: 0.66, rectRadius: 0.1, fill: { color: i === 0 ? "243B2B" : "3D6048" }, objectName: "Kanal " + (i + 1) });
    txt(s, t, { x: 8.4, y, w: 4.0, h: 0.66, fontSize: 18, bold: true, color: "FFFFFF", valign: "middle" }); }); }
{ const s = slide("LYS", "Digital kalender i uge- eller månedsvisning, inspireret af Pulsen i Vest. Analog oversigt pr. kvartal – endnu ikke besluttet.");
  T(s, "Kalender: digital og analog");
  txt(s, [{ text: "Digital", options: { bold: true, fontSize: 22, color: "243B2B", breakLine: true, paraSpaceAfter: 8 } }, ...bullets(["Uge- eller månedsvisning", "Inspireret af Pulsen i Vest"], { fontSize: 18 }),
          { text: " ", options: { breakLine: true } }, { text: "Analog", options: { bold: true, fontSize: 22, color: "243B2B", breakLine: true, paraSpaceAfter: 8 } }, ...bullets(["Enklere design til print", "Samlet oversigt hvert kvartal (ikke besluttet endnu)"], { fontSize: 18 })], { x: 0.7, y: 1.9, w: 4.8, h: 4.8 });
  shot(s, 6.0, 1.9, 6.6, 4.6, "Kalender-prototypen"); }
{ const s = slide("LYS", "Logget ind: opret frit. Ikke logget ind: TEB godkender via e-mail.");
  T(s, "Sådan opretter du et arrangement");
  const mk = (x, head, fill, arr) => { s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.9, w: 5.8, h: 4.2, rectRadius: 0.12, fill: { color: fill }, objectName: head });
    txt(s, [{ text: head, options: { bold: true, fontSize: 26, fontFace: "Cambria", color: "FFFFFF", breakLine: true, paraSpaceAfter: 14 } }, ...bullets(arr, { fontSize: 20, color: "FFFFFF" })], { x: x + 0.4, y: 2.3, w: 5.0, h: 3.5 }); };
  mk(0.7, "Logget ind", "3D6048", ["Opret frit så mange, du vil", "Kommer direkte på kalenderen"]);
  mk(6.8, "Ikke logget ind", "243B2B", ["Send arrangementet ind", "TEB får en e-mail og godkender", "Derefter kommer det på kalenderen"]); }

// ---------- DEL 4 ----------
section("4. Afslutning");
{ const s = slide("LYS", "Hold det konkret og kort. Hvert punkt er en gevinst for dem selv.");
  T(s, "Hvad får I ud af det?");
  cards(s, [["Mindre arbejde", "Opret ét sted i stedet for at sende til mange."], ["Mere synlighed", "Ud i både digitale og analoge kanaler."], ["Overblik", "Se alt, hvad der sker i Tistrup, ét sted."]], 1.9, 4.2, ["243B2B", "C45A3B", "3D6048"]); }
{ const s = slide("LYS", "Slut med en konkret opfordring og en dato. Sæt dato på inden mødet.");
  T(s, "Næste skridt");
  const st = [["1", "Registrer jeres forening", "Navn, kontaktperson og formand"], ["2", "Log ind med e-mail", "Tjek at profilen er rigtig"], ["3", "Opret jeres første arrangement", "Så ser vi det i kalenderen"]];
  st.forEach((x, i) => { const y = 1.9 + i * 1.45;
    s.addShape(pres.shapes.OVAL, { x: 0.7, y, w: 1.0, h: 1.0, fill: { color: "C45A3B" }, objectName: "Trin " + x[0] });
    txt(s, x[0], { x: 0.7, y, w: 1.0, h: 1.0, fontSize: 32, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
    txt(s, [{ text: x[1], options: { bold: true, fontSize: 24, color: "243B2B", breakLine: true } }, { text: x[2], options: { fontSize: 18, color: "5B5A4F" } }], { x: 2.0, y, w: 10.5, h: 1.0, valign: "middle" }); });
  txt(s, "Frist: [dato]", { x: 0.7, y: 6.3, w: 11.9, h: 0.5, fontSize: 20, bold: true, color: "C45A3B" }); }
dark("Og på sigt: en Tistrup-app?", "Bare en idé – men samme data kan også ligge i lommen.", "Kort afrunding. Ikke noget vi skal beslutte i dag.");

(async () => { await pres.writeFile({ fileName: "TEB-praesentation.pptx" }); await applyTheme("TEB-praesentation.pptx", THEME); console.log("ok"); })();
