(function () {
  var header = document.querySelector('.site-header');
  if (header && 'ResizeObserver' in window) {
    new ResizeObserver(function () {
      document.documentElement.style.setProperty('--site-header-height', header.offsetHeight + 'px');
    }).observe(header);
  }
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Administration stays independent from the ordinary association entrance.
  var adminTools = document.querySelector('[data-admin-tools]');
  if (adminTools) {
    var sessionRevision = 0;
    function updateAdminTools(session) { adminTools.hidden = !(session && session.authenticated && session.user && session.user.isAdmin); }
    document.addEventListener('teb:session', function (event) { sessionRevision += 1; updateAdminTools(event.detail); });
    var initialRevision = sessionRevision;
    fetch('/api/kalender/session', { credentials: 'same-origin', signal: AbortSignal.timeout(10000) })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (session) { if (initialRevision === sessionRevision) updateAdminTools(session); })
      .catch(function () { /* The ordinary account entrance remains available. */ });
  }

  var stationYears = document.querySelector('[data-station-years]');
  if (stationYears) {
    var now = new Date();
    var years = now.getFullYear() - 1875;
    var anniversaryHasPassed = now.getMonth() > 7 || (now.getMonth() === 7 && now.getDate() >= 8);
    if (!anniversaryHasPassed) years -= 1;
    stationYears.textContent = years;
  }

  var websiteForms = document.querySelectorAll('form[action="/api/formular"]');
  websiteForms.forEach(function (form) {
    var startedAt = form.querySelector('input[name="formular_startet"]');
    if (startedAt) startedAt.value = String(Date.now());
  });

  if (websiteForms.length) {
    fetch('/api/formular/config', { credentials: 'same-origin' })
      .then(function (response) { return response.ok ? response.json() : {}; })
      .then(function (config) {
        if (!config.turnstileSiteKey) return;

        var script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.addEventListener('load', function () {
          websiteForms.forEach(function (form) {
            var container = document.createElement('div');
            var submit = form.querySelector('button[type="submit"]');
            submit.parentNode.insertBefore(container, submit);
            window.turnstile.render(container, {
              sitekey: config.turnstileSiteKey,
              action: 'formular',
              theme: 'light'
            });
          });
        });
        document.head.appendChild(script);
      })
      .catch(function () {
        // Serveren afgør ved indsendelse, om Turnstile er påkrævet.
      });
  }
})();

