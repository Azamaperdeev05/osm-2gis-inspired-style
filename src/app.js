// Демо қосымша: карта, стиль таңдағыш, A → B маршрут (OSRM), баға, такси қабаттары.
// Copyright (c) 2026 Azamat Perdeev — MIT License

(async () => {
  const $ = id => document.getElementById(id);
  let current = '2gis';
  try { const s = localStorage.getItem('style'); if (STYLES[s]) current = s; } catch {}
  const [style] = await Promise.all([loadStyle(current), loadIcons()]);
  const map = new maplibregl.Map({ container: 'map', style, center: [71.43, 51.13], zoom: 15, hash: true });
  map.on('styleimagemissing', e => { if (ICONS[e.id] && !map.hasImage(e.id)) map.addImage(e.id, ICONS[e.id], { pixelRatio: 2 }); });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  const geolocate = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserLocation: true
  });
  map.addControl(geolocate, 'top-right');

  const sel = $('style');
  for (const [k, s] of Object.entries(STYLES)) sel.add(new Option(s.label, k));
  sel.value = current;
  sel.onchange = async () => {
    try { localStorage.setItem('style', sel.value); } catch {}
    map.setStyle(await loadStyle(sel.value), { diff: false });
  };

  // ---------- ТАКСИ ҚАБАТТАРЫ ----------
  const empty = { type: 'FeatureCollection', features: [] };
  let routeData = empty, driversData = empty, surgeData = empty;

  // Стиль ауысқанда қосымша қабаттар жоғалады, сондықтан style.load сайын қайта қосамыз (деректер жоғалмайды)
  map.on('style.load', () => {
    if (!map.hasImage('taxi-car')) map.addImage('taxi-car', carIcon()); // 'car' аты стильдің өз спрайтында бар
    // бірінші мәтін қабаты: сызықтар жолдардан жоғары, жазулардан төмен болады
    const first = map.getStyle().layers.find(l => l.type === 'symbol' && l.layout?.['text-field']);
    const below = first?.id;
    const data = { surge: surgeData, route: routeData, drivers: driversData };
    for (const id in data) map.addSource(id, { type: 'geojson', data: data[id] });
    map.addLayer({ id: 'surge-fill', type: 'fill', source: 'surge', paint: { 'fill-color': '#ff8a00', 'fill-opacity': 0.18 } }, below);
    map.addLayer({ id: 'surge-line', type: 'line', source: 'surge', paint: { 'line-color': '#ff8a00', 'line-width': 1.5 } }, below);
    const routeLayout = { 'line-cap': 'round', 'line-join': 'round' };
    map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: routeLayout, paint: { 'line-color': '#fff', 'line-width': 9 } }, below);
    map.addLayer({ id: 'route', type: 'line', source: 'route', layout: routeLayout, paint: { 'line-color': '#2d7ff9', 'line-width': 5 } }, below);
    map.addLayer({ id: 'surge-label', type: 'symbol', source: 'surge',
      layout: { 'text-field': ['concat', '×', ['get', 'k']], 'text-font': first?.layout['text-font'] ?? ['Noto Sans Regular'], 'text-size': 16 },
      paint: { 'text-color': '#c25e00', 'text-halo-color': '#fff', 'text-halo-width': 2 } });
    map.addLayer({ id: 'drivers', type: 'symbol', source: 'drivers',
      layout: { 'icon-image': 'taxi-car', 'icon-size': 0.6, 'icon-rotate': ['get', 'heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true } });
  });

  const setRoute = d => { routeData = d; map.getSource('route')?.setData(d); };

  // Сервермен байланыстыру: taxi.setDrivers([{lng, lat, heading}]), taxi.setSurge(GeoJSON Polygon, properties.k)
  window.taxi = {
    setDrivers: list => {
      driversData = { type: 'FeatureCollection', features: list.map(d => ({
        type: 'Feature', geometry: { type: 'Point', coordinates: [d.lng, d.lat] }, properties: { heading: d.heading ?? 0 } })) };
      map.getSource('drivers')?.setData(driversData);
    },
    setSurge: fc => { surgeData = fc; map.getSource('surge')?.setData(fc); }
  };

  // ---------- A → B ТАПСЫРЫС: белгілер, маршрут, баға ----------
  const TARIFF = { base: 600, perKm: 120, perMin: 20, cur: '₸' }; // жорамал тариф — өзіңіздікіне ауыстырыңыз
  const pts = {}, addr = {}, seqs = { A: 0, B: 0 };
  let info = '', routeId = 0;

  const render = () => {
    $('card').hidden = !pts.A && !pts.B;
    $('aA').textContent = addr.A ?? 'Картаны түртіңіз немесе геолокацияны басыңыз';
    $('aB').textContent = addr.B ?? 'Картаны түртіңіз немесе іздеңіз';
    $('info').textContent = info;
  };
  const reverse = ll => fetch(`https://nominatim.openstreetmap.org/reverse?format=json&accept-language=${LANG}&lat=${ll.lat}&lon=${ll.lng}`)
    .then(r => r.json()).then(d => d.display_name?.split(', ').slice(0, 2).join(', ') || '—').catch(() => '—');

  async function setPoint(k, ll) {
    if (pts[k]) pts[k].setLngLat(ll);
    else {
      pts[k] = new maplibregl.Marker({ color: k === 'A' ? '#1fa91f' : '#e5322d', draggable: true }).setLngLat(ll).addTo(map);
      pts[k].on('dragend', () => setPoint(k, pts[k].getLngLat()));
    }
    const id = ++seqs[k];
    addr[k] = '…'; render();
    const a = await reverse(ll);
    if (id === seqs[k]) { addr[k] = a; render(); }
    route();
  }

  async function route() {
    if (!pts.A || !pts.B) return;
    const id = ++routeId;
    const [a, b] = [pts.A.getLngLat(), pts.B.getLngLat()];
    info = 'Маршрут есептелуде…'; render();
    try {
      const r = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`)).json();
      if (id !== routeId) return;
      const rt = r.routes?.[0];
      if (!rt) throw 0;
      setRoute({ type: 'Feature', geometry: rt.geometry });
      const c0 = rt.geometry.coordinates[0];
      map.fitBounds(rt.geometry.coordinates.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(c0, c0)),
        { padding: { top: 80, bottom: 190, left: 50, right: 50 }, maxZoom: 17 });
      const km = rt.distance / 1000, min = rt.duration / 60;
      const price = Math.round((TARIFF.base + km * TARIFF.perKm + min * TARIFF.perMin) / 10) * 10;
      info = `${km.toFixed(1)} км · ${Math.round(min)} мин · ≈ ${price.toLocaleString('ru')} ${TARIFF.cur}`;
    } catch { if (id === routeId) info = 'Маршрут табылмады'; }
    if (id === routeId) render();
  }

  map.on('click', e => {
    if (e.originalEvent.target.closest('.maplibregl-marker')) return;
    setPoint(pts.A ? 'B' : 'A', e.lngLat);
  });
  geolocate.on('geolocate', p => { if (!pts.A) setPoint('A', { lng: p.coords.longitude, lat: p.coords.latitude }); });
  $('clear').onclick = () => {
    for (const k of ['A', 'B']) { pts[k]?.remove(); delete pts[k]; delete addr[k]; seqs[k]++; }
    routeId++; info = '';
    setRoute(empty); render();
  };

  $('f').onsubmit = async e => {
    e.preventDefault();
    const q = $('q').value.trim();
    if (!q) return;
    try {
      const [hit] = await (await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q))).json();
      if (!hit) return alert('Табылмады');
      const ll = { lng: +hit.lon, lat: +hit.lat };
      setPoint('B', ll);
      if (!pts.A) map.flyTo({ center: ll, zoom: 16 });
    } catch { alert('Іздеу қатесі'); }
  };
})();

// Жоғарыдан көрінетін сары такси белгісі (0° = солтүстікке қарайды)
function carIcon() {
  const g = Object.assign(document.createElement('canvas'), { width: 48, height: 48 }).getContext('2d');
  g.fillStyle = '#ffc400'; g.strokeStyle = '#222'; g.lineWidth = 2;
  g.beginPath(); g.roundRect(14, 4, 20, 40, 6); g.fill(); g.stroke();
  g.fillStyle = '#222'; g.fillRect(17, 12, 14, 8); g.fillRect(17, 30, 14, 6);
  return g.getImageData(0, 0, 48, 48);
}
