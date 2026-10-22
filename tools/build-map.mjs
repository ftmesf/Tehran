// Builds map/schematic.svg from the data tables. Run: npm run build:map
// Everything geographic comes from data/*.json; this file only holds presentation (where labels sit, art).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const load = f => JSON.parse(readFileSync(new URL(`data/${f}.json`, root))).rows;
const highways = load('highways');
const nodes = load('nodes');
const segments = load('segments');
const landmarks = load('landmarks');
const nodeById = new Map(nodes.map(n => [n.id, n]));
const allRows = [...highways, ...nodes, ...segments, ...landmarks];
const verifiedCount = allRows.filter(r => r.verified).length;

const W = 1600, H = 1400, MOUNTAIN_BASE = 250;

const font = (file, weight, range) =>
  `@font-face{font-family:'Vazirmatn';font-weight:${weight};unicode-range:${range};` +
  `src:url(data:font/woff2;base64,${readFileSync(new URL(`assets/fonts/${file}`, root)).toString('base64')}) format('woff2');}`;
const ARABIC = 'U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFC';
const LATIN = 'U+0000-00FF,U+2000-206F';

// Label pill placement per highway: [x, y] centre. Chosen by eye to sit at a line end without overlaps.
const LABEL_AT = {
  kordestan: [680, 892], modares: [860, 932], sayyad: [1220, 972], navvab: [500, 1112], imam_ali: [1340, 1056],
  niayesh: [100, 440], hemmat: [205, 512], zeinoddin: [1514, 560], resalat: [1500, 740], sadr: [1030, 392],
  babaei: [1500, 440], hakim: [215, 785], chamran: [640, 298], yadegar: [400, 298], azadegan: [560, 1202]
};
// Where the label sits relative to a landmark badge.
const LANDMARK_LABEL = { tajrish: 'right', milad: 'below', azadi: 'below', rahahan: 'right' };

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const pathFor = ids => ids.map((id, i) => `${i ? 'L' : 'M'}${nodeById.get(id).x} ${nodeById.get(id).y}`).join(' ');

function routeOf(hwId) {
  const segs = segments.filter(s => s.highway_id === hwId).sort((a, b) => a.order_on_highway - b.order_on_highway);
  return { segs, ids: [segs[0].from_node, ...segs.map(s => s.to_node)] };
}

// ---------- background: slope gradient + soft contour bands ----------
function background() {
  const bands = [380, 520, 690, 870, 1060, 1250].map((y, i) => {
    const a = 18 + (i % 2) * 10;
    return `<path d="M0 ${y} C 300 ${y - a}, 500 ${y + a}, 800 ${y} S 1300 ${y - a}, 1600 ${y}" class="contour"/>`;
  }).join('');
  return `
  <defs>
    <linearGradient id="slope" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--bg-north)"/>
      <stop offset="0.55" style="stop-color:var(--bg-mid)"/>
      <stop offset="1" style="stop-color:var(--bg-south)"/>
    </linearGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--sky-top)"/>
      <stop offset="1" style="stop-color:var(--sky-bottom)"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#slope)"/>
  <g>${bands}</g>`;
}

