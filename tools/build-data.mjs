// Builds data/highways.json, nodes.json, segments.json, landmarks.json.
//
// Geography (lat/lon, which highways meet, where a line ends) comes from data/osm/summary.json, which is derived from
// OpenStreetMap by tools/derive_osm.py. This file only holds what OSM cannot say: schematic x,y, levels, colours, names.
// A node that points at OSM evidence is verified:true; the build fails if the evidence is missing.
//
// Run: npm run build:data
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const osm = JSON.parse(readFileSync(new URL('data/osm/summary.json', root)));
const OSM_SOURCE = 'osm_overture';

// ---------- schematic grid: positions keep ORDER (who is north/west of whom), not distance ----------
const X = { hemW: 110, hakimW: 170, niaW: 190, azadi: 215, yad: 300, milad: 400, cham: 500, kord: 680, rah: 710, vali: 770, taj: 960, mod: 860, say: 1220, imam: 1340, east: 1420, azgBottom: 250, azgWp: 780, azgEnd: 806 };
const Y = { imamN: 280, taj: 272, sayTop: 320, top: 340, n: 440, h: 560, milad: 640, hr: 740, kordS: 840, haft: 880, sepah: 920, tohid: 940, azadi: 960, yadS: 1000, azgStart: 1010, rah: 1052, navS: 1060, azgEnd: 1124, azgBottom: 1150, imamS: 1190 };

// ---------- OSM lookups ----------
const hwFa = {};
const pairKey = (a, b) => (osm.junctions[`${a}|${b}`] ? `${a}|${b}` : `${b}|${a}`);
function fromOsm(spec) {
  const [kind, a, b] = spec;
  if (kind === 'J') {
    const j = osm.junctions[pairKey(a, b)];
    if (!j) throw new Error(`no OSM junction for ${a} x ${b}`);
    const p = j.primary;
    return { lat: p.lat_lon[0], lon: p.lat_lon[1], evidence: { kind: 'junction', pair: pairKey(a, b), min_dist_m: p.min_dist_m, lines_cross: p.crossing, ramp_in_osm: p.ramp, other_clusters: j.others.length } };
  }
  if (kind === 'E') {
    const e = osm.highways[a]?.extremes[b];
    if (!e) throw new Error(`no OSM extreme ${a}.${b}`);
    return { lat: e[0], lon: e[1], evidence: { kind: 'end', highway: a, end: b } };
  }
  if (kind === 'C') {
    const key = osm.continuations[`${a}|${b}`] ? `${a}|${b}` : `${b}|${a}`;
    const c = osm.continuations[key];
    if (!c) throw new Error(`no OSM continuation ${a} -> ${b}`);
    return { lat: c.lat_lon[0], lon: c.lat_lon[1], evidence: { kind: 'name_change', pair: key, gap_m: c.gap_m } };
  }
  throw new Error(`bad spec ${spec}`);
}

