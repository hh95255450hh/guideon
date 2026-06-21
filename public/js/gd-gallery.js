/**
 * gd-gallery.js — elegant, reusable photo gallery + full-screen lightbox.
 *
 * Usage:  GdGallery.render(containerEl, ['url1', 'url2', ...]);
 *
 * Features: responsive grid with hover zoom, click → full-screen viewer with
 * prev/next arrows, image counter, thumbnail strip, keyboard (←/→/Esc) and
 * touch-swipe navigation. RTL-aware. No dependencies. Injects its own styles
 * once. URLs are passed through window.gdSafeUrl when available.
 */
(function () {
  if (window.GdGallery) return;

  var safe = function (u) {
    return (window.gdSafeUrl ? window.gdSafeUrl(u) : String(u || '')).replace(/"/g, '%22');
  };

  function injectStyles() {
    if (document.getElementById('gd-gallery-styles')) return;
    var css = `
.gdg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}
.gdg-tile{position:relative;aspect-ratio:4/3;border-radius:14px;overflow:hidden;cursor:zoom-in;
  background:#eef2f6;box-shadow:0 1px 3px rgba(15,28,62,.08);transition:transform .25s ease,box-shadow .25s ease}
.gdg-tile:hover{transform:translateY(-3px);box-shadow:0 10px 24px rgba(15,28,62,.18)}
.gdg-tile img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .45s ease}
.gdg-tile:hover img{transform:scale(1.08)}
.gdg-tile::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(15,28,62,.28),transparent 45%);
  opacity:0;transition:opacity .25s ease}
.gdg-tile:hover::after{opacity:1}
.gdg-zoom{position:absolute;top:8px;inset-inline-end:8px;width:30px;height:30px;border-radius:50%;
  background:rgba(255,255,255,.92);color:#0f1c3e;display:flex;align-items:center;justify-content:center;
  font-size:15px;opacity:0;transform:scale(.7);transition:.25s ease;pointer-events:none}
.gdg-tile:hover .gdg-zoom{opacity:1;transform:scale(1)}
.gdg-tile.gdg-more::before{content:attr(data-more);position:absolute;inset:0;background:rgba(15,28,62,.62);
  color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:700;z-index:2}

.gdg-lb{position:fixed;inset:0;z-index:99999;background:rgba(8,12,24,.94);display:flex;flex-direction:column;
  align-items:center;justify-content:center;opacity:0;transition:opacity .2s ease;backdrop-filter:blur(4px)}
.gdg-lb.gdg-open{opacity:1}
.gdg-stage{position:relative;flex:1;width:100%;display:flex;align-items:center;justify-content:center;padding:18px 60px;min-height:0}
.gdg-stage img{max-width:92vw;max-height:78vh;border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.5);
  user-select:none;-webkit-user-drag:none;transition:opacity .18s ease}
.gdg-btn{position:absolute;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;border:0;
  background:rgba(255,255,255,.14);color:#fff;font-size:24px;cursor:pointer;display:flex;align-items:center;
  justify-content:center;transition:background .2s ease}
.gdg-btn:hover{background:rgba(255,255,255,.28)}
.gdg-prev{inset-inline-start:14px}.gdg-next{inset-inline-end:14px}
.gdg-close{position:absolute;top:16px;inset-inline-end:18px;width:42px;height:42px;border-radius:50%;border:0;
  background:rgba(255,255,255,.14);color:#fff;font-size:22px;cursor:pointer;transition:background .2s ease}
.gdg-close:hover{background:rgba(255,255,255,.3)}
.gdg-count{position:absolute;top:20px;inset-inline-start:20px;color:#fff;font-size:.9rem;font-weight:600;
  background:rgba(0,0,0,.35);padding:5px 12px;border-radius:20px;letter-spacing:.5px}
.gdg-strip{display:flex;gap:8px;padding:12px;overflow-x:auto;max-width:96vw;scrollbar-width:thin}
.gdg-strip img{height:54px;width:74px;object-fit:cover;border-radius:8px;cursor:pointer;opacity:.5;
  border:2px solid transparent;transition:.2s ease;flex-shrink:0}
.gdg-strip img.gdg-active{opacity:1;border-color:#0f7b6c}
@media(max-width:600px){.gdg-stage{padding:12px 8px}.gdg-btn{width:40px;height:40px;font-size:20px}
  .gdg-prev{inset-inline-start:4px}.gdg-next{inset-inline-end:4px}.gdg-stage img{max-height:70vh}}
`;
    var s = document.createElement('style');
    s.id = 'gd-gallery-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  var LB = null, URLS = [], IDX = 0;

  function buildLightbox() {
    if (LB) return;
    LB = document.createElement('div');
    LB.className = 'gdg-lb';
    LB.innerHTML =
      '<button class="gdg-close" aria-label="إغلاق Close">✕</button>' +
      '<span class="gdg-count"></span>' +
      '<div class="gdg-stage">' +
        '<button class="gdg-btn gdg-prev" aria-label="السابق Previous">‹</button>' +
        '<img alt="">' +
        '<button class="gdg-btn gdg-next" aria-label="التالي Next">›</button>' +
      '</div>' +
      '<div class="gdg-strip"></div>';
    document.body.appendChild(LB);

    LB.querySelector('.gdg-close').onclick = close;
    LB.querySelector('.gdg-prev').onclick = function (e) { e.stopPropagation(); go(-1); };
    LB.querySelector('.gdg-next').onclick = function (e) { e.stopPropagation(); go(1); };
    LB.addEventListener('click', function (e) { if (e.target === LB) close(); });

    // touch swipe
    var x0 = null;
    LB.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    LB.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1); // RTL-natural: swipe left = next
      x0 = null;
    });
  }

  function onKey(e) {
    if (!LB || !LB.classList.contains('gdg-open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  }

  function show() {
    var img = LB.querySelector('.gdg-stage img');
    img.style.opacity = '0';
    var u = safe(URLS[IDX]);
    var pre = new Image();
    pre.onload = function () { img.src = u; img.style.opacity = '1'; };
    pre.src = u;
    LB.querySelector('.gdg-count').textContent = (IDX + 1) + ' / ' + URLS.length;
    // thumbnail strip active state + scroll into view
    var thumbs = LB.querySelectorAll('.gdg-strip img');
    thumbs.forEach(function (t, i) {
      t.classList.toggle('gdg-active', i === IDX);
      if (i === IDX) t.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    });
  }

  function go(d) { IDX = (IDX + d + URLS.length) % URLS.length; show(); }

  function open(urls, i) {
    URLS = urls; IDX = i || 0;
    buildLightbox();
    // (re)build thumbnail strip
    var strip = LB.querySelector('.gdg-strip');
    strip.innerHTML = URLS.map(function (u, k) {
      return '<img src="' + safe(u) + '" data-i="' + k + '" alt="" loading="lazy">';
    }).join('');
    strip.querySelectorAll('img').forEach(function (t) {
      t.onclick = function (e) { e.stopPropagation(); IDX = +t.getAttribute('data-i'); show(); };
    });
    // single image → hide arrows + strip
    var multi = URLS.length > 1;
    LB.querySelector('.gdg-prev').style.display = multi ? '' : 'none';
    LB.querySelector('.gdg-next').style.display = multi ? '' : 'none';
    strip.style.display = multi ? '' : 'none';
    LB.querySelector('.gdg-count').style.display = multi ? '' : 'none';

    show();
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { LB.classList.add('gdg-open'); });
    document.addEventListener('keydown', onKey);
  }

  function close() {
    if (!LB) return;
    LB.classList.remove('gdg-open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    setTimeout(function () { if (LB) LB.querySelector('.gdg-stage img').src = ''; }, 200);
  }

  /**
   * Render the grid into `container` for the given image urls.
   * @param {number} [max] cap visible tiles; the last shows a "+N" overlay.
   */
  function render(container, urls, max) {
    if (!container) return;
    injectStyles();
    urls = (urls || []).filter(Boolean);
    if (!urls.length) { container.innerHTML = ''; return; }
    container.classList.add('gdg-grid');
    var shown = (max && urls.length > max) ? urls.slice(0, max) : urls;
    var hidden = urls.length - shown.length;
    container.innerHTML = shown.map(function (u, i) {
      var more = (hidden > 0 && i === shown.length - 1)
        ? ' gdg-more" data-more="+' + hidden + '"' : '"';
      return '<div class="gdg-tile' + more + ' data-i="' + i + '">' +
        '<img src="' + safe(u) + '" alt="" loading="lazy">' +
        '<span class="gdg-zoom">⤢</span></div>';
    }).join('');
    container.querySelectorAll('.gdg-tile').forEach(function (tile) {
      tile.onclick = function () { open(urls, +tile.getAttribute('data-i')); };
    });
  }

  window.GdGallery = { render: render, open: open };
})();