// ---------- mountains: three flat layers + snow caps ----------
function mountains() {
  // Peaks as [x, y]. Back ridge is tallest and darkest.
  const ridge = (peaks, base) => `M0 ${base} ` + peaks.map(([x, y]) => `L${x} ${y}`).join(' ') + ` L${W} ${base} Z`;
  const back = [[0, 150], [90, 70], [190, 120], [300, 40], [420, 110], [540, 55], [660, 125], [780, 30], [900, 105], [1010, 50], [1130, 120], [1250, 45], [1370, 110], [1480, 60], [1600, 130]];
  const mid = [[0, 190], [120, 120], [240, 175], [360, 100], [480, 170], [610, 105], [730, 180], [860, 95], [990, 170], [1110, 110], [1240, 180], [1360, 105], [1490, 165], [1600, 120]];
  const front = [[0, 225], [150, 185], [320, 215], [470, 180], [640, 220], [820, 178], [990, 218], [1160, 182], [1330, 220], [1480, 185], [1600, 210]];
  // Snow cap: follow both slopes down `depth` px from the peak, then a zig-zag snow line.
  const caps = (peaks, maxY, depth) => peaks.map(([x, y], i) => {
    if (i === 0 || i === peaks.length - 1 || y >= maxY) return '';
    const along = ([nx, ny]) => { const t = depth / (ny - y); return [x + (nx - x) * t, y + depth]; };
    const [lx, ly] = along(peaks[i - 1]), [rx, ry] = along(peaks[i + 1]);
    const zig = [[lx + (x - lx) * 0.35, ly - depth * 0.35], [x, ly + depth * 0.1], [x + (rx - x) * 0.6, ry - depth * 0.3]];
    return `<path d="M${x} ${y} L${rx} ${ry} ${zig.reverse().map(p => `L${p[0]} ${p[1]}`).join(' ')} L${lx} ${ly} Z" class="snow"/>`;
  }).join('');
  return `
  <g id="mountains">
    <rect width="${W}" height="${MOUNTAIN_BASE}" fill="url(#sky)"/>
    <path d="${ridge(back, MOUNTAIN_BASE)}" class="ridge-back"/>
    ${caps(back, 80, 34)}
    <path d="${ridge(mid, MOUNTAIN_BASE)}" class="ridge-mid"/>
    ${caps(mid, 115, 24)}
    <path d="${ridge(front, MOUNTAIN_BASE + 10)}" class="ridge-front"/>
    <text x="1560" y="232" class="mtn-label" text-anchor="end">کوه‌های البرز</text>
  </g>`;
}

// ---------- highways ----------
function highwayLayers() {
  const casings = [], outlines = [], cores = [], tunnels = [];
  // Draw verticals/horizontals first, special cases on top so they "pop".
  const order = [...highways].sort((a, b) => (a.orientation === 'MIXED' || a.orientation === 'DIAGONAL') - (b.orientation === 'MIXED' || b.orientation === 'DIAGONAL'));
  for (const h of order) {
    const { segs, ids } = routeOf(h.id);
    const d = pathFor(ids);
    const special = h.orientation === 'MIXED' || h.orientation === 'DIAGONAL';
    casings.push(`<path d="${d}" class="casing" data-highway="${h.id}"/>`);
    if (special) outlines.push(`<path d="${d}" class="special-outline" data-highway="${h.id}"/>`);
    cores.push(`<path d="${d}" class="core ${special ? 'core-special' : ''}" stroke="${h.color}" data-highway="${h.id}"><title>${esc(h.name_en)} (${h.orientation})</title></path>`);
    for (const s of segs.filter(s => s.kind === 'tunnel'))
      tunnels.push(`<path d="${pathFor([s.from_node, s.to_node])}" class="tunnel" data-highway="${h.id}"/>`);
  }
  return `<g id="highways">${casings.join('')}${outlines.join('')}${cores.join('')}${tunnels.join('')}</g>`;
}

function nodeLayer() {
  return `<g id="nodes">` + nodes.filter(n => n.type !== 'waypoint' && n.type !== 'landmark').map(n => {
    const r = n.type === 'endpoint' ? 9 : 12;
    return `<circle cx="${n.x}" cy="${n.y}" r="${r}" class="node node-${n.type}" data-node="${n.id}"><title>${esc(n.name_en)}</title></circle>` +
           `<circle cx="${n.x}" cy="${n.y}" r="26" class="hit-node" data-node="${n.id}"/>`;
  }).join('') + `</g>`;
}

// ---------- invisible click targets for the interactive app (transparent, so PNG exports are unchanged) ----------
function segmentHits() {
  return `<g id="hit-segments">` + segments.map(s =>
    `<path d="${pathFor([s.from_node, s.to_node])}" class="hit" data-segment="${s.id}" data-highway="${s.highway_id}"/>`).join('') + `</g>`;
}

