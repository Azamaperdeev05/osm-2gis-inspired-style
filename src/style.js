// OSM · 2ГИС-ке ұқсас MapLibre стилі
// Copyright (c) 2026 Azamat Perdeev — MIT License (LICENSE файлын қараңыз)
//
// Бұл файл — стильдің өзегі: палитралар (ашық / қара), POI иконкалары және OpenFreeMap Liberty стилін
// 2ГИС-ке ұқсас етіп қайта бояйтын `loadStyle(key)`. Басқа жобада қолдану үшін осы файлды көшіріп,
// `await loadIcons()` шақырыңыз, содан кейін `new maplibregl.Map({ style: await loadStyle('2gis') })` деп жазыңыз.
// `styleimagemissing` оқиғасымен иконкаларды қосу үшін app.js-ті қараңыз.
//
// 2ГИС-пен байланысы жоқ: түстер тек көзбен салыстыру үшін өлшенген, 2ГИС деректері, иконкалары, тайлдары қолданылмайды.

// OpenFreeMap (OSM деректері, векторлық) стилін алып, 2ГИС түстеріне қайта бояймыз
// Екі палитра да 2ГИС скриншоттарынан пиксельдер бойынша өлшенген
const LIGHT = {
  bg: '#faf8ec', bgLow: '#fef9eb',                // жер: үлкен масштабта сұрғылт, кіші масштабта (қала сыртында) жылы крем
  urban: '#f4efda',                                // кіші масштабтағы қала аймағы
  park: '#d9ecb8', parkLow: '#d2eda9', grass: '#e6efd2',
  water: '#a3d8ef',
  school: '#eadbed', hospital: '#dde3f3',          // сиреневый / көгілдір аймақтар
  building: '#ece8dd', buildingEdge: '#ddd8ca',
  roadMinor: '#fefef3', casingMinor: '#dbd8cb',    // ақ көшелер
  roadMajor: '#c4c4c4', casingMajor: '#adaca6',    // сұр даңғылдар
  orange: '#f09f2b', orangeLight: '#f1cb8f',       // кіші масштабтағы негізгі / қосалқы жолдар
  path: '#fafaf6',                                 // 2ГИС-те жаяу жолдар ақ, тұтас
  text: '#383838', halo: '#fcf8eb', houseNum: '#7b786b',
  waterText: '#377695', town: '#292822', city: '#8f8c80', area: '#a4a091', roadName: '#503b2e',
  boundary3: '#cdc9b8', boundary2: '#b9b5a4',
  cat: { food: '#b76d16', shop: '#567f1d', health: '#e5322d', edu: '#3c7fc1', money: '#2b8a8a', transit: '#5994dd',
         car: '#6b6b6b', culture: '#8a5ad6', park: '#5aa02c', gov: '#9b6a3c', other: '#7b786b' }
};
const DARK = {
  dark: true,
  bg: '#1c2329', bgLow: '#1c2329', urban: '#23292e',
  park: '#24332c', parkLow: '#24332c', grass: '#2b3736',
  water: '#364a55',
  school: '#2c2b38', hospital: '#28303d',
  building: '#353e45', buildingEdge: '#505a5c',
  roadMinor: '#2c333b', casingMinor: '#1c2329',
  roadMajor: '#4f5368', casingMajor: '#1c2329',
  orange: '#60546c', orangeLight: '#3e4250',       // қара нұсқада кіші масштабтағы жолдар күлгін-сұр
  path: '#2a3136',
  text: '#c9cacd', halo: '#1c2329', houseNum: '#757a80',
  waterText: '#6f93a6', town: '#a5a4a9', city: '#a5a4a9', area: '#73777a', roadName: '#a9aaaf',
  boundary3: '#3a434a', boundary2: '#4a535a',
  cat: { food: '#c1680e', shop: '#4d890f', health: '#b54a3a', edu: '#4a7fb5', money: '#2b8a8a', transit: '#5a8fcf',
         car: '#7a7f85', culture: '#c4670a', park: '#4ea177', gov: '#9b6a3c', other: '#757a80' }
};
let C = LIGHT; // ағымдағы палитра — loadStyle ауыстырады

