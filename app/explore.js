// ===== explore mode: click anything, see what it is in plain words, and (on request) the table rows and SQL behind it =====
const E = { sel: null, filter: 'all' };

const verifiedBadge = r => r.verified ? '<span class="badge ok">تأییدشده ✓</span>' : '<span class="badge warn">تأییدنشده</span>';
const oriBadge = h => `<span class="badge ${ORI[h.orientation].cls}">${ORI[h.orientation].label}${ORI[h.orientation].sub ? ' · ' + ORI[h.orientation].sub : ''}</span>`;
const unverifiedBox = (r, what) => r.verified ? '' :
  `<div class="warnbox">⚠ این ${what} هنوز <b>تأییدنشده</b> است (verified = false): با OpenStreetMap به‌طور کامل نمی‌خواند، پس به‌عنوان حقیقت قطعی نخوانش. جزئیات در REVIEW.md.${r.note ? `<br><span dir="ltr" style="display:block;text-align:left">${esc(r.note)}</span>` : ''}</div>`;
const noteLine = r => r.note ? `<div class="note">note: ${esc(r.note)}</div>` : '';
const sourcesBlock = rows => {
  const ids = [...new Set(rows.flatMap(r => [...(r.source || []), ...(r.alias_source || [])]))].filter(id => SRC.has(id));
  if (!ids.length) return '';
  return `<div class="devh">منبع <code>sources</code></div><ul class="src">${ids.map(id => {
    const s = SRC.get(id); return `<li dir="ltr" style="text-align:left"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`;
  }).join('')}</ul>`;
};
const head = (r, color) => `<div class="ph"><span class="swatch" style="background:${esc(color || 'var(--ink-soft)')}"></span><div><h2>${esc(nm(r))}</h2><small class="en">${esc(r.name_en || '')}</small></div>
  <button class="x" data-close aria-label="بستن" title="بستن (Esc)">✕</button></div>`;
const footer = `<div class="foot">«تأییدشده» یعنی هندسه‌ی OpenStreetMap با این ردیف می‌خواند؛ <b>نه</b> اینکه پیچیدن از یک خط به خط دیگر مجاز باشد. ·
  Geography © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> (ODbL)</div>`;
const HIDDEN = '-- lat, lon exist in this table; hidden here\n';
const DEV_TITLE = 'نمای برنامه‌نویس · Developer view';

const filtersBar = () => `<div class="filters" role="group" aria-label="فیلتر بزرگراه‌ها">${[['all', 'همه', null], ['NS', 'عمودی', 'var(--c-v)'], ['EW', 'افقی', 'var(--c-h)'], ['X', 'استثنا', 'var(--c-x)']]
  .map(([k, label, c]) => `<button class="chip" data-f="${k}" aria-pressed="${E.filter === k}">${c ? `<i style="background:${c}"></i>` : ''}${label}</button>`).join('')}</div>`;

function renderHome() {
  const hs = [...D.highways].sort((a, b) => a.level - b.level || group(a).localeCompare(group(b)));
  const all = [...D.highways, ...D.nodes, ...D.segments, ...D.landmarks];
  const ok = all.filter(r => r.verified).length;
  return `<div class="p">${filtersBar()}
    <p class="plain">روی هر <b>خط</b>، <b>دایره</b> یا <b>نماد</b> بزن.<br><small>یک بار روی خط = کل بزرگراه · دوباره روی همان خط = همان قطعه · Esc = بستن</small></p>
    <div class="hwlist">${hs.map(h => `<button class="hwbtn" data-go="highway:${h.id}"><span class="dot" style="background:${esc(h.color)}"></span><b>${esc(h.name_fa)}</b><small>${esc(h.name_en)}</small></button>`).join('')}</div>
    ${devDetails(DEV_TITLE, sql(q(['id', 'name_fa', 'name_en', 'orientation', 'level', 'verified'], 'highways').replace(';', '\nORDER BY level, orientation;')) +
      listTable(['id', 'name_fa', 'name_en', 'orientation', 'level', 'verified'], hs, r => 'highway:' + r.id) +
      `<div class="rows">${ok} / ${all.length} rows verified (highways, nodes, segments, landmarks)</div>`)}
    ${footer}</div>`;
}