function highwayLabels() {
  return `<g id="highway-labels">` + highways.map(h => {
    const [x, y] = LABEL_AT[h.id];
    const w = Math.max(100, [...h.name_fa].length * 12 + 44, h.name_en.length * 7 + 28);
    const special = h.orientation === 'MIXED' || h.orientation === 'DIAGONAL';
    return `<g class="hw-label" data-highway="${h.id}" transform="translate(${x} ${y})">
      <rect x="${-w / 2}" y="-30" width="${w}" height="60" rx="30" fill="${h.color}" class="pill ${special ? 'pill-special' : ''}"/>
      <text x="0" y="2" class="pill-fa" text-anchor="middle" direction="rtl">${esc(h.name_fa)}</text>
      <text x="0" y="21" class="pill-en" text-anchor="middle">${esc(h.name_en)}</text>
    </g>`;
  }).join('') + `</g>`;
}

// ---------- landmark icons (flat, 64px box centred on 0,0) ----------
const ICONS = {
  tower: `<rect x="-3" y="-30" width="6" height="12" class="ic-dark"/><rect x="-5" y="-6" width="10" height="34" class="ic-dark"/>
          <ellipse cx="0" cy="-12" rx="15" ry="9" class="ic-accent"/><rect x="-15" y="-13" width="30" height="3" class="ic-light"/>
          <path d="M-14 30 L14 30 L8 22 L-8 22 Z" class="ic-dark"/>`,
  arch: `<path d="M-26 28 L-10 -6 L-4 -28 L4 -28 L10 -6 L26 28 L12 28 Q0 -4 -12 28 Z" class="ic-accent"/>
         <path d="M-4 -28 L4 -28 L3 -20 L-3 -20 Z" class="ic-dark"/>`,
  train: `<rect x="-22" y="-26" width="44" height="44" rx="10" class="ic-accent"/>
          <rect x="-15" y="-19" width="30" height="15" rx="3" class="ic-light"/>
          <circle cx="-11" cy="6" r="4" class="ic-light"/><circle cx="11" cy="6" r="4" class="ic-light"/>
          <path d="M-14 18 L-22 30 M14 18 L22 30" class="ic-rail"/><path d="M-26 30 L26 30" class="ic-rail"/>`,
  tree: `<rect x="-4" y="6" width="8" height="24" rx="2" class="ic-trunk"/>
         <circle cx="0" cy="-8" r="20" class="ic-leaf"/><circle cx="-14" cy="2" r="12" class="ic-leaf"/><circle cx="14" cy="2" r="12" class="ic-leaf"/>`
};

function landmarkLayer() {
  return `<g id="landmarks">` + landmarks.map(l => {
    const n = nodeById.get(l.node_id);
    const side = LANDMARK_LABEL[l.id];
    // With direction=rtl, "end" is the left edge of the text. Coordinates are relative to the badge centre.
    const [tx, ty, anchorFa, anchorEn] = side === 'right' ? [52, -2, 'end', 'start'] : [0, 66, 'middle', 'middle'];
    return `<g class="landmark" data-landmark="${l.id}" transform="translate(${n.x} ${n.y})">
        <circle r="40" class="lm-badge"/>${ICONS[l.icon]}
        <text x="${tx}" y="${ty}" class="lm-fa" text-anchor="${anchorFa}" direction="rtl">${esc(l.name_fa)}</text>
        <text x="${tx}" y="${ty + 20}" class="lm-en" text-anchor="${anchorEn}">${esc(l.name_en)}</text></g>`;
  }).join('') + `</g>`;
}

// ---------- compass ----------
function compass(cx, cy) {
  const r = 70;
  return `<g id="compass" transform="translate(${cx} ${cy})">
    <circle r="${r + 12}" class="cmp-ring"/>
    <path d="M0 ${-r} L16 0 L0 16 L-16 0 Z" class="cmp-north"/>
    <path d="M0 ${r} L16 0 L0 -16 L-16 0 Z" class="cmp-other"/>
    <path d="M${r} 0 L0 12 L-12 0 L0 -12 Z" class="cmp-other"/>
    <path d="M${-r} 0 L0 12 L12 0 L0 -12 Z" class="cmp-other"/>
    <circle r="7" class="cmp-hub"/>
    <rect x="-86" y="${-r - 64}" width="172" height="46" rx="23" class="cmp-banner"/>
    <text y="${-r - 32}" class="cmp-north-text" text-anchor="middle" direction="rtl">شمال ↑ کوه</text>
    <text x="${r + 20}" y="8" class="cmp-side" text-anchor="end" direction="rtl">شرق</text>
    <text x="${-r - 20}" y="8" class="cmp-side" text-anchor="start" direction="rtl">غرب</text>
    <text y="${r + 38}" class="cmp-side" text-anchor="middle" direction="rtl">جنوب</text>
  </g>`;
}

