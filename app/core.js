// ===== core: data indexes, words, table/SQL helpers, and everything that draws on the map =====
// Data comes from the tables embedded by tools/build-app.mjs (lat/lon and OSM evidence are stripped on purpose).
const D = JSON.parse(document.getElementById('data').textContent);
const index = rows => new Map(rows.map(r => [r.id, r]));
const HW = index(D.highways), ND = index(D.nodes), SG = index(D.segments), LM = index(D.landmarks), SRC = index(D.sources);
const svg = document.querySelector('#map-scroll svg');
const panel = document.getElementById('panel');
const pane = document.getElementById('map-pane');
const scroller = document.getElementById('map-scroll');
const NS_URI = 'http://www.w3.org/2000/svg';

// ---------- derived indexes ----------
const segsOfHw = new Map(), segsAtNode = new Map();
for (const s of [...D.segments].sort((a, b) => a.order_on_highway - b.order_on_highway)) {
  (segsOfHw.get(s.highway_id) || segsOfHw.set(s.highway_id, []).get(s.highway_id)).push(s);
  for (const n of [s.from_node, s.to_node]) (segsAtNode.get(n) || segsAtNode.set(n, []).get(n)).push(s);
}
const nodesOfHw = id => { const segs = segsOfHw.get(id) || []; return segs.length ? [segs[0].from_node, ...segs.map(s => s.to_node)] : []; };
const hwsAtNode = id => [...new Set((segsAtNode.get(id) || []).map(s => s.highway_id))];
const group = h => (h.orientation === 'NS' ? 'NS' : h.orientation === 'EW' ? 'EW' : 'X');
const P = id => [ND.get(id).x, ND.get(id).y];

