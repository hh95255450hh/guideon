/**
 * gd-cine.js — builds the cinematic page header (see /css/gd-cine.css).
 *
 * Mark a section with data-cine and give it the page's own .cine-content; this
 * script adds the footage, the shade, the watermark word, the bottom bar and the
 * scroll cue, and turns the navbar transparent over it.
 *
 *   data-cine-word="STORY"            hairline watermark word (optional)
 *   data-cine-media="settings"        play the home carousel slides from site settings
 *   data-cine-video="/media/…mp4"     a single video…
 *   data-cine-image="/media/…jpg"     …and/or a still (also the video's poster)
 *   data-cine-slides='[{"video":…,"image":…,"badge_ar":…}]'  an explicit list
 *   data-cine-scroll="#target"        where the scroll cue goes (default: next section)
 *   data-cine-noscroll                no scroll cue
 *
 * Pages that learn their image later (a region, an article) call
 *   window.gdCine.setImage(url)  or  window.gdCine.setSlides([...])  /  window.gdCine.setWord('MUSANDAM')
 *
 * Frugal by design: only the slide on screen loads its video; the footage stops
 * off-screen or in a hidden tab; data-saver, 2G/3G and reduced-motion visitors
 * get still images with no movement.
 */
(function () {
  'use strict';
  if (window.gdCine || window.onCine) return;

  // Page scripts may run before the header is built: onCine(fn) calls fn with
  // the API now, or as soon as it exists.
  window.onCine = function (cb) {
    if (window.gdCine) cb(window.gdCine);
    else document.addEventListener('gd-cine-ready', function () { cb(window.gdCine); }, { once: true });
  };

  var stored = '';
  try { stored = (localStorage.getItem('gd_lang') || '').toLowerCase(); } catch (e) {}
  var isAr = stored ? stored.indexOf('ar') === 0 : (document.documentElement.lang || '').toLowerCase().indexOf('ar') === 0;
  var T = function (ar, en) { return isAr ? ar : en; };
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var conn = navigator.connection || {};
  var frugal = reduce || !!conn.saveData || /(^|-)(2g|3g)$/.test(conn.effectiveType || '');
  var esc = function (s) { return String(s || '').replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  // encodeURIComponent leaves the apostrophe alone, so escape the two
  // characters that could break out of url('…') explicitly.
  var cssUrl = function (u) { return "url('" + String(u).replace(/'/g, '%27').replace(/\\/g, '%5C') + "')"; };
  var isYouTube = function (u) { return /youtube\.com|youtu\.be/.test(u || ''); };
  var playSafe = function (v) { var p = v && v.play(); if (p && p.catch) p.catch(function () {}); };

  function build(hero) {
    var d = hero.dataset;
    var api = {};

    // ── Structure ──────────────────────────────────────────────────────
    var media = document.createElement('div'); media.className = 'cine-media'; media.setAttribute('aria-hidden', 'true');
    var shade = document.createElement('div'); shade.className = 'cine-shade'; shade.setAttribute('aria-hidden', 'true');
    var word = document.createElement('div'); word.className = 'cine-word'; word.setAttribute('aria-hidden', 'true');
    word.innerHTML = '<span></span>';
    hero.insertBefore(word, hero.firstChild);
    hero.insertBefore(shade, hero.firstChild);
    hero.insertBefore(media, hero.firstChild);

    api.setWord = function (w) {
      w = String(w || '').trim().toUpperCase();
      word.firstChild.textContent = w;
      word.style.display = w ? '' : 'none';
      word.classList.toggle('is-long', w.length > 6);
    };
    api.setWord(d.cineWord || '');

    // Bilingual copy without a translation key: <h1 data-cine-en="About" data-cine-ar="عن">.
    // Arabic⇄English switches live (no reload), so follow <html lang> as it changes.
    // The first pass trusts the stored choice: before i18n runs, <html lang> still
    // holds the page's static "en" even for an Arabic visitor. Later passes come
    // from the observer, i.e. from i18n actually switching the language.
    var applyLang = function (fromObserver) {
      var l = (document.documentElement.lang || '').toLowerCase();
      if (fromObserver && l) isAr = l.indexOf('ar') === 0;
      Array.prototype.forEach.call(hero.querySelectorAll('[data-cine-en],[data-cine-ar]'), function (el) {
        var v = isAr ? (el.dataset.cineAr || el.dataset.cineEn) : (el.dataset.cineEn || el.dataset.cineAr);
        if (v != null) el.textContent = v;
      });
      var cueTxt = hero.querySelector('.cine-scroll-txt');
      if (cueTxt) cueTxt.textContent = T('انزل للاستكشاف', 'Scroll to explore');
    };
    api.applyLang = applyLang;
    new MutationObserver(function () { applyLang(true); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

    var bar = document.createElement('div'); bar.className = 'cine-bar'; bar.hidden = true;
    bar.innerHTML =
      '<div class="cine-caption" aria-live="polite"></div><div class="cine-progress"></div>' +
      '<button type="button" class="cine-pause" aria-pressed="false">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path class="i-pause" d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/>' +
      '<path class="i-play" d="M8 5l11 7-11 7z" fill="currentColor"/></svg></button>';
    hero.appendChild(bar);
    var caption = bar.querySelector('.cine-caption'), progress = bar.querySelector('.cine-progress'), pauseBtn = bar.querySelector('.cine-pause');

    var noScroll = 'cineNoscroll' in d || hero.classList.contains('cine--band');
    if (!noScroll) {
      var cue = document.createElement('a');
      cue.className = 'cine-scroll'; cue.href = d.cineScroll || '#';
      cue.innerHTML = '<span class="mouse" aria-hidden="true"><span class="wheel"></span></span><span class="cine-scroll-txt"></span>';
      cue.querySelector('.cine-scroll-txt').textContent = T('انزل للاستكشاف', 'Scroll to explore');
      cue.addEventListener('click', function (e) {
        e.preventDefault();
        var target = d.cineScroll ? document.querySelector(d.cineScroll) : hero.nextElementSibling;
        if (!target) return;
        var nav = document.querySelector('.gd-nav');
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - (nav ? nav.offsetHeight : 0) - 12,
                          behavior: reduce ? 'auto' : 'smooth' });
      });
      hero.appendChild(cue);
    }

    // ── Navbar over the footage; parallax on scroll ────────────────────
    document.body.classList.add('cine-nav');
    var setNavH = function () {
      var n = document.querySelector('.gd-nav');
      if (n) document.documentElement.style.setProperty('--cineNavH', n.offsetHeight + 'px');
    };
    setNavH();
    new MutationObserver(setNavH).observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true });
    window.addEventListener('resize', setNavH, { passive: true });

    var ticking = false;
    var onScroll = function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        var h = hero.offsetHeight || 1;
        var p = Math.min(Math.max(window.scrollY / h, 0), 1);
        if (!reduce) hero.style.setProperty('--cp', p.toFixed(3));
        document.body.classList.toggle('nav-solid', window.scrollY > h * 0.5);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // ── Footage ────────────────────────────────────────────────────────
    var slides = [], layers = [], at = 0, timer = null, paused = false, visible = true;

    function layerFor(i) {
      if (layers[i]) return layers[i];
      var s = slides[i], el = document.createElement('div');
      el.className = 'cine-layer';
      if (s.image) el.style.backgroundImage = cssUrl(s.image);
      if (s.video && !isYouTube(s.video) && !frugal) {
        var v = document.createElement('video');
        v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'none';
        if (s.image) v.poster = s.image;
        v.dataset.src = s.video;
        el.appendChild(v);
      } else {
        el.classList.add('kb');
      }
      media.appendChild(el);
      return (layers[i] = el);
    }
    var hasVideo = function (i) { return !!(slides[i] && slides[i].video && !frugal && !isYouTube(slides[i].video)); };
    var durationOf = function (i) { return hasVideo(i) ? 10000 : 7000; };

    function show(i) {
      if (!slides.length) return;
      var prev = layers[at];
      at = (i + slides.length) % slides.length;
      var cur = layerFor(at), v = cur.querySelector('video');
      if (v) { if (!v.getAttribute('src')) v.setAttribute('src', v.dataset.src); if (!paused) playSafe(v); }
      if (prev && prev !== cur) {
        prev.classList.remove('is-on');
        setTimeout(function () { var pv = prev.querySelector('video'); if (pv && prev !== layers[at]) pv.pause(); }, 1700);
      }
      var first = !prev;
      if (first) cur.style.transition = 'none';            // first frame at once — no fade from black
      cur.classList.remove('is-on'); void cur.offsetWidth; cur.classList.add('is-on');
      if (first) requestAnimationFrame(function () { requestAnimationFrame(function () { cur.style.transition = ''; }); });

      var s = slides[at];
      var place = T((s.badge_ar || '').trim(), (s.badge_en || '').trim());
      var line = T((s.title_ar || '').trim(), (s.title_en || '').trim());
      caption.style.opacity = 0;
      setTimeout(function () {
        caption.innerHTML = place || line ? '<span class="pin">📍</span> ' + esc(place) + (place && line ? ' · ' : '') + esc(line) : '';
        caption.style.opacity = 1;
      }, 250);
      Array.prototype.forEach.call(progress.children, function (b, k) {
        b.classList.toggle('done', k < at); b.classList.remove('on');
        b.setAttribute('aria-current', k === at ? 'true' : 'false');
      });
      var seg = progress.children[at];
      if (seg) { seg.style.setProperty('--d', durationOf(at) + 'ms'); void seg.offsetWidth; seg.classList.add('on'); }
      schedule();
    }

    function schedule() {
      clearTimeout(timer);
      if (paused || !visible || slides.length < 2 || reduce) return;
      timer = setTimeout(function () { show(at + 1); }, durationOf(at));
    }

    function setPaused(on) {
      paused = on;
      hero.classList.toggle('paused', on);
      pauseBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      pauseBtn.setAttribute('aria-label', on ? T('تشغيل الفيديو', 'Play the background video') : T('إيقاف الفيديو مؤقتاً', 'Pause the background video'));
      var v = layers[at] && layers[at].querySelector('video');
      if (v) { if (on) v.pause(); else playSafe(v); }
      if (on) clearTimeout(timer); else show(at);
    }
    pauseBtn.addEventListener('click', function () { setPaused(!paused); });
    pauseBtn.setAttribute('aria-label', T('إيقاف الفيديو مؤقتاً', 'Pause the background video'));

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        var v = layers[at] && layers[at].querySelector('video');
        if (!visible) { clearTimeout(timer); if (v) v.pause(); }
        else if (!paused) { if (v) playSafe(v); schedule(); }
      }, { threshold: 0.15 }).observe(hero);
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) clearTimeout(timer); else schedule(); });

    api.setSlides = function (list) {
      var clean = (list || []).filter(function (s) { return s && (s.image || s.video); });
      if (!clean.length) return;
      clearTimeout(timer);
      slides = clean; layers = []; at = 0;
      media.innerHTML = '';
      progress.innerHTML = slides.map(function (_, k) {
        return '<button type="button" aria-label="' + T('الشريحة ', 'Slide ') + (k + 1) + '"><i></i></button>';
      }).join('');
      Array.prototype.forEach.call(progress.children, function (b, k) { b.addEventListener('click', function () { show(k); }); });
      // Controls only when there is something to control: several slides or a video.
      var multi = slides.length > 1;
      progress.style.visibility = multi ? '' : 'hidden';
      bar.hidden = !(multi || hasVideo(0));
      show(0);
    };
    api.setImage = function (url, video) { if (url || video) api.setSlides([{ image: url || '', video: video || '' }]); };

    // Initial footage from the markup.
    if (d.cineSlides) {
      try { api.setSlides(JSON.parse(d.cineSlides)); } catch (e) { /* malformed list: fall through */ }
    }
    if (d.cinePage) {
      // Admin-chosen footage for this page (site settings → pageHeroes). The markup
      // footage waits briefly for it, so a replaced video is never downloaded too.
      var fellBack = false;
      var fallback = setTimeout(function () { fellBack = true; if (!slides.length) api.setImage(d.cineImage, d.cineVideo); }, 1500);
      fetch('/api/site-settings')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var p = j && j.settings && j.settings.pageHeroes && j.settings.pageHeroes.pages && j.settings.pageHeroes.pages[d.cinePage];
          clearTimeout(fallback);
          if (p && p.word) api.setWord(p.word);
          if (p && (p.image || p.video)) api.setImage(p.image, p.video);
          else if (!fellBack) api.setImage(d.cineImage, d.cineVideo);
        })
        .catch(function () { clearTimeout(fallback); if (!fellBack) api.setImage(d.cineImage, d.cineVideo); });
    } else if (!slides.length && (d.cineImage || d.cineVideo)) api.setImage(d.cineImage, d.cineVideo);
    if (d.cineMedia === 'settings') {
      fetch('/api/site-settings')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var list = j && j.settings && j.settings.carousel && j.settings.carousel.slides;
          if (list && list.length) api.setSlides(list);
        })
        .catch(function () {});
    }
    applyLang(false);
    return api;
  }

  function init() {
    var hero = document.querySelector('[data-cine]');
    window.gdCine = hero ? build(hero) : { setImage: function () {}, setSlides: function () {}, setWord: function () {} };
    document.dispatchEvent(new CustomEvent('gd-cine-ready'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
