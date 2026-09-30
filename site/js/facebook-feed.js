(function () {
  var feed = document.querySelector('[data-facebook-feed]');
  if (!feed) return;

  // Facebook fixes its layout width when loaded; update it after a resize.
  var timer;
  function fitFeed() {
    var width = Math.max(180, Math.min(500, Math.floor(feed.parentElement.clientWidth)));
    var url = new URL(feed.src);
    if (url.searchParams.get('width') === String(width)) return;
    url.searchParams.set('width', String(width));
    feed.width = width;
    feed.src = url.toString();
  }
  function scheduleFit() {
    window.clearTimeout(timer);
    timer = window.setTimeout(fitFeed, 150);
  }
  fitFeed();
  if ('ResizeObserver' in window) {
    new ResizeObserver(scheduleFit).observe(feed.parentElement);
  } else {
    window.addEventListener('resize', scheduleFit);
  }
})();
