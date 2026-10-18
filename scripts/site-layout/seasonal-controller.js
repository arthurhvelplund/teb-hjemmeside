// Bundled with the shared theme registry and trusted decoration templates.
if (window.TEBSeasonalTheme) {
  window.TEBSeasonalTheme.refresh();
  return;
}
const root = document.documentElement;
let timer;
let ready = document.readyState !== 'loading';
function update() {
  const now = Date.now();
  const active = themes.find(theme => now >= theme.start && now < theme.end);
  if (active) root.dataset.seasonalTheme = active.id;
  else delete root.dataset.seasonalTheme;
  if (ready) {
    for (const node of document.querySelectorAll('[data-seasonal-decor]')) {
      if (!active || node.dataset.seasonalDecor !== active.id) node.remove();
    }
    if (active) for (const hero of document.querySelectorAll('main > .hero-full, main > .page-hero')) {
      const existing = [...hero.children].filter(node => node.hasAttribute('data-seasonal-decor'));
      existing.slice(1).forEach(node => node.remove());
      if (existing.length) continue;
      const decor = document.createElement('div');
      decor.className = 'halloween-decor' + (hero.classList.contains('hero-full') ? '' : ' halloween-secondary');
      decor.dataset.seasonalDecor = active.id;
      decor.setAttribute('aria-hidden', 'true');
      decor.innerHTML = hero.classList.contains('hero-full') ? active.full : active.secondary;
      hero.append(decor);
    }
  }
  clearTimeout(timer);
  const next = themes.flatMap(theme => [theme.start, theme.end]).filter(date => date > now);
  timer = setTimeout(update, Math.min(60000, next.length ? Math.min(...next) - now : 60000));
}
window.TEBSeasonalTheme = Object.freeze({ refresh: update });
update();
document.addEventListener('DOMContentLoaded', () => { ready = true; update(); }, { once: true });
window.addEventListener('pageshow', update);
window.addEventListener('focus', update);
document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
