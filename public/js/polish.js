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

    // ── Dark-mode toggle button — inject into the navbar (or float) ──
    if (!document.getElementById('gdTheme')) {
      var tbtn = document.createElement('button');
      tbtn.id = 'gdTheme';
      tbtn.setAttribute('aria-label', 'Toggle dark mode');
      tbtn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
      tbtn.onclick = window.gdToggleTheme;
      var host = document.querySelector('.navbar-controls, .navbar .ms-auto, nav .ms-auto');
      if (host) { host.insertBefore(tbtn, host.firstChild); tbtn.style.marginInlineEnd = '6px'; }
      else { // float it (above back-to-top)
        tbtn.style.cssText += ';position:fixed;bottom:138px;inset-inline-end:22px;z-index:1500;border-color:rgba(15,123,108,.5);color:var(--teal,#0f7b6c)';
        document.body.appendChild(tbtn);
      }
    }

    // ── Image fade-in (opt-in via .gd-fade) ──
    document.querySelectorAll('img.gd-fade').forEach(function (img) {
      if (img.complete) img.classList.add('gd-loaded');
      else img.addEventListener('load', function () { img.classList.add('gd-loaded'); }, { once: true });
    });

    // ── Count-up numbers (opt-in via [data-count="42"]) ──
    var counters = document.querySelectorAll('[data-count]');
    if (counters.length) {
      var animate = function (el) {
        var target = parseFloat(el.getAttribute('data-count')) || 0;
        var suffix = el.getAttribute('data-count-suffix') || '';
        if (reduce) { el.textContent = target.toLocaleString() + suffix; return; }
        var dur = 1400, start = performance.now();
        var step = function (now) {
          var p = Math.min((now - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);           // easeOutCubic
          var val = target * eased;
          el.textContent = (target % 1 === 0 ? Math.round(val) : val.toFixed(1)).toLocaleString() + suffix;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };
      if (!('IntersectionObserver' in window)) { counters.forEach(animate); }
      else {
        var cio = new IntersectionObserver(function (entries, obs) {
          entries.forEach(function (e) { if (e.isIntersecting) { animate(e.target); obs.unobserve(e.target); } });
        }, { threshold: 0.4 });
        counters.forEach(function (el) { cio.observe(el); });
      }
    }

    // ── 3D tilt (opt-in via .gd-tilt) via event delegation, so it also works
    //    on cards rendered after load (search results, carousels). Pointer
    //    devices only. ──
    if (!reduce && window.matchMedia('(hover: hover)').matches) {
      var MAX = 7; // degrees
      document.addEventListener('pointermove', function (e) {
        var card = e.target.closest && e.target.closest('.gd-tilt');
        if (!card) return;
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.transform = 'perspective(800px) rotateY(' + ((px - .5) * MAX * 2) + 'deg) rotateX(' + ((.5 - py) * MAX * 2) + 'deg) translateZ(0)';
        card.style.setProperty('--mx', (px * 100) + '%');
        card.style.setProperty('--my', (py * 100) + '%');
        card.classList.add('gd-tilting');
      }, { passive: true });
      document.addEventListener('pointerout', function (e) {
        var card = e.target.closest && e.target.closest('.gd-tilt');
        if (card && !card.contains(e.relatedTarget)) { card.style.transform = ''; card.classList.remove('gd-tilting'); }
      }, { passive: true });
    }
  });

  // ── Dark mode — apply ASAP (before paint) to avoid a flash ──
  try {
    var saved = localStorage.getItem('gd_theme');
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) {}
  window.gdToggleTheme = function () {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (dark) { document.documentElement.removeAttribute('data-theme'); try { localStorage.setItem('gd_theme', 'light'); } catch (e) {} }
    else { document.documentElement.setAttribute('data-theme', 'dark'); try { localStorage.setItem('gd_theme', 'dark'); } catch (e) {} }
    var btn = document.getElementById('gdTheme');
    if (btn) btn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
  };
})();