// ---------- highways ----------
const H = (id, name_fa, name_en, orientation, color, level, extra = {}) => ({ id, name_fa, name_en, orientation, color, level, ...extra });
const highwayDefs = [
  H('kordestan', 'کردستان', 'Kordestan', 'NS', '#1565C0', 1),
  H('modares', 'مدرس', 'Modares', 'NS', '#0D47A1', 1, { name_en_alt: 'Modarres' }),
  H('sayyad', 'صیاد شیرازی', 'Sayyad Shirazi', 'NS', '#1E88E5', 1, { note: 'Leans north-east (NNE); still reads as a vertical line.' }),
  H('navvab', 'نواب', 'Navvab', 'NS', '#2E7DD7', 2, { note: 'Continuation of Chamran south of the Tohid Tunnel.' }),
  H('imam_ali', 'امام علی', 'Imam Ali', 'NS', '#0277BD', 2, { note: 'Drawn from its north end to its south end in OSM (~23 km north-south).' }),
  H('niayesh', 'نیایش', 'Niayesh', 'EW', '#D84315', 1, { official_name_fa: 'آیت‌الله هاشمی رفسنجانی', official_name_en: 'Hashemi Rafsanjani Expressway', note: 'OSM name is the official one. Reaches Sadr through a tunnel (~1.5 km gap in OSM).' }),
  H('hemmat', 'همت', 'Hemmat', 'EW', '#EF6C00', 1, { note: 'Becomes Zeinoddin at the Sayyad Shirazi junction.' }),
  H('resalat', 'رسالت', 'Resalat', 'EW', '#F59E0B', 1, { official_name_fa: 'سپهبد قاسم سلیمانی', official_name_en: 'Qasem Soleimani Expressway', note: 'OSM names it Soleimani. Starts where Hakim ends.' }),
  H('sadr', 'صدر', 'Sadr', 'EW', '#E64A19', 2),
  H('babaei', 'بابایی', 'Babaei', 'EW', '#BF360C', 2, { name_en_alt: 'Babayi' }),
  H('zeinoddin', 'زین‌الدین', 'Zeinoddin', 'EW', '#F57C00', 2, { note: 'Continuation of Hemmat east of Sayyad Shirazi.' }),
  H('hakim', 'حکیم', 'Hakim', 'EW', '#FB8C00', 2),
  H('chamran', 'چمران', 'Chamran', 'MIXED', '#7B1FA2', 3, { note: 'North-south, but its top turns west-east over to Parkway, so Chamran + Modares make an upside-down U.' }),
  H('yadegar', 'یادگار امام', 'Yadegar-e Emam', 'MIXED', '#9C27B0', 3, { note: 'West-east at the top, then north-south.' }),
  H('azadegan', 'آزادگان', 'Azadegan', 'DIAGONAL', '#6A1B9A', 3, { note: 'Runs north-west to south-east as an arc along the south of the city. In OSM it does not touch any of the other 14 highways.' })
];

