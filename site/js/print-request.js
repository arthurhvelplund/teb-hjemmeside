// Requesting print inclusion does not reserve a place in an edition.
export function printRequestHTML({preview = false} = {}) {
  return `<section class="ec-print-choice" aria-label="Ønske om trykt kalender"><label class="ec-checkbox"><input name="printRequested" type="checkbox"><span><strong>Vi vil gerne med i den trykte kalender</strong><small>TEB gennemgår ønsket og vælger indholdet manuelt til hver udgave. I er ikke sikret en plads ved indsendelse.</small></span></label>${preview ? '<button type="button" class="ec-text ec-show-print">Se et eksempel på kalenderen ↗</button>' : ''}</section>`;
}
