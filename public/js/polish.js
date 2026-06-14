/* Guideon polish behaviours — scroll reveal, progress bar, back-to-top, image
 * fade-in. Self-contained, dependency-free, and safe: if anything here fails,
 * the page is fully usable (content is visible by default until we opt in). */
(function () {
  'use strict';
  if (window.__gdPolish) return;            // guard against double-load
  window.__gdPolish = true;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    // Signal CSS that JS is live, so .reveal elements may start hidden.
    document.documentElement.classList.add('gd-reveal-ready');

    // ── Scroll reveal ──
    var revealEls = document.querySelectorAll('.reveal, .reveal-stagger');
    if (!('IntersectionObserver' in window) || reduce) {
      revealEls.forEach(function (el) { el.classList.add('gd-in'); });
    } else {
      var io = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('gd-in'); obs.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      revealEls.forEach(function (el) { io.observe(el); });
      // Safety net: if anything is still hidden after 2.5s (e.g. never scrolled
      // into view because it's already on screen but IO missed), reveal it.
      setTimeout(function () {
        revealEls.forEach(function (el) {
          if (!el.classList.contains('gd-in')) {
            var r = el.getBoundingClientRect();
            if (r.top < window.innerHeight) el.classList.add('gd-in');
          }
        });
      }, 2500);
    }

    // ── Scroll progress bar ──
    var bar = document.createElement('div');
    bar.id = 'gdProgress';
    document.body.appendChild(bar);

    // ── Back-to-top ──
    var top = document.createElement('button');
    top.id = 'gdTop';
    top.setAttribute('aria-label', 'Back to top');
    top.innerHTML = '↑';
    top.onclick = function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); };
    document.body.appendChild(top);

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var h = document.documentElement;
        var max = (h.scrollHeight - h.clientHeight) || 1;
        var pct = Math.min(100, (h.scrollTop || document.body.scrollTop) / max * 100);
        bar.style.width = pct + '%';
        top.classList.toggle('show', (h.scrollTop || document.body.scrollTop) > 600);
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // ── Image fade-in (opt-in via .gd-fade) ──
    document.querySelectorAll('img.gd-fade').forEach(function (img) {
      if (img.complete) img.classList.add('gd-loaded');
      else img.addEventListener('load', function () { img.classList.add('gd-loaded'); }, { once: true });
    });
  });
})();
