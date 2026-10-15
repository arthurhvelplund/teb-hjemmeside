(function () {
  'use strict';
  var form = document.getElementById('activity-form');
  if (!form) return;
  var receipt = document.getElementById('activity-receipt');
  var emailLink = document.getElementById('send-activity-email');
  var defaultEmailLink = emailLink.getAttribute('href');
  var textFields = ['title', 'association', 'location'];
  function field(name) { return form.elements.namedItem(name); }
  function value(name) { return field(name).value.trim(); }
  function updatePreview() {
    function write(id, text) { document.getElementById(id).textContent = text; }
    var date = value('date') ? new Date(value('date') + 'T12:00:00') : null;
    document.getElementById('preview-day').hidden = !date;
    write('preview-day', date ? String(date.getDate()) : '');
    write('preview-month', date ? new Intl.DateTimeFormat('da-DK', { month: 'short' }).format(date).replace('.', '') : 'Din dato');
    var dateText = date ? new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'long', year: 'numeric' }).format(date) : '';
    write('preview-time', [dateText, value('time') ? 'kl. ' + value('time') : ''].filter(Boolean).join(' · ') || 'Dato og tid');
    write('preview-title', value('title') || 'Jeres næste arrangement');
    write('preview-location', value('location') || 'Sted og adresse');
    write('preview-description', value('description') || 'Her står lidt om arrangementet.');
    write('preview-association', value('association') || 'Jeres forening');
  }
  function validateText(input) {
    input.setCustomValidity(input.value.trim() ? '' : 'Skriv venligst i dette felt.');
  }
  function updateEmail() {
    var lines = [
      ['Arrangement', value('title')],
      ['Forening', value('association')],
      ['Dato', value('date')],
      ['Klokken', value('time')],
      ['Sted', value('location')],
      ['Beskrivelse', value('description')],
      ['Kontakt', value('email')]
    ].filter(function (entry) { return entry[1]; });
    emailLink.href = lines.length ? 'mailto:tistrup.kalender@gmail.com?subject=' + encodeURIComponent('Arrangement til kalenderen' + (value('title') ? ': ' + value('title') : '')) + '&body=' + encodeURIComponent(lines.map(function (entry) { return entry[0] + ': ' + entry[1]; }).join('\n')) : defaultEmailLink;
  }
  form.addEventListener('input', function (event) {
    if (textFields.includes(event.target.name)) validateText(event.target);
    updateEmail();
    updatePreview();
  });
  form.addEventListener('change', function () { updateEmail(); updatePreview(); });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    textFields.forEach(function (name) { validateText(field(name)); });
    if (!form.reportValidity()) return;
    updateEmail();
    updatePreview();
    form.hidden = true;
    receipt.hidden = false;
    document.getElementById('receipt-heading').focus();
  });
  document.getElementById('edit-activity').addEventListener('click', function () {
    receipt.hidden = true;
    form.hidden = false;
    field('title').focus();
  });
  var today = new Date();
  field('date').min = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  document.getElementById('send-activity').disabled = false;
  updatePreview();
})();