// ---------- words ----------
const DIR_FA = { N: 'شمال', S: 'جنوب', E: 'شرق', W: 'غرب', NE: 'شمال‌شرق', NW: 'شمال‌غرب', SE: 'جنوب‌شرق', SW: 'جنوب‌غرب' };
const DIR_UP = { N: 'بالا', S: 'پایین', E: 'راست', W: 'چپ', NE: 'بالا-راست', NW: 'بالا-چپ', SE: 'پایین-راست', SW: 'پایین-چپ' };
const ARROW = { N: '↑', S: '↓', E: '→', W: '←', NE: '↗', NW: '↖', SE: '↘', SW: '↙' };
const VEC = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const ORI = {
  NS: { label: 'عمودی', cls: 'v', sub: 'شمال ↕ جنوب' }, EW: { label: 'افقی', cls: 'h', sub: 'غرب ↔ شرق' },
  MIXED: { label: 'استثنا: وسط راه جهت عوض می‌کند', cls: 'x', sub: '' }, DIAGONAL: { label: 'استثنا: مورب', cls: 'x', sub: '' }
};
const TYPE_FA = { interchange: 'تقاطع', endpoint: 'سر خط', waypoint: 'خمیدگی', landmark: 'نماد' };
const nm = n => n.name_fa || n.name_en || n.id;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toFa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const shuffle = a => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const state = { dev: false, real: false, mode: 'learn' };
const store = {
  get(k, d) { try { const v = localStorage.getItem('tehran.' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem('tehran.' + k, JSON.stringify(v)); } catch (_) { /* storage can be blocked */ } }
};

// ---------- table / SQL rendering (the Developer view) ----------
const RTL_RE = /[؀-ۿ]/;
const fmt = (v, col) => {
  if (v === null || v === undefined) return '<span class="nul">NULL</span>';
  if (typeof v === 'boolean') return v ? '<span class="t">true</span>' : '<span class="f">false</span>';
  if (Array.isArray(v)) return esc(v.join(', '));
  if (col === 'color') return `<span class="dot" style="background:${esc(v)}"></span>${esc(v)}`;
  if (col === 'direction') return `${esc(v)} ${ARROW[v] || ''}`;
  return esc(v);
};
const cell = (v, col) => `<td${RTL_RE.test(String(v)) ? ' class="fa"' : ''}>${fmt(v, col)}</td>`;
const kvTable = (cols, row) => `<div class="tw"><table class="kv">${cols.map(c => `<tr><th>${c}</th>${cell(row[c], c)}</tr>`).join('')}</table></div>`;
// goOf(row) -> "type:id" makes the row clickable.
const listTable = (cols, rows, goOf) => `<div class="tw"><table><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>${rows.map(r =>
  `<tr${goOf ? ` data-go="${esc(goOf(r))}" tabindex="0"` : ''}>${cols.map(c => cell(r[c], c)).join('')}</tr>`).join('')}</table></div>` +
  `<div class="rows">(${rows.length} row${rows.length === 1 ? '' : 's'})</div>`;
const KW = /\b(SELECT|DISTINCT|FROM|WHERE|JOIN|ON|AS|AND|OR|IN|ORDER BY)\b/g;
const sql = text => `<pre class="sql">${esc(text).replace(/(--[^\n]*)/g, '\u0001$1\u0002').replace(/'[^']*'/g, '<span class="str">$&</span>')
  .replace(KW, '<span class="kw">$1</span>').replace(/\u0001/g, '<span class="cm">').replace(/\u0002/g, '</span>')}</pre>`;
const COLS = {
  highways: ['id', 'name_fa', 'name_en', 'orientation', 'color', 'level', 'verified', 'source'],
  nodes: ['id', 'name_fa', 'name_en', 'type', 'x', 'y', 'verified', 'source'],
  landmarks: ['id', 'node_id', 'name_fa', 'name_en', 'icon', 'hint_fa', 'elevation_m', 'verified', 'source']
};
const q = (cols, table, where) => `SELECT ${cols.join(', ')}\nFROM ${table}${where ? '\nWHERE ' + where : ''};`;
// <details> that follows the global "Developer view" switch
const devDetails = (title, inner) => `<details class="dev"${state.dev ? ' open' : ''}><summary>${title}</summary>${inner}</details>`;
const syncDev = () => { document.body.classList.toggle('dev-on', state.dev); document.querySelectorAll('details.dev').forEach(d => { d.open = state.dev; }); };

// ---------- svg helpers ----------
const mk = (tag, cls, attrs = {}) => { const e = document.createElementNS(NS_URI, tag); if (cls) e.setAttribute('class', cls); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const under = mk('g', 'sel-under'), over = mk('g', 'sel-over'), carLayer = mk('g', 'car-layer');
svg.insertBefore(under, svg.querySelector('#highways'));
svg.appendChild(over);
svg.appendChild(carLayer);
const pathD = pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');

// ---------- what is on the map ----------
// vis.hw: Set of highway ids that exist right now (null = all). Everything else is hidden, not greyed: no clutter.
const vis = { hw: null, landmarks: true, mountains: true, nodes: 'meet' };
function applyVisibility() {
  const on = id => !vis.hw || vis.hw.has(id);
  svg.querySelectorAll('[data-highway]').forEach(el => el.classList.toggle('off', !on(el.dataset.highway)));
  const visibleAt = id => hwsAtNode(id).filter(on).length;
  svg.querySelectorAll('[data-node]').forEach(el => {
    const t = ND.get(el.dataset.node).type;
    const show = vis.nodes === 'all' ? visibleAt(el.dataset.node) >= 1 && t !== 'waypoint'
      : vis.nodes === 'meet' ? visibleAt(el.dataset.node) >= 2 : false;
    el.classList.toggle('off', !show);
  });
  svg.querySelectorAll('[data-landmark]').forEach(el => el.classList.toggle('off', !vis.landmarks));
  svg.classList.toggle('no-nodes', vis.nodes === false);
}
function setVisible(opts) { Object.assign(vis, opts); applyVisibility(); }

// ---------- camera (viewBox) ----------
const FULL = [0, 0, 1600, 1400];
let vb = FULL.slice(), vbAnim = 0;
const setVB = b => { vb = b; svg.setAttribute('viewBox', b.map(v => Math.round(v * 10) / 10).join(' ')); svg.classList.toggle('z', b[2] < 1000); };
function animateVB(to, ms = 650) {
  cancelAnimationFrame(vbAnim);
  const from = vb.slice(), t0 = performance.now();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setVB(to);
  const step = t => {
    const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    setVB(from.map((v, i) => v + (to[i] - v) * e));
    if (k < 1) vbAnim = requestAnimationFrame(step);
  };
  vbAnim = requestAnimationFrame(step);
}
// Fit a box (in drawing units) to the pane's shape, so the map never letterboxes while zoomed.
function fitBox([x0, y0, x1, y1], pad = 120) {
  const a = Math.max(.4, pane.clientWidth / Math.max(1, pane.clientHeight));
  let w = x1 - x0 + 2 * pad, h = y1 - y0 + 2 * pad;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  // never zoom in so far that the lesson loses its surroundings: a wide screen keeps most of the map, a phone keeps about a third
  const minW = pane.clientWidth >= 700 ? 1150 : 560;
  if (w < minW) { h *= minW / w; w = minW; }
  if (w / h < a) w = h * a; else h = w / a;
  if (w >= FULL[2] || h >= FULL[3]) return FULL.slice();
  return [Math.min(Math.max(cx - w / 2, 0), FULL[2] - w), Math.min(Math.max(cy - h / 2, 0), FULL[3] - h), w, h];
}
const boxOf = pts => [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))];
const focusOn = (pts, pad) => animateVB(pts && pts.length ? fitBox(boxOf(pts), pad) : FULL.slice());
const focusAll = () => animateVB(FULL.slice());