// 2ГИС кіші масштабта жолдарды қызғылт сары, үлкен масштабта ақ/сұр етеді: zoom 14 → 15.5 аралығында ауысады
const zoomMix = (low, high) => ['interpolate', ['linear'], ['zoom'], 14, low, 15.5, high];

// POI санаттары: санат → { OSM класы: Maki иконкасы }
// Иконкалар: Maki (CC0, https://github.com/mapbox/maki). Ашық нұсқада — ақ дөңгелек + түсті белгі, қарада — түсті дөңгелек + қара белгі
const POI = {
  food:    { restaurant: 'restaurant', food: 'restaurant', cafe: 'cafe', ice_cream: 'cafe', bakery: 'cafe', fast_food: 'fast-food', bar: 'bar', pub: 'bar', beer: 'bar' },
  shop:    { shop: 'shop', alcohol_shop: 'shop', grocery: 'grocery', supermarket: 'grocery', convenience: 'grocery', clothing_store: 'clothing-store', hairdresser: 'hairdresser' },
  health:  { hospital: 'hospital', pharmacy: 'pharmacy', doctors: 'doctor', doctor: 'doctor', dentist: 'dentist' },
  edu:     { school: 'school', kindergarten: 'school', college: 'college', library: 'library' },
  money:   { bank: 'bank', post: 'post' },
  transit: { bus: 'bus', railway: 'rail', rail: 'rail' },
  car:     { fuel: 'fuel', parking: 'parking', car: 'car' },
  culture: { museum: 'museum', theatre: 'theatre', cinema: 'cinema', attraction: 'attraction', stadium: 'stadium', lodging: 'lodging' },
  park:    { park: 'park', playground: 'playground' },
  gov:     { place_of_worship: 'place-of-worship', town_hall: 'town-hall', police: 'police' }
};
const poiEntries = Object.entries(POI).flatMap(([cat, m]) => Object.entries(m).map(([cls, maki]) => ({ cls, maki, cat })));
const iconId = (dark, maki, cat) => `g-${dark ? 'd' : 'l'}-${maki}-${cat}`;
const poiIconExpr = P => ['match', ['get', 'class'], ...poiEntries.flatMap(e => [e.cls, iconId(P.dark, e.maki, e.cat)]), iconId(P.dark, 'marker', 'other')];
const poiTextExpr = P => ['match', ['get', 'class'], ...poiEntries.flatMap(e => [e.cls, P.cat[e.cat]]), P.text];

const ICONS = {};
async function loadIcons() {
  const pairs = [...new Map([...poiEntries, { maki: 'marker', cat: 'other' }].map(e => [e.maki + e.cat, e])).values()];
  const svgs = {};
  await Promise.all([...new Set(pairs.map(p => p.maki))].map(async m => {
    try { svgs[m] = await (await fetch(`https://unpkg.com/@mapbox/maki@8.2.0/icons/${m}.svg`)).text(); } catch {}
  }));
  await Promise.all(pairs.flatMap(({ maki, cat }) => [LIGHT, DARK].map(async P => {
    if (!svgs[maki]) return; // иконка жүктелмесе, белгі жай көрінбейді — атауы қалады
    const color = P.cat[cat], glyph = P.dark ? P.bg : color;
    const img = new Image();
    img.src = 'data:image/svg+xml,' + encodeURIComponent(svgs[maki].replace('<svg ', `<svg fill="${glyph}" `));
    await img.decode();
    const g = Object.assign(document.createElement('canvas'), { width: 48, height: 48 }).getContext('2d');
    g.beginPath(); g.arc(24, 24, 22, 0, 2 * Math.PI);
    g.fillStyle = P.dark ? color : '#fff'; g.fill();
    if (!P.dark) { g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,.15)'; g.stroke(); }
    g.drawImage(img, 11, 11, 26, 26);
    ICONS[iconId(P.dark, maki, cat)] = g.getImageData(0, 0, 48, 48);
  })));
}