function endsText(h) {
  const ns = nodesOfHw(h.id).map(id => ND.get(id)), segs = segsOfHw.get(h.id) || [];
  const by = (k, dir) => [...ns].sort((a, b) => dir * (a[k] - b[k]))[0];
  if (h.orientation === 'NS') return `سر بالا (شمال): <b>${esc(nm(by('y', 1)))}</b><br>سر پایین (جنوب): <b>${esc(nm(by('y', -1)))}</b>`;
  if (h.orientation === 'EW') return `سر چپ (غرب): <b>${esc(nm(by('x', 1)))}</b><br>سر راست (شرق): <b>${esc(nm(by('x', -1)))}</b>`;
  const seq = []; for (const s of segs) if (seq[seq.length - 1] !== s.direction) seq.push(s.direction);
  return `ترتیب جهت‌ها: <b>${seq.map(d => `${DIR_FA[d]} ${ARROW[d]}`).join('، بعد ')}</b>`;
}
const plainOf = h => h.orientation === 'NS' ? 'خط <b>عمودی</b>: روی نقشه از بالا (شمال، سمت کوه) به پایین (جنوب) کشیده می‌شود.'
  : h.orientation === 'EW' ? 'خط <b>افقی</b>: روی نقشه از چپ (غرب) به راست (شرق) کشیده می‌شود.'
  : h.orientation === 'MIXED' ? '<b>استثنا</b>: وسط راه جهتش را عوض می‌کند — بخشی افقی، بخشی عمودی.'
  : '<b>استثنا</b>: مورب است، نه عمودی و نه افقی.';

function renderHighway(id) {
  const h = HW.get(id), segs = segsOfHw.get(id) || [];
  const crossings = [];
  for (const nid of nodesOfHw(id)) for (const o of hwsAtNode(nid)) if (o !== id) crossings.push({ other_highway: o, node: nid, _go: 'node:' + nid });
  const nodeCount = new Set(nodesOfHw(id)).size;
  const segCols = ['order_on_highway', 'from_node', 'to_node', 'direction', 'kind', 'verified'];
  return `<div class="p">${head(h, h.color)}
    <div class="badges">${oriBadge(h)}${verifiedBadge(h)}<span class="badge n">درس ${toFa(h.level)}</span></div>
    <p class="plain">${plainOf(h)}<br>${endsText(h)}<br><small>${toFa(segs.length)} قطعه · ${toFa(nodeCount)} نقطه</small></p>
    ${unverifiedBox(h, 'بزرگراه')}${noteLine(h)}${h.official_name_fa ? `<div class="note">official_name_fa: ${esc(h.official_name_fa)}</div>` : ''}
    ${devDetails(DEV_TITLE,
      sql(HIDDEN + q(COLS.highways, 'highways', `id = '${id}'`)) + kvTable(COLS.highways, h) +
      sql(q(segCols, 'segments', `highway_id = '${id}'`).replace(';', '\nORDER BY order_on_highway;')) +
      listTable(segCols, segs.map(s => ({ ...s, _go: 'segment:' + s.id })), r => r._go) +
      sql(`-- which other highways share a node with '${id}'?\nSELECT DISTINCT o.highway_id AS other_highway, n.id AS node\nFROM segments m\nJOIN nodes n ON n.id IN (m.from_node, m.to_node)\nJOIN segments o ON n.id IN (o.from_node, o.to_node)\n  AND o.highway_id <> m.highway_id\nWHERE m.highway_id = '${id}';`) +
      (crossings.length ? listTable(['other_highway', 'node'], crossings, r => r._go) : '<div class="rows">(0 rows) — no other highway touches this one in the data</div>') +
      sourcesBlock([h]))}
    ${footer}</div>`;
}

