// ===== real-shape view: the same highways drawn with their real carriageway shapes (north still up) =====
// The schematic keeps ORDER and throws away distance; this view keeps both, so the learner can see what the schematic changed.
let realG = null;
function buildReal() {
  realG = mk('g', 'real', { id: 'real' });
  svg.insertBefore(realG, svg.querySelector('#highways'));
  const R = D.real, hwIds = D.highways.map(h => h.id);
  const dOf = flat => { let d = ''; for (let i = 0; i < flat.length; i += 2) d += `${i ? 'L' : 'M'}${flat[i]} ${flat[i + 1]}`; return d; };
  // draw order: verticals/horizontals first, exceptions on top (same rule as the schematic)
  const order = [...hwIds].sort((a, b) => (group(HW.get(a)) === 'X') - (group(HW.get(b)) === 'X'));
  for (const id of order) {
    const h = HW.get(id), lines = R.lines[id] || [], special = group(h) === 'X';
    const d = lines.map(dOf).join(' ');
    realG.append(mk('path', 'real-casing', { d, 'data-highway': id }));
    if (special) realG.append(mk('path', 'real-outline', { d, 'data-highway': id }));
    realG.append(mk('path', 'real-core', { d, stroke: h.color, 'data-highway': id }));
  }
  for (const n of D.nodes) if (n.type === 'interchange' && R.nodes[n.id])
    realG.append(mk('circle', 'node real-node', { cx: R.nodes[n.id][0], cy: R.nodes[n.id][1], r: 9, 'data-node': n.id }));
  // Labels: sit at the real end of each line that is nearest to where its schematic label sits, nudged apart if they collide.
  const at = el => { const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(el.getAttribute('transform')); return [+m[1], +m[2]]; };
  const labels = [];
  for (const pill of svg.querySelectorAll('.hw-label')) {
    const id = pill.dataset.highway, ids = nodesOfHw(id).filter(n => R.nodes[n]);
    if (ids.length < 2) continue;
    const [px, py] = at(pill), dist = n => Math.hypot(P(n)[0] - px, P(n)[1] - py);
    const first = dist(ids[0]) <= dist(ids[ids.length - 1]);
    const end = first ? ids[0] : ids[ids.length - 1], next = first ? ids[1] : ids[ids.length - 2];
    const [ex, ey] = R.nodes[end], [nx, ny] = R.nodes[next], len = Math.hypot(ex - nx, ey - ny) || 1;
    const c = pill.cloneNode(true), w = +c.querySelector('rect').getAttribute('width');
    c.classList.add('real-label');
    labels.push({ c, w, x: ex + (ex - nx) / len * 62, y: ey + (ey - ny) / len * 62, dy: Math.sign(ey - ny) || 1 });
  }
  for (let pass = 0; pass < 30; pass++) {
    let moved = false;
    for (const a of labels) for (const b of labels) if (a !== b && Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 6 && Math.abs(a.y - b.y) < 66) { b.y += b.dy * 8; moved = true; }
    if (!moved) break;
  }
  for (const l of labels) { l.c.setAttribute('transform', `translate(${Math.round(l.x)} ${Math.round(l.y)})`); realG.append(l.c); }
  for (const lm of svg.querySelectorAll('.landmark')) {
    const pos = R.nodes[LM.get(lm.dataset.landmark).node_id]; if (!pos) continue;
    const c = lm.cloneNode(true); c.classList.add('real-landmark'); c.setAttribute('transform', `translate(${pos[0]} ${pos[1]})`);
    realG.append(c);
  }
  applyVisibility();
}
function setReal(on) {
  if (on && !realG) buildReal();
  state.real = on;
  svg.classList.toggle('is-real', on);
  document.getElementById('real-note').hidden = !on;
  const b = document.getElementById('realbtn'); if (b) b.setAttribute('aria-pressed', String(on));
  clearHalos(); clearCar();
}