function paintFor(l) {
  const id = l.id, t = l.type;
  if (id === 'background') return { 'background-color': ['interpolate', ['linear'], ['zoom'], 12, C.bgLow, 15, C.bg] };
  if (t === 'raster') return { 'raster-opacity': 0 };
  if (/^(park|landcover_wood)$/.test(id)) return {
    'fill-color': ['interpolate', ['linear'], ['zoom'], 13, C.parkLow, 16, C.park], 'fill-opacity': 1, 'fill-outline-color': 'rgba(0,0,0,0)' };
  if (/^landcover_(grass|wetland)$/.test(id)) return { 'fill-color': C.grass, 'fill-opacity': 0.7 };
  if (id === 'park_outline') return { 'line-opacity': 0 };
  if (id === 'landuse_residential') return { 'fill-color': C.urban, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 12, 1, 14, 0] };
  if (/^landuse_(pitch|track)$/.test(id)) return { 'fill-color': C.bg };
  if (id === 'landuse_school') return { 'fill-color': C.school };
  if (/^landuse_(hospital|cemetery)$/.test(id)) return { 'fill-color': C.hospital };
  if (id === 'water') return { 'fill-color': C.water };
  if (/^waterway_/.test(id) && t === 'line') return { 'line-color': C.water };
  if (id === 'building') return { 'fill-color': C.building, 'fill-outline-color': C.buildingEdge };
  if (id === 'building-3d') return { 'fill-extrusion-color': C.building, 'fill-extrusion-vertical-gradient': false, 'fill-extrusion-opacity': 0.85 };
  if (/^(road|bridge|tunnel)_/.test(id) && t === 'line') {
    if (/rail|hatching/.test(id)) return null;
    const major = /trunk|motorway|_link/.test(id);
    // secondary 2ГИС-те үлкен масштабта да сұр, tertiary — ақ
    const bySecondary = (gray, white) => /secondary_tertiary/.test(id) ? ['match', ['get', 'class'], 'secondary', gray, white] : white;
    if (/casing/.test(id)) return { 'line-color': major ? C.casingMajor : bySecondary(C.casingMajor, C.casingMinor), 'line-opacity': zoomMix(0, 1) };
    if (/path|pedestrian/.test(id)) return { 'line-color': C.path, 'line-dasharray': [1, 0] };
    return { 'line-color': major ? zoomMix(C.orange, C.roadMajor) : zoomMix(C.orangeLight, bySecondary(C.roadMajor, C.roadMinor)) };
  }
  if (id === 'boundary_3') return { 'line-color': C.boundary3, 'line-opacity': 0.6 };
  if (id === 'boundary_2') return { 'line-color': C.boundary2, 'line-opacity': 0.8 };
  if (id === 'road_area_pattern') return { 'fill-opacity': C.dark ? 0.08 : 1 }; // ашық штрих қара фонда тым жарқырайды
  if (/^aeroway/.test(id)) return t === 'fill' ? { 'fill-color': C.urban } : { 'line-color': C.roadMinor };
  if (/^landcover_(sand|ice)$/.test(id)) return { 'fill-color': C.urban };
  if (t === 'symbol') {
    const color = id === 'poi_transit' ? C.cat.transit : /^poi_/.test(id) ? poiTextExpr(C)
                : /^water/.test(id) ? C.waterText
                : /^label_(city|city_capital)$/.test(id) ? C.city
                : /^label_(town|village)$/.test(id) ? C.town
                : /^label_(other|state)$/.test(id) ? C.area
                : id === 'highway-name-major' ? zoomMix(C.roadName, C.text)
                : C.text;
    return { 'text-color': color, 'text-halo-color': C.halo };
  }
  return null;
}

const LANG = 'ru'; // жазулар тілі: 'ru' | 'kk' | 'en'; жоқ жерде OSM-дағы жергілікті атау шығады
const nameField = ['coalesce', ['get', 'name:' + LANG], ['get', 'name']];

