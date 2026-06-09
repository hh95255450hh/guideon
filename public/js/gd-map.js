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

  // ─── EDITOR ─────────────────────────────────────────────────────────
  async function editor(elOrId, initial) {
    const host = resolveEl(elOrId);
    if (!host) throw new Error('gdMap.editor: container not found');
    host.innerHTML = `
      <div class="gd-map-toolbar" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        <button type="button" data-tool="meet"  class="btn btn-sm btn-success">📍 نقطة اللقاء</button>
        <button type="button" data-tool="route" class="btn btn-sm btn-outline-primary">🛣️ المسار</button>
        <button type="button" data-act="clear-route" class="btn btn-sm btn-outline-danger">🗑️ مسح المسار</button>
        <span class="gd-map-hint small text-muted" style="align-self:center;margin-inline-start:auto">انقر على الخريطة لتحديد نقطة اللقاء.</span>
      </div>
      <div class="gd-map-canvas" style="height:340px;border-radius:12px;overflow:hidden;border:1px solid #dee2e6"></div>`;
    const canvas = host.querySelector('.gd-map-canvas');

    const L = await loadLeaflet();
    const map = L.map(canvas).setView([OMAN.lat, OMAN.lng], OMAN.zoom);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);

    let state = {
      meet: (initial && initial.meetingPoint) || null,    // {lat,lng,...}
      route: Array.isArray(initial && initial.route) ? initial.route.slice() : [],
      tool: 'meet',
    };
    let meetMarker = null;
    let routeMarkers = [];
    let routeLine = null;

    function redraw() {
      if (meetMarker) { map.removeLayer(meetMarker); meetMarker = null; }
      routeMarkers.forEach(m => map.removeLayer(m)); routeMarkers = [];
      if (routeLine) { map.removeLayer(routeLine); routeLine = null; }

      if (state.meet) {
        meetMarker = L.marker([state.meet.lat, state.meet.lng], { icon: meetIcon(L), draggable: true })
          .addTo(map)
          .bindPopup('📍 نقطة اللقاء<br><small>اسحبها لتعديل الموقع</small>');
        meetMarker.on('dragend', e => { const ll = e.target.getLatLng(); state.meet = { lat: ll.lat, lng: ll.lng }; });
      }
      if (state.route.length) {
        const latlngs = state.route.map(p => [p.lat, p.lng]);
        routeLine = L.polyline(latlngs, { color: '#1a2c5b', weight: 4, opacity: 0.85, dashArray: '6,8' }).addTo(map);
        state.route.forEach((p, i) => {
          const m = L.marker([p.lat, p.lng], { icon: waypointIcon(L) })
            .addTo(map)
            .bindTooltip(String(i+1), { permanent: true, direction: 'center', className: 'gd-wp-num' });
          m.on('click', () => {
            state.route.splice(i, 1);
            redraw();
          });
          routeMarkers.push(m);
        });
      }
      fitToContent(L, map, [meetMarker, routeLine]);
    }

    // Tool switching
    host.querySelectorAll('[data-tool]').forEach(btn => btn.addEventListener('click', () => {
      state.tool = btn.dataset.tool;
      host.querySelectorAll('[data-tool]').forEach(b => {
        b.classList.toggle('btn-success', b.dataset.tool === 'meet' && state.tool === 'meet');
        b.classList.toggle('btn-outline-success', b.dataset.tool === 'meet' && state.tool !== 'meet');
        b.classList.toggle('btn-primary', b.dataset.tool === 'route' && state.tool === 'route');
        b.classList.toggle('btn-outline-primary', b.dataset.tool === 'route' && state.tool !== 'route');
      });
      host.querySelector('.gd-map-hint').textContent = state.tool === 'meet'
        ? 'انقر على الخريطة لتحديد نقطة اللقاء.'
        : 'انقر على الخريطة لإضافة نقاط على المسار (بالترتيب). انقر على رقم لحذفه.';
    }));
    host.querySelector('[data-act="clear-route"]').addEventListener('click', () => { state.route = []; redraw(); });

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      if (state.tool === 'meet') state.meet = { lat, lng };
      else                       state.route.push({ lat, lng });
      redraw();
    });

    redraw();

    // Fix grey-tile bug if map opens in a hidden container (modal).
    setTimeout(() => map.invalidateSize(), 200);

    return {
      getData() {
        return {
          meetingPoint: state.meet ? { lat: state.meet.lat, lng: state.meet.lng } : null,
          route: state.route.map(p => ({ lat: p.lat, lng: p.lng })),
        };
      },
      setData(d) { state.meet = d?.meetingPoint || null; state.route = (d?.route || []).slice(); redraw(); },
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

  window.gdMap = { editor, viewer, loadLeaflet };
})();