function renderNode(id) {
  const n = ND.get(id), hws = hwsAtNode(id), color = hws.length === 1 ? HW.get(hws[0]).color : null;
  const names = hws.map(h => `<button class="go" data-go="highway:${h}">${esc(HW.get(h).name_fa)}</button>`);
  const plain = n.type === 'interchange' ? (hws.length > 1 ? 'تقاطع: اینجا این خط‌ها به هم می‌رسند (در جدول یعنی یک <b>JOIN</b>).' : 'یک نقطه‌ی مهم روی این خط.')
    : n.type === 'endpoint' ? 'سر خط: جایی که این خط شروع یا تمام می‌شود.' : 'یک نقطه‌ی روی نقشه.';
  const atRows = (segsAtNode.get(id) || []).map(s => ({ highway_id: s.highway_id, name_en: HW.get(s.highway_id).name_en, segment: s.id }));
  return `<div class="p">${head(n, color)}
    <div class="badges"><span class="badge n">${TYPE_FA[n.type] || n.type}</span>${verifiedBadge(n)}</div>
    <p class="plain">${plain}</p>
    ${hws.length ? `<div class="join">${names.join(' ⋈ ')}</div>` : ''}
    ${n.alias_fa ? `<div class="note" style="direction:rtl;text-align:right">نام رایج‌تر: <b>${esc(n.alias_fa)}</b> (این اسم در OpenStreetMap نیست؛ از منبع زیر آمده)</div>` : ''}
    ${unverifiedBox(n, 'نقطه')}${noteLine(n)}
    ${devDetails(DEV_TITLE,
      sql(HIDDEN + q(COLS.nodes, 'nodes', `id = '${id}'`)) + kvTable(COLS.nodes, n) +
      sql(`SELECT h.id AS highway_id, h.name_en, s.id AS segment\nFROM segments s\nJOIN highways h ON h.id = s.highway_id\nWHERE '${id}' IN (s.from_node, s.to_node);`) +
      (atRows.length ? listTable(['highway_id', 'name_en', 'segment'], atRows, r => 'segment:' + r.segment) : '<div class="rows">(0 rows) — no highway is attached to this node</div>') +
      sourcesBlock([n]))}
    ${footer}</div>`;
}

function renderSegment(id) {
  const s = SG.get(id), h = HW.get(s.highway_id), a = ND.get(s.from_node), b = ND.get(s.to_node);
  const cols = ['id', 'highway_id', 'from_node', 'to_node', 'direction', 'order_on_highway', 'kind', 'verified', 'source'];
  return `<div class="p">${head({ name_fa: `قطعه‌ی ${toFa(s.order_on_highway)} از ${h.name_fa}`, name_en: `${h.name_en} · segment ${s.order_on_highway}` }, h.color)}
    <div class="badges"><span class="badge n">${DIR_FA[s.direction]} ${ARROW[s.direction]} (${DIR_UP[s.direction]})</span>${s.kind === 'tunnel' ? '<span class="badge n">تونل</span>' : ''}${verifiedBadge(s)}</div>
    <p class="plain">از <button class="go" data-go="node:${a.id}"><b>${esc(nm(a))}</b></button> به <button class="go" data-go="node:${b.id}"><b>${esc(nm(b))}</b></button>
      — حرکت به سمت <b>${DIR_FA[s.direction]}</b> (روی نقشه: ${DIR_UP[s.direction]}).</p>
    ${unverifiedBox(s, 'قطعه')}${noteLine(s)}
    ${devDetails(DEV_TITLE,
      sql(q(cols, 'segments', `id = '${id}'`)) + kvTable(cols, s) +
      sql(`SELECT a.name_fa AS from_name, b.name_fa AS to_name, h.name_en AS highway\nFROM segments s\nJOIN nodes a ON a.id = s.from_node\nJOIN nodes b ON b.id = s.to_node\nJOIN highways h ON h.id = s.highway_id\nWHERE s.id = '${id}';`) +
      listTable(['from_name', 'to_name', 'highway'], [{ from_name: nm(a), to_name: nm(b), highway: h.name_en }]) + sourcesBlock([s, h]))}
    ${footer}</div>`;
}

function renderLandmark(id) {
  const l = LM.get(id), n = ND.get(l.node_id);
  return `<div class="p">${head(l, null)}
    <div class="badges"><span class="badge n">نماد مرجع برای حافظه</span>${verifiedBadge(l)}</div>
    <p class="plain">${esc(l.hint_fa || '')}</p>
    ${unverifiedBox(l, 'نماد')}
    ${devDetails(DEV_TITLE,
      sql(HIDDEN + q(COLS.landmarks, 'landmarks', `id = '${id}'`)) + kvTable(COLS.landmarks, l) +
      sql(`SELECT n.id, n.x, n.y\nFROM landmarks l\nJOIN nodes n ON n.id = l.node_id\nWHERE l.id = '${id}';`) +
      listTable(['id', 'x', 'y'], [n]) + sourcesBlock([l]))}
    ${footer}</div>`;
}