const LIBERTY = 'https://tiles.openfreemap.org/styles/liberty';
const VT = 'https://tiles.versatiles.org/assets/styles/';
const STYLES = {
  '2gis':   { label: '2ГИС стилі', url: LIBERTY, restyle: LIGHT },   // Liberty + біздің 2ГИС палитрасы
  '2gis-dark': { label: '2ГИС қара', url: LIBERTY, restyle: DARK },
  liberty:  { label: 'OSM Liberty', url: LIBERTY },
  bright:   { label: 'OSM Bright', url: 'https://tiles.openfreemap.org/styles/bright' },
  positron: { label: 'Positron (ашық сұр)', url: 'https://tiles.openfreemap.org/styles/positron' },
  colorful: { label: 'VersaTiles Colorful', url: VT + 'colorful/style.json' },
  dark:     { label: 'VersaTiles Dark', url: VT + 'colorful-dark/style.json' },
  gray:     { label: 'VersaTiles Gray', url: VT + 'gray/style.json' },
  muted:    { label: 'VersaTiles Muted', url: VT + 'muted/style.json' }
};

async function loadStyle(key) {
  const { url, restyle } = STYLES[key];
  const style = await (await fetch(url)).json();
  if (restyle) C = restyle;
  for (const l of style.layers) {
    // "Qonaev street Қонаев көшесі" сияқты қос тілді ұзын жазуды бір тілге қысқартамыз — сонда көше аттары сыяды
    if (JSON.stringify(l.layout?.['text-field'] ?? '').includes('name:nonlatin')) l.layout['text-field'] = nameField;
    if (!restyle) continue;
    const p = paintFor(l);
    if (p) l.paint = { ...l.paint, ...p };
    if (/^highway-name/.test(l.id)) {
      Object.assign(l.layout, { 'text-size': ['interpolate', ['linear'], ['zoom'], 14, 12, 17, 15], 'symbol-spacing': 180 });
      l.paint['text-halo-width'] = 2;
      if (l.id === 'highway-name-minor') l.minzoom = 14.5;
      if (l.id === 'highway-name-major') {
        l.minzoom = 10.5;
        l.filter = ['match', ['get', 'class'], ['motorway', 'primary', 'secondary', 'tertiary', 'trunk'], true, false];
        l.paint['text-halo-width'] = zoomMix(0, 2); // кіші масштабта жазу қызғылт сары жолды үзбесін
      }
    }
    if (/^poi_/.test(l.id)) Object.assign(l.layout, { 'icon-image': poiIconExpr(C), 'icon-size': 1, 'text-font': ['Noto Sans Regular'] });
    if (/shield/.test(l.id)) l.layout.visibility = 'none';                  // KAZ01 сияқты жол белгілері 2ГИС-те жоқ
    if (l.id === 'landuse_residential') l.maxzoom = 14;
    if (/^label_(other|state)$/.test(l.id)) Object.assign(l.layout, { 'text-transform': 'none', 'text-font': ['Noto Sans Regular'] });
  }
  if (style.sources.openmaptiles) style.layers.push({ // VersaTiles-те үй нөмірі стильдің өзінде бар
    id: 'housenumber', type: 'symbol', source: 'openmaptiles', 'source-layer': 'housenumber', minzoom: 16,
    // allow-overlap + ignore-placement: нөмір басқа жазулармен соқтығысса да жасырылмайды және оларды да жасырмайды
    layout: { 'text-field': ['get', 'housenumber'], 'text-font': ['Noto Sans Regular'], 'text-size': 11,
              'text-allow-overlap': true, 'text-ignore-placement': true },
    paint: { 'text-color': restyle ? C.houseNum : '#7b786b', 'text-halo-color': restyle ? C.halo : '#fff', 'text-halo-width': 1 }
  });
  if (restyle) style.light = { anchor: 'viewport', intensity: 0.15, color: '#ffffff' }; // 3D үйлердің қою қабырғаларын жұмсартады
  return style;
}

