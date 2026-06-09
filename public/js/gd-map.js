/**
 * gd-map.js — interactive maps for tour packages (Leaflet + OpenStreetMap).
 *
 *  - Free (no API key, no quota).
 *  - Two modes:
 *      gdMap.editor(elOrId, initial) → { getData, setData, destroy }
 *      gdMap.viewer(elOrId, data)    → { destroy }
 *
 *  Data shape (stored on a tour package as JSON):
 *      {
 *        meetingPoint: { lat, lng, label_ar?, label_en? } | null,
 *        route:       [{ lat, lng }, ...]   // ordered waypoints
 *      }
 *
 *  EDITOR controls:
 *    • Tab "📍 نقطة اللقاء" → next click places / moves the meeting pin.
 *    • Tab "🛣️ المسار"     → next clicks add ordered waypoints (drawn as
 *                            a polyline). Click an existing waypoint to
 *                            remove it.
 *    • "🗑️ مسح المسار"      → clears the route.
 *    • Auto-fits view to whatever is on the map.
 *
 *  Leaflet is loaded lazily from a CDN the first time gdMap is used,
 *  so pages that never open a map pay nothing.
 */
(function () {
  if (window.gdMap) return;

  const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  const TILE_URL    = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const TILE_ATTR   = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  // Oman centroid — used when there's nothing else to show.
  const OMAN = { lat: 21.4735, lng: 55.9754, zoom: 6 };

  let leafletPromise = null;
  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-leaflet]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = LEAFLET_CSS; link.dataset.leaflet = '1';
        document.head.appendChild(link);
      }
      if (!document.querySelector('script[data-leaflet]')) {
        const s = document.createElement('script');
        s.src = LEAFLET_JS; s.async = true; s.dataset.leaflet = '1';
        s.onload  = () => resolve(window.L);
        s.onerror = () => reject(new Error('Could not load Leaflet'));
        document.head.appendChild(s);
      } else {
        // Already loading — wait for it
        const check = setInterval(() => { if (window.L) { clearInterval(check); resolve(window.L); } }, 80);
      }
    });
    return leafletPromise;
  }

  function resolveEl(elOrId) {
    if (!elOrId) return null;
    return typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
  }

  // Custom SVG-based marker (no broken default icon issues on bundlers/CDNs).
  function makeIcon(L, color, glyph) {
    const html = `
      <div style="position:relative">
        <svg width="34" height="44" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.4 0 0 5.4 0 12c0 8.5 12 20 12 20s12-11.5 12-20c0-6.6-5.4-12-12-12z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
          <circle cx="12" cy="12" r="5" fill="#fff"/>
        </svg>
        <span style="position:absolute;top:6px;left:50%;transform:translateX(-50%);font-size:14px;line-height:1">${glyph||''}</span>
      </div>`;
    return L.divIcon({ html, className: '', iconSize: [34, 44], iconAnchor: [17, 44], popupAnchor: [0, -38] });
  }
  function meetIcon(L)    { return makeIcon(L, '#0f7b6c', '📍'); }
  function waypointIcon(L){ return makeIcon(L, '#1a2c5b', ''); }

  function fitToContent(L, map, layers) {
    const bounds = L.latLngBounds([]);
    let any = false;
    for (const layer of layers) {
      if (!layer) continue;
      if (layer.getLatLng)      { bounds.extend(layer.getLatLng()); any = true; }
      else if (layer.getBounds) { bounds.extend(layer.getBounds()); any = true; }
    }
    if (any) map.fitBounds(bounds.pad(0.25), { maxZoom: 13 });
    else     map.setView([OMAN.lat, OMAN.lng], OMAN.zoom);
  }

  // Haversine — distance in km between two {lat,lng} points.
  function haversineKm(a, b) {
    const R = 6371;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function totalDistanceKm(meet, route) {
    const pts = [];
    if (meet && Number.isFinite(meet.lat)) pts.push(meet);
    for (const p of (route || [])) if (Number.isFinite(p.lat)) pts.push(p);
    if (pts.length < 2) return 0;
    let km = 0;
    for (let i = 1; i < pts.length; i++) km += haversineKm(pts[i-1], pts[i]);
    return km;
  }

  // Nominatim search (free OpenStreetMap geocoding, ~1 req/sec rate limit).
  // Biased to Oman so "Nizwa Fort" resolves to the right one.
  async function geocode(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=om&limit=6&accept-language=ar,en`;
    try {
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) return [];
      const data = await r.json();
      return (data || []).map(d => ({
        name: d.display_name,
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
      })).filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lng));
    } catch { return []; }
  }

  // ─── EDITOR (redesigned for usability) ─────────────────────────────
  async function editor(elOrId, initial) {
    const host = resolveEl(elOrId);
    if (!host) throw new Error('gdMap.editor: container not found');
    host.innerHTML = `
      <div class="gd-map-help" style="background:#eef7f5;border:1px solid #b6e0d6;color:#0a5c50;padding:10px 14px;border-radius:10px;font-size:.85rem;margin-bottom:10px;line-height:1.6">
        💡 <strong>طريقة سهلة:</strong> ابحث عن المكان بالاسم في المربّع أدناه (مثل "قلعة نزوى") واضغطه — ستُسقط النقطة تلقائياً.
        أو <strong>انقر على الخريطة</strong> مباشرة. أوّل نقرة = موقع اللقاء 📍، النقرات التالية = نقاط المسار 🛣️.
      </div>
      <div class="gd-map-search" style="position:relative;margin-bottom:8px">
        <input type="text" class="form-control" placeholder="🔍 ابحث عن مكان… (قلعة نزوى، وادي شاب، جبل شمس...)" autocomplete="off">
        <div class="gd-map-results" style="position:absolute;top:100%;inset-inline:0;background:#fff;border:1px solid #dee2e6;border-top:0;border-radius:0 0 10px 10px;box-shadow:0 8px 20px rgba(0,0,0,.08);max-height:240px;overflow-y:auto;z-index:1000;display:none"></div>
      </div>
      <div class="gd-map-toolbar" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center">
        <div class="btn-group btn-group-sm" role="group">
          <button type="button" data-tool="meet"  class="btn btn-success">📍 نقطة اللقاء</button>
          <button type="button" data-tool="route" class="btn btn-outline-primary">🛣️ نقاط المسار</button>
        </div>
        <button type="button" data-act="locate"   class="btn btn-sm btn-outline-secondary" title="استخدم موقعي الحالي">📡 موقعي</button>
        <button type="button" data-act="undo"     class="btn btn-sm btn-outline-secondary" title="تراجع عن آخر نقطة">↶ تراجع</button>
        <button type="button" data-act="clear-route" class="btn btn-sm btn-outline-danger">🗑️ مسح المسار</button>
        <span class="gd-map-stats small fw-700" style="margin-inline-start:auto;color:#0f1c3e">المسار: 0 نقطة · 0 كم</span>
      </div>
      <div class="gd-map-canvas" style="height:380px;border-radius:12px;overflow:hidden;border:1px solid #dee2e6"></div>
      <div class="gd-map-hint small text-muted" style="margin-top:6px">انقر على رقم نقطة في المسار لحذفها. اسحب 📍 نقطة اللقاء لتعديل موقعها.</div>`;

    const canvas    = host.querySelector('.gd-map-canvas');
    const stats     = host.querySelector('.gd-map-stats');
    const searchInp = host.querySelector('.gd-map-search input');
    const results   = host.querySelector('.gd-map-results');

    const L = await loadLeaflet();
    const map = L.map(canvas).setView([OMAN.lat, OMAN.lng], OMAN.zoom);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);

    const state = {
      meet:  (initial && initial.meetingPoint) || null,
      route: Array.isArray(initial && initial.route) ? initial.route.slice() : [],
      // Default tool: meet if no meeting point yet, otherwise route.
      tool:  (initial && initial.meetingPoint) ? 'route' : 'meet',
      undoStack: [],
    };
    let meetMarker = null, routeMarkers = [], routeLine = null;

    function snapshot() {
      state.undoStack.push({ meet: state.meet ? {...state.meet} : null, route: state.route.map(p => ({...p})) });
      if (state.undoStack.length > 30) state.undoStack.shift();
    }
    function applyToolStyles() {
      host.querySelectorAll('[data-tool]').forEach(b => {
        const isMe = b.dataset.tool === state.tool;
        b.classList.toggle('btn-success',         b.dataset.tool === 'meet'  &&  isMe);
        b.classList.toggle('btn-outline-success', b.dataset.tool === 'meet'  && !isMe);
        b.classList.toggle('btn-primary',         b.dataset.tool === 'route' &&  isMe);
        b.classList.toggle('btn-outline-primary', b.dataset.tool === 'route' && !isMe);
      });
      host.querySelector('.gd-map-hint').textContent = state.tool === 'meet'
        ? '📍 الوضع الحالي: نقطة اللقاء — أوّل نقرة على الخريطة ستحدّد نقطة اللقاء. بعد ذلك التبديل تلقائي لـ"نقاط المسار".'
        : '🛣️ الوضع الحالي: نقاط المسار — كل نقرة تُضيف نقطة جديدة بالترتيب. انقر على رقم لحذفها.';
    }
    function refreshStats() {
      const n = state.route.length;
      const km = totalDistanceKm(state.meet, state.route);
      stats.textContent = `المسار: ${n} نقطة${n!==1?'':''} · ${km.toFixed(1)} كم`;
    }

    function redraw(skipFit) {
      if (meetMarker) { map.removeLayer(meetMarker); meetMarker = null; }
      routeMarkers.forEach(m => map.removeLayer(m)); routeMarkers = [];
      if (routeLine) { map.removeLayer(routeLine); routeLine = null; }

      if (state.meet) {
        meetMarker = L.marker([state.meet.lat, state.meet.lng], { icon: meetIcon(L), draggable: true })
          .addTo(map)
          .bindPopup('📍 نقطة اللقاء<br><small>اسحبني لتعديل الموقع</small>');
        meetMarker.on('dragend', e => {
          snapshot();
          const ll = e.target.getLatLng();
          state.meet = { lat: ll.lat, lng: ll.lng };
          refreshStats();
        });
      }
      if (state.route.length) {
        // Connect meet → route[0] → route[1] → … so the line is meaningful.
        const head = state.meet ? [[state.meet.lat, state.meet.lng]] : [];
        const latlngs = head.concat(state.route.map(p => [p.lat, p.lng]));
        if (latlngs.length >= 2) {
          routeLine = L.polyline(latlngs, { color: '#1a2c5b', weight: 4, opacity: 0.85, dashArray: '6,8' }).addTo(map);
        }
        state.route.forEach((p, i) => {
          const m = L.marker([p.lat, p.lng], { icon: waypointIcon(L) })
            .addTo(map)
            .bindTooltip(String(i+1), { permanent: true, direction: 'center', className: 'gd-wp-num' })
            .bindPopup(`نقطة ${i+1}<br><small>انقر الرقم لحذفها</small>`);
          m.on('click', () => { snapshot(); state.route.splice(i, 1); redraw(); refreshStats(); });
          routeMarkers.push(m);
        });
      }
      if (!skipFit) fitToContent(L, map, [meetMarker, routeLine]);
      refreshStats();
    }

    // Tool buttons
    host.querySelectorAll('[data-tool]').forEach(btn => btn.addEventListener('click', () => {
      state.tool = btn.dataset.tool;
      applyToolStyles();
    }));

    // Clear route
    host.querySelector('[data-act="clear-route"]').addEventListener('click', () => {
      if (!state.route.length) return;
      snapshot();
      state.route = [];
      redraw();
    });

    // Undo
    host.querySelector('[data-act="undo"]').addEventListener('click', () => {
      const last = state.undoStack.pop();
      if (!last) return;
      state.meet = last.meet;
      state.route = last.route;
      redraw();
    });

    // Use my location (HTML5 Geolocation → sets meeting point)
    host.querySelector('[data-act="locate"]').addEventListener('click', () => {
      if (!navigator.geolocation) { alert('المتصفّح لا يدعم تحديد الموقع.'); return; }
      navigator.geolocation.getCurrentPosition(
        pos => {
          snapshot();
          state.meet = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          state.tool = 'route'; applyToolStyles();
          redraw();
          map.setView([state.meet.lat, state.meet.lng], 14);
        },
        () => alert('تعذّر الحصول على موقعك. تأكّد من السماح للموقع.'),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });

    // Click map → smart: first click sets meeting point if none, after that adds route waypoints
    map.on('click', (e) => {
      snapshot();
      const { lat, lng } = e.latlng;
      if (state.tool === 'meet' || !state.meet) {
        state.meet = { lat, lng };
        // After placing the meeting point, auto-switch to route mode — the
        // common follow-up is to draw the path FROM the meeting point.
        if (state.tool === 'meet') { state.tool = 'route'; applyToolStyles(); }
      } else {
        state.route.push({ lat, lng });
      }
      redraw(true);
    });

    // Search box (debounced) + result list
    let searchTimer = null, lastQuery = '';
    function hideResults() { results.style.display = 'none'; results.innerHTML = ''; }
    searchInp.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = searchInp.value.trim();
      if (q.length < 2) { hideResults(); return; }
      searchTimer = setTimeout(async () => {
        if (q === lastQuery) return;
        lastQuery = q;
        results.style.display = 'block';
        results.innerHTML = '<div style="padding:10px;color:#888;font-size:.85rem">جارٍ البحث…</div>';
        const hits = await geocode(q);
        if (!hits.length) { results.innerHTML = '<div style="padding:10px;color:#888;font-size:.85rem">لا توجد نتائج. جرّب اسماً آخر.</div>'; return; }
        results.innerHTML = hits.map((h, i) =>
          `<button type="button" data-i="${i}" style="display:block;width:100%;text-align:start;padding:10px 14px;background:transparent;border:0;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:.88rem">
             <span style="color:#0f7b6c;font-weight:700">📍</span> ${h.name.replace(/</g,'&lt;')}
           </button>`).join('');
        results.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
          const h = hits[+b.dataset.i];
          snapshot();
          if (state.tool === 'meet' || !state.meet) {
            state.meet = { lat: h.lat, lng: h.lng };
            if (state.tool === 'meet') { state.tool = 'route'; applyToolStyles(); }
          } else {
            state.route.push({ lat: h.lat, lng: h.lng });
          }
          map.setView([h.lat, h.lng], 13);
          searchInp.value = '';
          hideResults();
          redraw(true);
        }));
      }, 350);
    });
    document.addEventListener('click', (e) => {
      if (!host.contains(e.target)) hideResults();
    });

    applyToolStyles();
    redraw();
    setTimeout(() => map.invalidateSize(), 200);

    return {
      getData() {
        return {
          meetingPoint: state.meet ? { lat: state.meet.lat, lng: state.meet.lng } : null,
          route: state.route.map(p => ({ lat: p.lat, lng: p.lng })),
        };
      },
      setData(d) {
        snapshot();
        state.meet = d?.meetingPoint || null;
        state.route = (d?.route || []).slice();
        redraw();
      },
      invalidate() { map.invalidateSize(); },
      destroy()   { map.remove(); host.innerHTML = ''; },
    };
  }

  // ─── VIEWER ─────────────────────────────────────────────────────────
  async function viewer(elOrId, data) {
    const host = resolveEl(elOrId);
    if (!host) throw new Error('gdMap.viewer: container not found');
    host.innerHTML = '<div class="gd-map-canvas" style="height:360px;border-radius:12px;overflow:hidden;border:1px solid #dee2e6;background:#eef2f7"></div>';
    const canvas = host.querySelector('.gd-map-canvas');

    const L = await loadLeaflet();
    const map = L.map(canvas, { scrollWheelZoom: false }).setView([OMAN.lat, OMAN.lng], OMAN.zoom);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);

    let meetMarker = null, routeLine = null;
    if (data && data.meetingPoint && Number.isFinite(data.meetingPoint.lat)) {
      meetMarker = L.marker([data.meetingPoint.lat, data.meetingPoint.lng], { icon: meetIcon(L) })
        .addTo(map)
        .bindPopup('📍 نقطة اللقاء')
        .openPopup();
    }
    if (data && Array.isArray(data.route) && data.route.length) {
      const latlngs = data.route.map(p => [p.lat, p.lng]);
      routeLine = L.polyline(latlngs, { color: '#1a2c5b', weight: 4, opacity: 0.85 }).addTo(map);
      data.route.forEach((p, i) => {
        L.circleMarker([p.lat, p.lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#1a2c5b', fillOpacity: 1 })
          .addTo(map)
          .bindTooltip(String(i+1), { permanent: true, direction: 'center', className: 'gd-wp-num' });
      });
    }
    fitToContent(L, map, [meetMarker, routeLine]);

    setTimeout(() => map.invalidateSize(), 200);
    return { destroy() { map.remove(); host.innerHTML = ''; } };
  }

  // Tiny stylesheet for the waypoint number tooltip — added once.
  if (!document.getElementById('gd-map-style')) {
    const st = document.createElement('style');
    st.id = 'gd-map-style';
    st.textContent = '.gd-wp-num{background:transparent!important;border:0!important;box-shadow:none!important;color:#fff;font-weight:800;font-size:11px;text-shadow:0 1px 2px rgba(0,0,0,.6)}.leaflet-tooltip-top:before,.leaflet-tooltip-bottom:before,.leaflet-tooltip-left:before,.leaflet-tooltip-right:before{display:none}';
    document.head.appendChild(st);
  }

  // ─── LANDMARKS (region page: many pins, colour-coded by type) ─────
  // Each landmark: { name_ar, name_en, lat, lng, type? }
  const TYPE_COLORS = {
    religious:'#7c3aed', culture:'#d97706', fort:'#b45309', museum:'#0369a1',
    nature:'#15803d',    beach:'#0891b2',   mountain:'#7f1d1d', desert:'#b45309',
    heritage:'#a16207', city:'#1f2937', default:'#0f7b6c',
  };
  const TYPE_GLYPH = {
    religious:'🕌', culture:'🎭', fort:'🏰', museum:'🏛️',
    nature:'🌿',    beach:'🏖️',   mountain:'⛰️', desert:'🏜️',
    heritage:'🗿', city:'🏙️', default:'📍',
  };

  async function landmarks(elOrId, items, opts) {
    const host = resolveEl(elOrId);
    if (!host) throw new Error('gdMap.landmarks: container not found');
    const isAr = (opts && opts.lang) ? opts.lang === 'ar'
                                     : (document.documentElement.lang || '').toLowerCase().startsWith('ar');
    host.innerHTML = `
      <div class="gd-map-legend" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;font-size:.78rem"></div>
      <div class="gd-map-canvas" style="height:460px;border-radius:14px;overflow:hidden;border:1px solid #dee2e6;background:#eef2f7"></div>`;
    const canvas = host.querySelector('.gd-map-canvas');
    const legend = host.querySelector('.gd-map-legend');

    const L = await loadLeaflet();
    const map = L.map(canvas, { scrollWheelZoom: false }).setView([OMAN.lat, OMAN.lng], OMAN.zoom);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);

    const bounds = L.latLngBounds([]);
    const typesShown = new Set();
    (items || []).forEach((p) => {
      if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
      const type  = p.type || 'default';
      const color = TYPE_COLORS[type] || TYPE_COLORS.default;
      const glyph = TYPE_GLYPH[type] || TYPE_GLYPH.default;
      const icon  = makeIcon(L, color, glyph);
      const name  = (isAr && p.name_ar) ? p.name_ar : (p.name_en || p.name_ar || '');
      const gmaps = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
      L.marker([p.lat, p.lng], { icon })
        .addTo(map)
        .bindPopup(`<div style="font-weight:700;margin-bottom:4px">${name}</div>
                    <a href="${gmaps}" target="_blank" rel="noopener" style="font-size:.85rem">${isAr?'افتح في خرائط Google':'Open in Google Maps'} ↗</a>`);
      bounds.extend([p.lat, p.lng]);
      typesShown.add(type);
    });

    // Legend chips for the types actually on the map
    const TYPE_LABEL = {
      religious:{ar:'ديني',en:'Religious'}, culture:{ar:'ثقافي',en:'Culture'},
      fort:{ar:'قلاع',en:'Forts'},          museum:{ar:'متاحف',en:'Museums'},
      nature:{ar:'طبيعة',en:'Nature'},      beach:{ar:'شواطئ',en:'Beach'},
      mountain:{ar:'جبال',en:'Mountains'},  desert:{ar:'صحراء',en:'Desert'},
      heritage:{ar:'تراث',en:'Heritage'},   city:{ar:'مدن',en:'Cities'},
    };
    legend.innerHTML = [...typesShown].map(t => {
      const c = TYPE_COLORS[t] || TYPE_COLORS.default;
      const lbl = TYPE_LABEL[t] ? (isAr?TYPE_LABEL[t].ar:TYPE_LABEL[t].en) : t;
      return `<span style="display:inline-flex;align-items:center;gap:5px;background:#fff;border:1px solid #e5e7eb;padding:3px 9px;border-radius:999px">
        <span style="width:9px;height:9px;border-radius:50%;background:${c}"></span>${lbl}</span>`;
    }).join('');

    if (bounds.isValid()) map.fitBounds(bounds.pad(0.18), { maxZoom: 12 });
    setTimeout(() => map.invalidateSize(), 200);
    return { destroy() { map.remove(); host.innerHTML = ''; } };
  }

  window.gdMap = { editor, viewer, landmarks, loadLeaflet };
})();
