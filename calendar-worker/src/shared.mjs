export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function ensure(condition, status, message) { if (!condition) throw new HttpError(status, message); }
export const now = () => new Date().toISOString();
export const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join('');
export async function hash(text) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), x => x.toString(16).padStart(2, '0')).join('');
}
export const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function copenhagenDate(iso = now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
export function validDate(date) {
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(date))return false;
  const parsed=new Date(date+'T12:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===date;
}
export function validateEvent(input) {
  const result = {};
  for (const [key, limit, required] of [['title',100,true],['association',100,true],['date',10,true],['time',5,true],['endDate',10,false],['endTime',5,false],['location',180,true],['description',1500,false],['link',500,false]]) {
    const value = typeof input[key] === 'string' ? input[key].trim() : '';
    ensure(!required || value, 400, 'Udfyld navn, forening, dato, tidspunkt og sted.');
    ensure(value.length <= limit && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), 400, 'Et felt indeholder for meget tekst eller ugyldige tegn.');
    result[key] = value;
  }
  ensure(validDate(result.date), 400, 'Vælg en gyldig dato.');
  ensure(result.date >= copenhagenDate(), 400, 'Arrangementet skal ligge i dag eller senere.');
  ensure(result.date <= String(Number(copenhagenDate().slice(0,4))+3) + '-12-31', 400, 'Vælg en dato inden for de næste tre år.');
  ensure(/^([01]\d|2[0-3]):[0-5]\d$/.test(result.time), 400, 'Vælg et gyldigt tidspunkt.');
  ensure(!result.endDate || (validDate(result.endDate) && result.endDate >= result.date), 400, 'Slutdatoen skal være samme dag eller senere.');
  ensure(!result.endTime || /^([01]\d|2[0-3]):[0-5]\d$/.test(result.endTime), 400, 'Vælg et gyldigt sluttidspunkt.');
  ensure(!result.endTime || (result.endDate && result.endDate > result.date) || result.endTime > result.time, 400, 'Sluttidspunktet skal være efter starten.');
  if (result.link) {
    let url; try { url = new URL(result.link); } catch { throw new HttpError(400, 'Tilmeldingslinket skal være en hel webadresse.'); }
    ensure(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password, 400, 'Brug et almindeligt http- eller https-link.');
    result.link = url.href;
  }
  return result;
}
export function validateMonth(month) {
  ensure(/^20\d{2}-(0[1-9]|1[0-2])$/.test(month), 400, 'Vælg en gyldig måned.');
  return month;
}
export function period(month) {
  validateMonth(month);
  const [year, m] = month.split('-').map(Number);
  return { start: month + '-01', end: new Date(Date.UTC(year, m + 1, 0)).toISOString().slice(0,10), deadline: new Date(Date.UTC(year, m - 2, 15)).toISOString().slice(0,10) };
}
export function publicEvent(row) {
  const data = JSON.parse(row.published_json);
  return { id: row.id, ...data };
}
export function json(data, status = 200, extra = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', ...extra } });
}