// ---------- nodes ----------
// osm: ['J', a, b] junction | ['E', hw, north|south|west|east] line end | ['C', a, b] name change | null = schematic only
const N = (id, name_fa, name_en, type, x, y, osmSpec, note = '', extra = {}) => ({ id, name_fa, name_en, type, x, y, osmSpec, note, ...extra });
const nodeDefs = [
  // north
  N('n_artesh', 'انتهای شمالی امام علی', 'Imam Ali north end', 'endpoint', X.imam, Y.imamN, ['E', 'imam_ali', 'north']),
  N('n_say_imam', 'صیاد شیرازی × امام علی', 'Sayyad Shirazi x Imam Ali (Sayyad ends here)', 'interchange', X.imam, Y.sayTop, ['J', 'sayyad', 'imam_ali'], 'Sayyad Shirazi runs up and joins Imam Ali here; it does not reach Babaei.'),
  N('n_parkway', 'پارک‌وی', 'Parkway (Chamran meets Modares)', 'interchange', X.mod, Y.top, ['C', 'chamran', 'modares'], 'Chamran and Modares are ~0.6 km apart in OSM here; Parkway is the usual name for the bridge.', { alias_fa: 'پارک‌وی', alias_source: 'wp_chamran' }),
  N('n_seoul', 'چمران × یادگار امام', 'Chamran x Yadegar-e Emam (Seoul St)', 'interchange', X.cham, Y.top, ['J', 'chamran', 'yadegar']),
  N('n_yad_bend', '', 'Yadegar-e Emam bend (west -> south)', 'waypoint', X.yad, Y.top, ['E', 'yadegar', 'west'], 'Not a junction: the westernmost point of Yadegar, where it turns south.'),
  // north row: Niayesh -> (tunnel) -> Sadr -> Babaei
  N('n_nia_w', 'انتهای غربی نیایش', 'Niayesh west end', 'endpoint', X.niaW, Y.n, ['E', 'niayesh', 'west']),
  N('n_nia_yad', 'نیایش × یادگار امام', 'Niayesh x Yadegar-e Emam', 'interchange', X.yad, Y.n, ['J', 'niayesh', 'yadegar']),
  N('n_velayat', 'نیایش × چمران', 'Niayesh x Chamran', 'interchange', X.cham, Y.n, ['J', 'niayesh', 'chamran'], '', { alias_fa: 'پل ولایت', alias_source: 'wp_chamran' }),
  N('n_nia_kord', 'نیایش × کردستان', 'Niayesh x Kordestan', 'interchange', X.kord, Y.n, ['J', 'kordestan', 'niayesh'], 'Kordestan starts here.'),
  N('n_nia_vali', 'انتهای شرقی نیایش', 'Niayesh east end (tunnel to Sadr)', 'endpoint', X.vali, Y.n, ['E', 'niayesh', 'east']),
  N('n_sadr_mod', 'صدر × مدرس', 'Sadr x Modares', 'interchange', X.mod, Y.n, ['J', 'modares', 'sadr'], 'Sadr starts here (its tunnel from Niayesh arrives from the west).'),
  N('n_sadr_say', 'صدر × صیاد شیرازی', 'Sadr x Sayyad Shirazi', 'interchange', X.say, Y.n, ['J', 'sayyad', 'sadr']),
  N('n_imam_sadr_bab', 'امام علی × صدر/بابایی', 'Imam Ali x Sadr/Babaei', 'interchange', X.imam, Y.n, ['J', 'imam_ali', 'babaei'], 'Sadr becomes Babaei about 0.6 km east of this point.'),
  N('n_bab_e', 'انتهای شرقی بابایی', 'Babaei east end', 'endpoint', X.east, Y.n, ['E', 'babaei', 'east']),
  // middle row: Hemmat -> Zeinoddin
  N('n_hem_w', 'انتهای غربی همت', 'Hemmat west end (continues as Kharrazi)', 'endpoint', X.hemW, Y.h, ['E', 'hemmat', 'west'], 'OSM: Hemmat runs into Kharrazi Expressway here.'),
  N('n_hem_yad', 'همت × یادگار امام', 'Hemmat x Yadegar-e Emam', 'interchange', X.yad, Y.h, ['J', 'hemmat', 'yadegar'], 'No ramp chain found within 500 m: may be pass-through only.'),
  N('n_hem_cham', 'همت × چمران', 'Hemmat x Chamran', 'interchange', X.cham, Y.h, ['J', 'hemmat', 'chamran']),
  N('n_hem_kord', 'همت × کردستان', 'Hemmat x Kordestan', 'interchange', X.kord, Y.h, ['J', 'kordestan', 'hemmat']),
  N('n_fajr', 'همت × مدرس', 'Hemmat x Modares', 'interchange', X.mod, Y.h, ['J', 'modares', 'hemmat'], '', { alias_fa: 'تقاطع فجر', alias_source: 'wp_hemmat' }),
  N('n_hem_say', 'همت/زین‌الدین × صیاد شیرازی', 'Hemmat becomes Zeinoddin x Sayyad Shirazi', 'interchange', X.say, Y.h, ['J', 'sayyad', 'hemmat'], 'Hemmat ends and Zeinoddin begins exactly at the Sayyad Shirazi crossing (0 m gap).'),
  N('n_zei_imam', 'زین‌الدین × امام علی', 'Zeinoddin x Imam Ali', 'interchange', X.imam, Y.h, ['J', 'imam_ali', 'zeinoddin']),
  N('n_zei_e', 'انتهای شرقی زین‌الدین', 'Zeinoddin east end', 'endpoint', X.east, Y.h, ['E', 'zeinoddin', 'east']),
  // south row: Hakim -> Resalat
  N('n_hak_w', 'انتهای غربی حکیم', 'Hakim west end', 'endpoint', X.hakimW, Y.hr, ['E', 'hakim', 'west']),
  N('n_hak_yad', 'حکیم × یادگار امام', 'Hakim x Yadegar-e Emam', 'interchange', X.yad, Y.hr, ['J', 'hakim', 'yadegar']),
  N('n_hak_cham', 'حکیم × چمران', 'Hakim x Chamran', 'interchange', X.cham, Y.hr, ['J', 'hakim', 'chamran']),
  N('n_kord_hak_res', 'کردستان × حکیم/رسالت', 'Kordestan x Hakim/Resalat', 'interchange', X.kord, Y.hr, ['J', 'kordestan', 'hakim'], 'Hakim ends and Resalat begins about 0.25 km east of this crossing.'),
  N('n_res_mod', 'رسالت × مدرس', 'Resalat x Modares', 'interchange', X.mod, Y.hr, ['J', 'modares', 'resalat']),
  N('n_sayyad_ic', 'رسالت × صیاد شیرازی', 'Resalat x Sayyad Shirazi', 'interchange', X.say, Y.hr, ['J', 'sayyad', 'resalat'], '', { alias_fa: 'تقاطع صیاد شیرازی', alias_source: 'wp_sayyad' }),
  N('n_res_imam', 'رسالت × امام علی', 'Resalat x Imam Ali', 'interchange', X.imam, Y.hr, ['J', 'imam_ali', 'resalat']),
  N('n_res_e', 'انتهای شرقی رسالت', 'Resalat east end', 'endpoint', X.east, Y.hr, ['E', 'resalat', 'east']),
  // south ends
  N('n_kord_s', 'انتهای جنوبی کردستان', 'Kordestan south end', 'endpoint', X.kord, Y.kordS, ['E', 'kordestan', 'south']),
  N('n_haft_tir', 'انتهای جنوبی مدرس', 'Modares south end', 'endpoint', X.mod, Y.haft, ['E', 'modares', 'south']),
  N('n_sepah', 'انتهای جنوبی صیاد شیرازی', 'Sayyad Shirazi south end', 'endpoint', X.say, Y.sepah, ['E', 'sayyad', 'south']),
  N('n_tohid', 'تونل توحید', 'Tohid Tunnel (Chamran becomes Navvab)', 'interchange', X.cham, Y.tohid, ['C', 'chamran', 'navvab'], 'About 1 km gap between the two roads in OSM (the tunnel).'),
  N('n_nav_s', 'انتهای جنوبی نواب', 'Navvab south end', 'endpoint', X.cham, Y.navS, ['E', 'navvab', 'south']),
  N('n_yad_s', 'انتهای جنوبی یادگار امام', 'Yadegar-e Emam south end', 'endpoint', X.yad, Y.yadS, ['E', 'yadegar', 'south']),
  N('n_imam_s', 'انتهای جنوبی امام علی', 'Imam Ali south end', 'endpoint', X.imam, Y.imamS, ['E', 'imam_ali', 'south']),
  // Azadegan
  N('n_azg_start', 'انتهای شمال‌غربی آزادگان', 'Azadegan north-west end', 'endpoint', X.hemW, Y.azgStart, ['E', 'azadegan', 'west']),
  N('n_azg_bottom', '', 'Azadegan southernmost bend', 'waypoint', X.azgBottom, Y.azgBottom, ['E', 'azadegan', 'south'], 'Not a junction.'),
  N('n_azg_wp', '', 'Azadegan bend (schematic only)', 'waypoint', X.azgWp, Y.azgBottom, null, 'Only here so the line can use 0/45/90 degree angles.'),
  N('n_azg_end', 'انتهای جنوب‌شرقی آزادگان', 'Azadegan south-east end', 'endpoint', X.azgEnd, Y.azgEnd, ['E', 'azadegan', 'east'])
];

