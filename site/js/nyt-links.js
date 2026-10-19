// Keep earlier receipts and shared links usable after the calendar move.
const query = new URLSearchParams(location.search);
if (['privat', 'opslag', 'opret'].some(key => query.has(key)) || location.hash === '#godkendelse') {
 if (query.has('privat')) { query.set('indsendelse', query.get('privat')); query.delete('privat'); }
 location.replace('kalender.html' + (query.size ? '?' + query : '') + location.hash);
}
