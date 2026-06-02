/**
 * Dynamic homepage content loader.
 * On page load, fetches /api/site-settings and overrides:
 *   - Hero text (badge / title / highlight / subtitle)
 *   - Carousel slides (if admin uploaded any)
 *   - Activities grid (if admin curated any)
 * If admin hasn't customised yet, the hardcoded HTML stays as default.
 */
(async function () {
  try {
    const r = await fetch('/api/site-settings');
    if (!r.ok) return;
    const data = await r.json();
    const settings = data.settings || {};
    const isAr = (document.documentElement.lang || 'en').startsWith('ar');
    const T = (en, ar) => (isAr ? (ar || en) : (en || ar));

    // ─── HERO ─────────────────────────────
    const h = settings.hero || {};
    const heroBadge     = document.querySelector('[data-i18n="hero_badge"]');
    const heroTitle     = document.querySelector('[data-i18n="hero_title"]');
    const heroHighlight = document.querySelector('[data-i18n="hero_highlight"]');
    const heroSubtitle  = document.querySelector('[data-i18n="hero_sub"]');
    if (heroBadge     && (h.badge_en || h.badge_ar))         heroBadge.textContent     = T(h.badge_en, h.badge_ar);
    if (heroTitle     && (h.title_en || h.title_ar))         heroTitle.textContent     = T(h.title_en, h.title_ar);
    if (heroHighlight && (h.highlight_en || h.highlight_ar)) heroHighlight.textContent = T(h.highlight_en, h.highlight_ar);
    if (heroSubtitle  && (h.subtitle_en || h.subtitle_ar))   heroSubtitle.textContent  = T(h.subtitle_en, h.subtitle_ar);

    // ─── CAROUSEL ─────────────────────────
    // Only use admin slides that actually have media (image OR video) — otherwise
    // keep the default hardcoded carousel (an empty slide must NOT wipe it).
    const slides = (settings.carousel?.slides || []).filter(s => s && (s.image || s.video));
    const inner = document.querySelector('#omanCarousel .carousel-inner');
    const indicators = document.querySelector('#omanCarousel .carousel-indicators');
    if (slides.length > 0 && inner && indicators) {
      // A slide with a video should pause auto-advance so the clip can play; we
      // give video slides a longer interval and let the <video> loop.
      inner.innerHTML = slides.map((s, i) => `
        <div class="carousel-item ${i === 0 ? 'active' : ''}" ${s.video ? 'data-bs-interval="12000"' : ''}>
          ${slideMedia(s, T)}
          <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.75) 0%,rgba(0,0,0,.15) 55%,transparent 100%)"></div>
          <div class="carousel-caption text-start" style="bottom:40px;left:6%;right:40%">
            ${s.badge_en || s.badge_ar ? `<div class="badge mb-2" style="background:var(--gold);color:#000;font-size:.85rem">${esc(T(s.badge_en, s.badge_ar))}</div>` : ''}
            ${s.title_en || s.title_ar ? `<h2 class="fw-800 mb-1" style="text-shadow:0 2px 8px rgba(0,0,0,.9)">${esc(T(s.title_en, s.title_ar))}</h2>` : ''}
            ${s.desc_en || s.desc_ar ? `<p class="mb-3 d-none d-md-block" style="opacity:.9;text-shadow:0 1px 4px rgba(0,0,0,.8)">${esc(T(s.desc_en, s.desc_ar))}</p>` : ''}
            ${s.link ? `<a href="${esc(s.link)}" class="btn btn-sm btn-light fw-700 px-4">${esc(s.button_text || (isAr ? 'استكشف' : 'Explore'))} →</a>` : ''}
          </div>
        </div>
      `).join('');
      indicators.innerHTML = slides.map((_, i) =>
        `<button type="button" data-bs-target="#omanCarousel" data-bs-slide-to="${i}" ${i === 0 ? 'class="active"' : ''}></button>`
      ).join('');
    }

    // ─── ACTIVITIES ───────────────────────
    // Skip blank cards (no image and no title) so they don't replace defaults.
    const acts = (settings.activities?.items || []).filter(a => a && (a.image || a.title_en || a.title_ar));
    const grid = document.getElementById('activitiesGrid');
    if (grid && acts.length > 0) {
      grid.innerHTML = acts.map(a => `
        <div class="col-md-6 col-lg-4">
          <div class="activity-card" onclick="location.href='${esc(a.link || '/search.html')}'">
            ${a.image ? `<div class="activity-img" style="background-image:url('${esc(a.image)}')"></div>` : '<div class="activity-img" style="background:linear-gradient(135deg,#0f1c3e,#0f7b6c)"></div>'}
            <div class="activity-body">
              ${a.badge ? `<div class="activity-badge">${esc(a.badge)}</div>` : ''}
              <h5 class="fw-800 mb-1">${esc(T(a.title_en, a.title_ar))}</h5>
              <p class="text-muted small mb-2">${esc(T(a.desc_en, a.desc_ar))}</p>
              <div class="d-flex justify-content-between align-items-center small">
                <span>${esc(a.duration || '')}</span>
                ${a.price ? `<span class="text-teal fw-700">${esc(a.price)}</span>` : ''}
              </div>
            </div>
          </div>
        </div>
      `).join('');
      // Hide the empty-state placeholder
      const section = grid.closest('section');
      if (section) section.classList.remove('d-none');
    } else if (grid && acts.length === 0) {
      // Hide the whole activities section when empty — cleaner than showing the placeholder publicly
      const section = grid.closest('section');
      if (section) section.classList.add('d-none');
    }
  } catch (e) {
    // silent fail — page works with default content
    console.warn('[dynamic-homepage]', e.message);
  }

  function esc(s) {
    return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // Extract a YouTube video id from common URL shapes; returns '' if not YouTube.
  function youtubeId(url) {
    const m = String(url||'').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : '';
  }

  // Render the visual layer of a slide: YouTube embed, self-hosted video, or image.
  function slideMedia(s, T) {
    const mediaStyle = 'height:500px;object-fit:cover;object-position:center 45%';
    if (s.video) {
      const yt = youtubeId(s.video);
      if (yt) {
        return `<iframe class="d-block w-100" style="height:500px;border:0;pointer-events:none"
          src="https://www.youtube.com/embed/${yt}?autoplay=1&mute=1&loop=1&playlist=${yt}&controls=0&showinfo=0&modestbranding=1&rel=0&playsinline=1"
          allow="autoplay; encrypted-media" allowfullscreen loading="lazy"></iframe>`;
      }
      return `<video class="d-block w-100" style="${mediaStyle}" autoplay muted loop playsinline preload="metadata"
        ${s.image ? `poster="${esc(s.image)}"` : ''} src="${esc(s.video)}"></video>`;
    }
    if (s.image) {
      return `<img loading="lazy" decoding="async" src="${esc(s.image)}" alt="${esc(T(s.title_en, s.title_ar))}" class="d-block w-100" style="${mediaStyle}">`;
    }
    return '';
  }
})();