const LM = (id, name_fa, name_en, x, y, lat, lon, source, note) => ({ id: `lm_${id}`, name_fa, name_en, type: 'landmark', x, y, lat, lon, osmSpec: null, note, source });
const landmarkNodes = [
  LM('tajrish', 'تجریش', 'Tajrish', X.taj, Y.taj, 35.8056, 51.4381, ['wp_tajrish', 'wp_valiasr'], 'North end of Valiasr St.'),
  LM('milad', 'برج میلاد', 'Milad Tower', X.milad, Y.milad, 35.7447, 51.3753, ['wp_milad', 'surfiran_milad'], 'OSM check: Hemmat is north of it, Hakim south, Chamran east, Sheikh Fazlollah Nouri west.'),
  LM('azadi', 'برج آزادی', 'Azadi Tower', X.azadi, Y.azadi, 35.6994, 51.3378, ['wp_azadi'], 'West entrance of the city.'),
  LM('rahahan', 'ایستگاه راه‌آهن', 'Tehran railway station (Rah-Ahan)', X.rah, Y.rah, 35.658, 51.398, ['wp_tehran_rail', 'wp_valiasr'], 'South end of Valiasr St.')
];

const nodes = [];
for (const d of nodeDefs) {
  const { osmSpec, ...rest } = d;
  if (osmSpec) {
    const o = fromOsm(osmSpec);
    nodes.push({ ...rest, lat: o.lat, lon: o.lon, osm: o.evidence, verified: true, source: [OSM_SOURCE] });
  } else nodes.push({ ...rest, lat: null, lon: null, osm: null, verified: false, source: [] });
}
const landmarkChecks = osm.landmark_checks || {};
for (const l of landmarkNodes) {
  const { osmSpec, ...rest } = l;
  const chk = landmarkChecks[l.id.replace('lm_', '')];
  nodes.push({ ...rest, osm: chk ? { kind: 'consistency_check', ...chk } : null, verified: Boolean(chk && chk.all_ok) });
}
const byId = Object.fromEntries(nodes.map(n => [n.id, n]));