// ---------- map state in explore mode ----------
function focusSets() {
  const sel = E.sel; if (!sel) return { hw: null, nodes: null, lm: null };
  if (sel.type === 'highway') return { hw: new Set([sel.id]), nodes: new Set(nodesOfHw(sel.id)), lm: new Set() };
  if (sel.type === 'segment') { const s = SG.get(sel.id); return { hw: new Set([s.highway_id]), nodes: new Set([s.from_node, s.to_node]), lm: new Set() }; }
  if (sel.type === 'node') return { hw: new Set(hwsAtNode(sel.id)), nodes: new Set([sel.id]), lm: new Set() };
  return { hw: null, nodes: null, lm: new Set([sel.id]) };
}
function applyExploreView() {
  const { hw, nodes, lm } = focusSets();
  const inFilter = h => E.filter === 'all' || group(HW.get(h)) === E.filter;
  const nodeGhost = id => E.filter !== 'all' && !hwsAtNode(id).some(inFilter);
  svg.querySelectorAll('[data-highway]').forEach(el => {
    const id = el.dataset.highway;
    el.classList.toggle('dim', !!hw && !hw.has(id));
    el.classList.toggle('ghost', !inFilter(id));
    el.classList.toggle('sel', !!hw && hw.has(id)); // a selected highway is never greyed out by the filter
  });
  svg.querySelectorAll('.node[data-node]').forEach(el => {
    el.classList.toggle('dim', !!nodes && !nodes.has(el.dataset.node));
    el.classList.toggle('ghost', nodeGhost(el.dataset.node));
  });
  svg.querySelectorAll('.landmark[data-landmark]').forEach(el => el.classList.toggle('dim', !!E.sel && !(lm && lm.has(el.dataset.landmark))));
  clearHalos();
  if (E.sel) halo(E.sel.type, E.sel.id);
}
function clearExploreView() {
  svg.querySelectorAll('.dim,.ghost,.sel').forEach(el => el.classList.remove('dim', 'ghost', 'sel'));
  clearHalos();
}

const RENDER = { highway: renderHighway, node: renderNode, segment: renderSegment, landmark: renderLandmark };
const TABLE = { highway: HW, node: ND, segment: SG, landmark: LM };
function exploreSelect(type, id, opts = {}) {
  if (type && !(TABLE[type] && TABLE[type].has(id))) type = null;
  E.sel = type ? { type, id } : null;
  panel.innerHTML = type ? RENDER[type](id) : renderHome();
  panel.scrollTop = 0;
  applyExploreView();
  try { history.replaceState(null, '', type ? `#${type}=${encodeURIComponent(id)}` : location.pathname + location.search); } catch (_) { /* file:// in some browsers */ }
  if (type && !opts.noFocus) {
    const pts = type === 'highway' ? nodesOfHw(id).map(P) : type === 'segment' ? [P(SG.get(id).from_node), P(SG.get(id).to_node)] : [P(type === 'node' ? id : LM.get(id).node_id)];
    // zoom in only when the map is small (phones); on a big screen the whole map stays in view
    if (pane.clientWidth < 700) focusOn(pts, type === 'highway' ? 150 : 320); else focusAll();
  }
}
function exploreClick(e) {
  if (dragged || state.real) return;
  const t = e.target.closest('[data-segment],[data-node],[data-landmark],[data-highway]');
  if (!t) { if (E.sel) exploreSelect(null, null, { noFocus: true }); return; }
  if (t.dataset.segment) {
    const s = SG.get(t.dataset.segment);
    // first click = the whole highway, a second click on the same highway = the segment under the finger
    if (E.sel && E.sel.type === 'highway' && E.sel.id === s.highway_id) exploreSelect('segment', s.id, { noFocus: true });
    else exploreSelect('highway', s.highway_id, { noFocus: true });
  } else if (t.dataset.node) exploreSelect('node', t.dataset.node, { noFocus: true });
  else if (t.dataset.landmark) exploreSelect('landmark', t.dataset.landmark, { noFocus: true });
  else if (t.dataset.highway) exploreSelect('highway', t.dataset.highway, { noFocus: true });
}
function explorePanelClick(e) {
  if (e.target.closest('[data-close]')) return exploreSelect(null, null);
  const f = e.target.closest('[data-f]');
  if (f) { E.filter = f.dataset.f; panel.querySelectorAll('[data-f]').forEach(c => c.setAttribute('aria-pressed', String(c === f))); applyExploreView(); return; }
  const go = e.target.closest('[data-go]'); if (!go) return;
  const [type, ...rest] = go.dataset.go.split(':'); exploreSelect(type, rest.join(':'));
}
function enterExplore(sel) {
  state.mode = 'explore';
  clearCar();
  setVisible({ hw: null, landmarks: true, mountains: true, nodes: 'all' });
  if (sel) exploreSelect(sel.type, sel.id); else { E.sel = null; panel.innerHTML = renderHome(); applyExploreView(); focusAll(); }
}
function leaveExplore() { E.sel = null; clearExploreView(); try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { /* ignore */ } }