function legend() {
  const row = (y, cls, color, fa, en) => `
    <path d="M40 ${y} L110 ${y}" class="casing"/>${cls === 'special' ? `<path d="M40 ${y} L110 ${y}" class="special-outline"/>` : ''}
    <path d="M40 ${y} L110 ${y}" class="core ${cls === 'special' ? 'core-special' : ''}" stroke="${color}"/>
    <text x="126" y="${y + 7}" class="lg-fa" text-anchor="end" direction="rtl">${fa}</text><text x="126" y="${y + 25}" class="lg-en">${en}</text>`;
  return `<g id="legend">
    <rect x="16" y="1232" width="560" height="152" rx="18" class="legend-box"/>
    ${row(1262, '', '#1565C0', 'آبی = عمودی (شمال ↕ جنوب)', 'blue = vertical, north–south')}
    ${row(1308, '', '#EF6C00', 'نارنجی = افقی (غرب ↔ شرق)', 'orange = horizontal, west–east')}
    ${row(1354, 'special', '#7B1FA2', 'بنفش خط‌چین = استثنا (پیچ‌دار)', 'purple dashed = edge case, changes direction')}
    <rect x="590" y="1326" width="470" height="58" rx="12" class="draft"/>
    <text x="825" y="1352" class="draft-fa" text-anchor="middle" direction="rtl">داده‌ها از OpenStreetMap — ${verifiedCount} از ${allRows.length} ردیف تأییدشده</text>
    <text x="825" y="1373" class="draft-en" text-anchor="middle">© OpenStreetMap contributors (ODbL) · ${verifiedCount}/${allRows.length} rows verified</text>
  </g>`;
}