// ---------- routes: node chains, north->south for NS, west->east for EW ----------
const routes = {
  kordestan: ['n_nia_kord', 'n_hem_kord', 'n_kord_hak_res', 'n_kord_s'],
  modares: ['n_parkway', 'n_sadr_mod', 'n_fajr', 'n_res_mod', 'n_haft_tir'],
  sayyad: ['n_say_imam', 'n_sadr_say', 'n_hem_say', 'n_sayyad_ic', 'n_sepah'],
  navvab: ['n_tohid', 'n_nav_s'],
  imam_ali: ['n_artesh', 'n_say_imam', 'n_imam_sadr_bab', 'n_zei_imam', 'n_res_imam', 'n_imam_s'],
  niayesh: ['n_nia_w', 'n_nia_yad', 'n_velayat', 'n_nia_kord', 'n_nia_vali', 'n_sadr_mod'],
  hemmat: ['n_hem_w', 'n_hem_yad', 'n_hem_cham', 'n_hem_kord', 'n_fajr', 'n_hem_say'],
  resalat: ['n_kord_hak_res', 'n_res_mod', 'n_sayyad_ic', 'n_res_imam', 'n_res_e'],
  sadr: ['n_sadr_mod', 'n_sadr_say', 'n_imam_sadr_bab'],
  babaei: ['n_imam_sadr_bab', 'n_bab_e'],
  zeinoddin: ['n_hem_say', 'n_zei_imam', 'n_zei_e'],
  hakim: ['n_hak_w', 'n_hak_yad', 'n_hak_cham', 'n_kord_hak_res'],
  chamran: ['n_parkway', 'n_seoul', 'n_velayat', 'n_hem_cham', 'n_hak_cham', 'n_tohid'],
  yadegar: ['n_seoul', 'n_yad_bend', 'n_nia_yad', 'n_hem_yad', 'n_hak_yad', 'n_yad_s'],
  azadegan: ['n_azg_start', 'n_azg_bottom', 'n_azg_wp', 'n_azg_end']
};
const segKind = { 'niayesh:n_nia_vali:n_sadr_mod': { kind: 'tunnel', note: 'Tunnel linking Niayesh east end to Sadr (~1.5 km gap in OSM).' },
  'chamran:n_hak_cham:n_tohid': { kind: 'road', note: 'Ends at the Tohid Tunnel, which continues as Navvab.' } };

