(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  var stationYears = document.querySelector('[data-station-years]');
  if (stationYears) {
    var now = new Date();
    var years = now.getFullYear() - 1875;
    var anniversaryHasPassed = now.getMonth() > 7 || (now.getMonth() === 7 && now.getDate() >= 8);
    if (!anniversaryHasPassed) years -= 1;
    stationYears.textContent = years;
  }
})();