// pan (drag) and zoom (wheel / buttons). A drag never counts as a click.
let dragged = false;
(() => {
  let down = null;
  const pxToUnits = () => vb[2] / Math.min(scroller.clientWidth, scroller.clientHeight * vb[2] / vb[3]);
  scroller.addEventListener('pointerdown', e => { if (e.button === 0) down = { x: e.clientX, y: e.clientY, vb: vb.slice(), moved: false }; });
  scroller.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!down.moved && Math.hypot(dx, dy) < 7) return;
    down.moved = true; cancelAnimationFrame(vbAnim);
    const k = pxToUnits();
    setVB([Math.min(Math.max(down.vb[0] - dx * k, 0), FULL[2] - vb[2]), Math.min(Math.max(down.vb[1] - dy * k, 0), FULL[3] - vb[3]), vb[2], vb[3]]);
  });
  const up = () => { dragged = !!(down && down.moved); down = null; setTimeout(() => { dragged = false; }, 0); };
  scroller.addEventListener('pointerup', up); scroller.addEventListener('pointercancel', up);
})();
function zoomBy(f, cx, cy) {
  const w = Math.min(FULL[2], Math.max(320, vb[2] / f)), h = w * vb[3] / vb[2];
  const px = cx ?? vb[0] + vb[2] / 2, py = cy ?? vb[1] + vb[3] / 2;
  const nx = px - (px - vb[0]) * w / vb[2], ny = py - (py - vb[1]) * h / vb[3];
  animateVB(w >= FULL[2] ? FULL.slice() : [Math.min(Math.max(nx, 0), FULL[2] - w), Math.min(Math.max(ny, 0), FULL[3] - h), w, h], 220);
}
scroller.addEventListener('wheel', e => {
  e.preventDefault();
  const r = svg.getBoundingClientRect(), k = Math.min(r.width / vb[2], r.height / vb[3]);
  const ox = (r.width - vb[2] * k) / 2, oy = (r.height - vb[3] * k) / 2;
  zoomBy(e.deltaY < 0 ? 1.25 : .8, vb[0] + (e.clientX - r.left - ox) / k, vb[1] + (e.clientY - r.top - oy) / k);
}, { passive: false });

// ---------- halos (what is selected / the right answer) ----------
function clearHalos() { under.replaceChildren(); over.replaceChildren(); }
function halo(type, id) {
  if (state.real) return;
  if (type === 'highway') under.append(mk('path', 'halo-under', { d: pathD(nodesOfHw(id).map(P)) }));
  else if (type === 'segment') { const s = SG.get(id); under.append(mk('path', 'halo-under', { d: pathD([P(s.from_node), P(s.to_node)]) })); }
  else if (type === 'node' || type === 'landmark') {
    const [x, y] = P(type === 'node' ? id : LM.get(id).node_id), r = type === 'node' ? 34 : 56;
    over.append(mk('circle', 'halo-ring-soft', { cx: x, cy: y, r }), mk('circle', 'halo-ring', { cx: x, cy: y, r }));
  }
}
const pulse = (el, on) => el && el.classList.toggle('pulse', on);

// ---------- the car mascot ----------
function carShape() {
  const g = mk('g', 'car'), inner = mk('g', '', { transform: 'scale(1.55)' });
  g.append(inner);
  inner.innerHTML = `<rect x="-36" y="-20" width="72" height="40" rx="12" class="car-body"/>
    <rect x="-8" y="-15" width="26" height="30" rx="6" class="car-glass"/><rect x="-26" y="-13" width="12" height="26" rx="4" class="car-glass"/>
    <circle cx="33" cy="-11" r="4" class="car-light"/><circle cx="33" cy="11" r="4" class="car-light"/>
    <rect x="-28" y="-25" width="16" height="7" rx="3" class="car-wheel"/><rect x="14" y="-25" width="16" height="7" rx="3" class="car-wheel"/>
    <rect x="-28" y="18" width="16" height="7" rx="3" class="car-wheel"/><rect x="14" y="18" width="16" height="7" rx="3" class="car-wheel"/>`;
  return g;
}
const polyLen = pts => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
function pointAt(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= L || i === pts.length - 1) { const t = L ? Math.min(1, d / L) : 1; return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, y: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t, a: Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) }; }
    d -= L;
  }
}
// Drive the car along a polyline (drawing units) with a dashed arrow trail. Resolves when it arrives.
function driveCar(pts) {
  carLayer.replaceChildren();
  if (state.real || pts.length < 2) return Promise.resolve();
  const end = pts[pts.length - 1], prev = pts[pts.length - 2], ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
  const trail = mk('path', 'trail', { d: pathD(pts) });
  const head = mk('path', 'trail-head', { d: 'M0 0 L-46 -27 L-46 27 Z', transform: `translate(${end[0]} ${end[1]}) rotate(${ang * 180 / Math.PI})` });
  const car = carShape();
  carLayer.append(trail, head, car);
  const total = polyLen(pts), ms = Math.min(1700, 700 + total * 1.6), t0 = performance.now();
  const place = d => { const p = pointAt(pts, d); car.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${p.a * 180 / Math.PI})`); };
  place(0);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { place(total); return Promise.resolve(); }
  return new Promise(res => {
    const step = t => { const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; place(total * e); k < 1 ? requestAnimationFrame(step) : res(); };
    requestAnimationFrame(step);
  });
}
const clearCar = () => carLayer.replaceChildren();
function parkCar(p, deg = 0) {
  carLayer.replaceChildren();
  if (state.real) return;
  const c = carShape(); c.setAttribute('transform', `translate(${p[0]} ${p[1]}) rotate(${deg})`); carLayer.append(c);
}