function dir(a, b) {
  const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
  return ({ '0,-1': 'N', '0,1': 'S', '1,0': 'E', '-1,0': 'W', '1,-1': 'NE', '-1,-1': 'NW', '1,1': 'SE', '-1,1': 'SW' })[`${dx},${dy}`];
}
// A segment is verified when both ends come from OSM and no coordinate runs against the drawing (tolerance ~220 m).
function agreesWithOsm(a, b) {
  if (a.lat == null || b.lat == null) return false;
  const tol = 0.002, dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
  const dlat = b.lat - a.lat, dlon = b.lon - a.lon;
  if (dy !== 0 && Math.abs(dlat) > tol && Math.sign(dlat) !== -dy) return false; // schematic y grows southward
  if (dx !== 0 && Math.abs(dlon) > tol && Math.sign(dlon) !== dx) return false;
  return true;
}

const segments = [];
for (const h of highwayDefs) {
  const r = routes[h.id];
  for (let i = 0; i < r.length - 1; i++) {
    const a = byId[r[i]], b = byId[r[i + 1]];
    const extra = segKind[`${h.id}:${a.id}:${b.id}`] || {};
    const ok = a.verified && b.verified && agreesWithOsm(a, b);
    segments.push({ id: `s_${h.id}_${i + 1}`, highway_id: h.id, from_node: a.id, to_node: b.id, direction: dir(a, b), order_on_highway: i + 1, kind: 'road', verified: ok, source: ok ? [OSM_SOURCE] : [], ...extra });
  }
}

// ---------- highways: verified when the real extents fit the declared orientation ----------
const highways = highwayDefs.map(h => {
  const s = osm.highways[h.id];
  const fits = { NS: s.rule_orientation === 'NS', EW: s.rule_orientation === 'EW',
    MIXED: s.ew_extent_km >= 2 && s.ns_extent_km >= 2, DIAGONAL: s.ew_extent_km >= 5 && s.ns_extent_km >= 5 }[h.orientation];
  return { ...h, verified: Boolean(fits), source: fits ? [OSM_SOURCE] : [], osm: { ew_extent_km: s.ew_extent_km, ns_extent_km: s.ns_extent_km, way_count: s.osm_way_count } };
});

const landmarks = [
  { id: 'tajrish', node_id: 'lm_tajrish', name_fa: 'تجریش', name_en: 'Tajrish', icon: 'tree', hint_fa: 'بالاترین نقطه، نزدیک کوه', elevation_m: 1615 },
  { id: 'milad', node_id: 'lm_milad', name_fa: 'برج میلاد', name_en: 'Milad Tower', icon: 'tower', hint_fa: 'بین همت (بالا) و حکیم (پایین)', elevation_m: null },
  { id: 'azadi', node_id: 'lm_azadi', name_fa: 'برج آزادی', name_en: 'Azadi Tower', icon: 'arch', hint_fa: 'دروازه‌ی غرب شهر', elevation_m: null },
  { id: 'rahahan', node_id: 'lm_rahahan', name_fa: 'ایستگاه راه‌آهن', name_en: 'Railway station (Rah-Ahan)', icon: 'train', hint_fa: 'پایین شهر، سر دیگر ولیعصر', elevation_m: 1117 }
].map(l => ({ ...l, verified: byId[l.node_id].verified, source: byId[l.node_id].source }));

const w = (f, rows, about) => writeFileSync(new URL(`data/${f}.json`, root), JSON.stringify({ _about: about, rows }, null, 2) + '\n');
w('highways', highways, 'One row per highway. orientation: NS | EW | DIAGONAL | MIXED. verified = the real OSM extents fit the declared orientation.');
w('nodes', nodes, 'Interchanges, ends, squares, landmarks, bends. x,y = schematic position (north up, smaller y = further north, order only). lat/lon from OpenStreetMap, hidden from the learner. osm = the evidence behind each node.');
w('segments', segments, 'Edges. direction = compass direction on the schematic from from_node to to_node. verified = both ends from OSM and no coordinate runs against the drawing.');
w('landmarks', landmarks, 'Memory anchors for Level 0. Coordinates come from Wikipedia; only Milad Tower is checked against OSM roads. elevation_m is for the data panel only.');
const v = a => a.filter(r => r.verified).length;
console.log(`${highways.length} highways (${v(highways)} verified), ${nodes.length} nodes (${v(nodes)}), ${segments.length} segments (${v(segments)}), ${landmarks.length} landmarks (${v(landmarks)})`);
