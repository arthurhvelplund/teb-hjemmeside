import {escapeHTML as esc} from './portal-api.js';

// One guide for creation, editing and receipts. Add confirmed local agreements here.
export const sharingOptions = [
  {
    key: 'online', title: 'Online fælleskalender',
    description: 'Arrangementet vises i byens fælles kalender, når det er udgivet. Gæsters arrangementer skal først godkendes af TEB.',
    facts: [['Indlevering', 'Udfyld arrangementsformularen her.'], ['Udgivelse', 'Med foreningsadgang udgiver I direkte. Som gæst afventer I TEBs godkendelse.']]
  },
  {
    key: 'flyers', title: 'Husstandsomdeling',
    description: 'Fire gange om året kan materiale blive husstandsomdelt via vejformændene.',
    facts: [['Indleveringsfrist', 'Datoer for de fire omdelinger mangler.'], ['Omdelingsdato', 'Datoer for de fire omdelinger mangler.'], ['Indlevering og kontakt', 'Materialet skal indleveres til Kirsten Thorhauge. Kontaktoplysninger og afleveringssted mangler.'], ['Pris og materiale', 'Pris, antal og krav til materialet mangler.']]
  },
  {
    key: 'screens', title: 'Infoskærme hos Varde Kommune',
    description: 'Varde Kommunes to digitale infoskærme står ved rundkørslen i Billum og på Ribevej i Varde syd. Arrangementet skal have almen interesse og offentlig adgang. Kommunen vurderer bestillingen.',
    facts: [['Bestilling', 'Bestil direkte hos Varde Kommune via linket nedenfor.'], ['Pris', 'Kommunens side oplyser 750 kr. ekskl. moms pr. påbegyndt uge for begge skærme. Prisangivelsen er fra 2018. Bekræft prisen ved bestilling.'], ['Indleveringsfrist', 'Senest 5 hverdage før den ønskede startdato. Se kommunens side for særlige feriefrister.'], ['Materiale', 'JPG eller PNG i 8,47 × 12,7 cm ved 300 ppi. Kort budskab, ingen logoer og ingen helt hvid baggrund.'], ['Visning', 'Annoncen vises 10 sekunder ad gangen. Skærmene er slukket kl. 00 til 06. Kommunen sender korrektur til godkendelse.']],
    links: [['Regler og priser hos Varde Kommune', 'https://vardekommune.dk/kommunen/byportal/'], ['Bestil visning på infoskærmene', 'https://vardekommune.dk/kommunen/byportal/lav-en-bestilling-til-de-digitale-infoskaerme/']]
  },
  {
    key: 'portals', title: 'Byportaler med bannere',
    description: 'Tre bannere til byens tre portaler. Tilbud fra Jens Ejnar Antonsen, 11. oktober 2026.',
    facts: [['Pris for tre bannere', '1.200 kr. ekskl. moms i alt. Tilbuddet gælder levering hos Jens Ejnar Antonsen. Ophængning er ikke oplyst i tilbuddet.'], ['Format', '3 stk. bannere på 2000 × 1445 mm. Filerne skal være klar til print.'], ['Tilretning af filer', '400 kr. pr. time ekskl. moms, hvis filerne skal rettes.'], ['Bestilling og indlevering', 'De første bestillinger kan gå gennem Jens Ejnar Antonsen. Tlf. 28 94 98 42, jemantonsen@bbsyd.dk. Aftal aflevering af filer med ham.'], ['Opsætning', 'Det skal afklares, hvem der hænger bannerne op.'], ['Indleveringsfrist', 'Frist for bestilling og indlevering af filer mangler.'], ['Opsætningsperiode', 'Datoer for opsætning og nedtagning mangler.']],
    links: [['Ring til Jens Ejnar Antonsen', 'tel:+4528949842'], ['Skriv til Jens Ejnar Antonsen', 'mailto:jemantonsen@bbsyd.dk']]
  },
  {
    key: 'posters', title: 'Opslagstavler i byen',
    description: 'Gør arrangementet synligt på byens opslagstavler. Placering og tilladelse aftales med den ansvarlige.',
    facts: [['Placering og kontakt', 'Mulige steder er hallen, Trim og Brugsen. Placeringer og ansvarlige er endnu ikke bekræftet.'], ['Pris og opsætning', 'Eventuel pris og ansvar for ophængning mangler.'], ['Frist og periode', 'Frister, format og dato for nedtagning mangler.']]
  },
  {
    key: 'print', title: 'Den trykte kalender',
    description: 'Byens fælles kalender på papir til lygtepæle og opslagstavler. TEB vælger arrangementer og læser korrektur til hver udgave.',
    facts: [['Indleveringsfrist', 'Frist for næste udgave mangler.'], ['Ophængning', 'Dato og ansvar for næste ophængning mangler.'], ['Kontakt og pris', 'Kontaktperson og eventuel pris mangler.']]
  }
];

export function sharingGuideHTML({choices = false, composer = false} = {}) {
  return `<section class="ec-sharing" aria-label="Muligheder for deling">
    <h3>Få arrangementet ud i byen</h3>
    <p>Kalenderen online er udgangspunktet. Se også mulighederne for tryk, omdeling og opslag.</p>
    ${choices ? '<p>Markér det, I er interesserede i. Ønskerne gemmes med arrangementet. Omdeling, opsætning og skærmvisning kræver en særskilt aftale. En plads i den trykte kalender kræver TEBs udvælgelse.</p>' : ''}
    <div class="ec-sharing-options">${sharingOptions.map(option => `<div class="ec-sharing-option" data-sharing="${option.key}">
      ${choices && option.key !== 'online' ? `<label class="ec-sharing-choice"><input type="checkbox" ${option.key === 'print' ? 'name="printRequested"' : `name="channels" value="${option.key}"`}><span>${esc(option.title)}</span></label>` : `<h4>${esc(option.title)}</h4>`}
      ${option.key === 'online' ? '<p class="ec-sharing-included">Med ved udgivelse</p>' : ''}
      <details><summary>${option.key === 'online' ? 'Sådan kommer I med' : 'Se kontakt, pris og frister'}</summary>
        <p>${esc(option.description)}</p>
        <dl>${option.facts.map(([label, text]) => `<div><dt>${esc(label)}</dt><dd>${esc(text)}</dd></div>`).join('')}</dl>
        ${option.links ? '<div class="ec-sharing-links">' + option.links.map(([label, href]) => `<a href="${esc(href)}"${href.startsWith('https:') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(label)}${href.startsWith('https:') ? ' ↗' : ''}</a>`).join('') + '</div>' : ''}
      </details>
      ${composer && option.key === 'print' ? '<button type="button" class="ec-text ec-show-print">Se et eksempel på kalenderen ↗</button>' : ''}
    </div>`).join('')}</div>
    <p>Nogle kontakter og frister mangler endnu. <a href="kontakt.html#form">Spørg TEB om kontakt, pris og frister</a>.</p>
  </section>`;
}