const style = `
  ${font('vazirmatn-arabic-400-normal.woff2', 400, ARABIC)}${font('vazirmatn-arabic-800-normal.woff2', 800, ARABIC)}
  ${font('vazirmatn-latin-400-normal.woff2', 400, LATIN)}${font('vazirmatn-latin-800-normal.woff2', 800, LATIN)}
  :root{--bg-north:#cfe9d4;--bg-mid:#eef0cf;--bg-south:#f4dcae;--sky-top:#cfe8f7;--sky-bottom:#eef7fb;
    --ridge-back:#6b7f95;--ridge-mid:#8aa0b2;--ridge-front:#9fc3a0;--snow:#ffffff;--contour:#ffffff;
    --ink:#17202b;--ink-soft:#4a5563;--casing:#ffffff;--node:#ffffff;--badge:#ffffff;--panel:#ffffffd9;
    --draft-bg:#fff3c4;--draft-ink:#6b4e00;--accent:#c0392b;--contour-opacity:.28;--special-dash:#3b0a52}
  @media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg-north:#17322a;--bg-mid:#262c22;--bg-south:#3a2d1c;
    --sky-top:#0d1726;--sky-bottom:#1a2a3a;--ridge-back:#2e3c4e;--ridge-mid:#41546a;--ridge-front:#2f4c3a;--snow:#e8eef4;--contour:#ffffff;
    --ink:#e9eef4;--ink-soft:#b5c0cc;--casing:#0d141c;--node:#f4f6f8;--badge:#f4f6f8;--panel:#121a23e6;
    --draft-bg:#3d3313;--draft-ink:#ffe08a;--accent:#ff6b5b;--contour-opacity:.06;--special-dash:#e9c8f2}}
  :root[data-theme="dark"]{--bg-north:#17322a;--bg-mid:#262c22;--bg-south:#3a2d1c;
    --sky-top:#0d1726;--sky-bottom:#1a2a3a;--ridge-back:#2e3c4e;--ridge-mid:#41546a;--ridge-front:#2f4c3a;--snow:#e8eef4;--contour:#ffffff;
    --ink:#e9eef4;--ink-soft:#b5c0cc;--casing:#0d141c;--node:#f4f6f8;--badge:#f4f6f8;--panel:#121a23e6;
    --draft-bg:#3d3313;--draft-ink:#ffe08a;--accent:#ff6b5b;--contour-opacity:.06;--special-dash:#e9c8f2}
  svg{font-family:'Vazirmatn','DejaVu Sans',sans-serif}
  .contour{fill:none;stroke:var(--contour);stroke-opacity:var(--contour-opacity);stroke-width:26}
  .ridge-back{fill:var(--ridge-back)}.ridge-mid{fill:var(--ridge-mid)}.ridge-front{fill:var(--ridge-front)}.snow{fill:var(--snow)}
  .mtn-label{font-size:22px;font-weight:800;fill:#ffffff;fill-opacity:.9}
  .casing{fill:none;stroke:var(--casing);stroke-width:28;stroke-linecap:round;stroke-linejoin:round}
  .special-outline{fill:none;stroke:var(--special-dash);stroke-width:28;stroke-dasharray:16 12;stroke-linecap:butt;stroke-linejoin:round}
  .core{fill:none;stroke-width:16;stroke-linecap:round;stroke-linejoin:round}
  .core-special{stroke-width:14}
  .hit{fill:none;stroke:transparent;stroke-width:44;stroke-linecap:round;stroke-linejoin:round;pointer-events:stroke}
  .hit-node{fill:transparent;stroke:none;pointer-events:all}
  .tunnel{fill:none;stroke:var(--casing);stroke-width:6;stroke-dasharray:10 10}
    .node{fill:var(--node);stroke:#17202b;stroke-width:4}
  .node-endpoint{stroke-width:3}
  .pill{stroke:var(--casing);stroke-width:4}.pill-special{stroke:var(--special-dash);stroke-dasharray:10 6}
  .pill-fa{font-size:26px;font-weight:800;fill:#ffffff}.pill-en{font-size:13px;font-weight:400;fill:#ffffff;fill-opacity:.92}
  .lm-badge{fill:var(--badge);stroke:#17202b;stroke-width:4}
  .ic-dark{fill:#37474f}.ic-light{fill:#ffffff}.ic-accent{fill:#c0392b}.ic-leaf{fill:#2e7d32}.ic-trunk{fill:#6d4c41}
  .ic-rail{stroke:#37474f;stroke-width:4;stroke-linecap:round;fill:none}
  .lm-fa{font-size:24px;font-weight:800;fill:var(--ink);paint-order:stroke;stroke:var(--casing);stroke-width:6;stroke-linejoin:round}
  .lm-en{font-size:14px;fill:var(--ink-soft);paint-order:stroke;stroke:var(--casing);stroke-width:4;stroke-linejoin:round}
  .cmp-ring{fill:var(--panel);stroke:var(--ink);stroke-width:4}
  .cmp-north{fill:var(--accent)}.cmp-other{fill:var(--ink-soft)}.cmp-hub{fill:var(--ink)}
  .cmp-banner{fill:var(--accent)}.cmp-north-text{font-size:26px;font-weight:800;fill:#ffffff}
  .cmp-side{font-size:20px;font-weight:800;fill:var(--ink)}
  .legend-box{fill:var(--panel);stroke:var(--ink-soft);stroke-opacity:.4;stroke-width:2}
  .lg-fa{font-size:19px;font-weight:800;fill:var(--ink)}.lg-en{font-size:13px;fill:var(--ink-soft)}
  .draft{fill:var(--draft-bg);stroke:var(--draft-ink);stroke-width:2}
  .draft-fa{font-size:17px;font-weight:800;fill:var(--draft-ink)}.draft-en{font-size:12px;fill:var(--draft-ink)}
`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Schematic map of Tehran highways, north is up">
<title>Tehran highways — schematic (north is up)</title>
<style>${style}</style>
${background()}
${mountains()}
${highwayLayers()}
${segmentHits()}
${nodeLayer()}
${landmarkLayer()}
${highwayLabels()}
${compass(1450, 1258)}
${legend()}
</svg>
`;

mkdirSync(new URL('map/', root), { recursive: true });
writeFileSync(new URL('map/schematic.svg', root), svg);
console.log(`✓ map/schematic.svg (${(svg.length / 1024).toFixed(0)} KB)`);
