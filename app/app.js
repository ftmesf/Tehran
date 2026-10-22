// Explore mode: click anything on the map, see the table rows and the SQL behind it.
// Data comes from the tables embedded by tools/build-app.mjs (lat/lon and OSM evidence are stripped on purpose).
(() => {
  'use strict';
  const D = JSON.parse(document.getElementById('data').textContent);
  const index = rows => new Map(rows.map(r => [r.id, r]));
  const HW = index(D.highways), ND = index(D.nodes), SG = index(D.segments), LM = index(D.landmarks), SRC = index(D.sources);
  const svg = document.querySelector('#map-scroll svg');
  const panel = document.getElementById('panel');
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

  // ---------- words ----------
  const DIR_FA = { N: 'شمال', S: 'جنوب', E: 'شرق', W: 'غرب', NE: 'شمال‌شرق', NW: 'شمال‌غرب', SE: 'جنوب‌شرق', SW: 'جنوب‌غرب' };
  const DIR_UP = { N: 'بالا', S: 'پایین', E: 'راست', W: 'چپ', NE: 'بالا-راست', NW: 'بالا-چپ', SE: 'پایین-راست', SW: 'پایین-چپ' };
  const ARROW = { N: '↑', S: '↓', E: '→', W: '←', NE: '↗', NW: '↖', SE: '↘', SW: '↙' };
  const ORI = {
    NS: { label: 'عمودی', cls: 'v', sub: 'شمال ↕ جنوب' }, EW: { label: 'افقی', cls: 'h', sub: 'غرب ↔ شرق' },
    MIXED: { label: 'استثنا: وسط راه جهت عوض می‌کند', cls: 'x', sub: '' }, DIAGONAL: { label: 'استثنا: مورب', cls: 'x', sub: '' }
  };
  const TYPE_FA = { interchange: 'تقاطع', endpoint: 'سر خط', waypoint: 'خمیدگی', landmark: 'نماد' };
  const nm = n => n.name_fa || n.name_en || n.id;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---------- table/SQL rendering ----------
  const fmt = (v, col) => {
    if (v === null || v === undefined) return '<span class="nul">NULL</span>';
    if (typeof v === 'boolean') return v ? '<span class="t">true</span>' : '<span class="f">false</span>';
    if (Array.isArray(v)) return esc(v.join(', '));
    if (col === 'color') return `<span class="dot" style="background:${esc(v)}"></span>${esc(v)}`;
    if (col === 'direction') return `${esc(v)} ${ARROW[v] || ''}`;
    const fa = /[؀-ۿ]/.test(String(v));
    return fa ? `<span class="fa">${esc(v)}</span>` : esc(v);
  };
  const cell = (v, col) => `<td${/[؀-ۿ]/.test(String(v)) ? ' class="fa"' : ''}>${fmt(v, col)}</td>`;
  const kvTable = (cols, row) => `<div class="tw"><table class="kv">${cols.map(c => `<tr><th>${c}</th>${cell(row[c], c)}</tr>`).join('')}</table></div>`;
  // goOf(row) -> "type:id" makes the row clickable.
  const listTable = (cols, rows, goOf) => `<div class="tw"><table><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>${rows.map(r =>
    `<tr${goOf ? ` data-go="${esc(goOf(r))}" tabindex="0"` : ''}>${cols.map(c => cell(r[c], c)).join('')}</tr>`).join('')}</table></div>` +
    `<div class="rows">(${rows.length} row${rows.length === 1 ? '' : 's'})</div>`;
  const KW = /\b(SELECT|DISTINCT|FROM|WHERE|JOIN|ON|AS|AND|OR|IN|ORDER BY)\b/g;
  const sql = text => `<pre class="sql">${esc(text).replace(/(--[^\n]*)/g, '\u0001$1\u0002').replace(/'[^']*'/g, '<span class="str">$&</span>')
    .replace(KW, '<span class="kw">$1</span>').replace(/\u0001/g, '<span class="cm">').replace(/\u0002/g, '</span>')}</pre>`;
  const devHead = '<div class="devh">نمای برنامه‌نویس <code>Developer view</code></div>';
  const HIDDEN = '-- lat, lon exist in this table; hidden here\n';

  // ---------- panel pieces ----------
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
  const head = (r, color, kind) => `<div class="ph"><span class="swatch" style="background:${esc(color || 'var(--ink-soft)')}"></span><div><h2>${esc(nm(r))}</h2><small class="en">${esc(r.name_en || '')}</small></div>
    <button class="x" data-close aria-label="بستن" title="بستن (Esc)">✕</button></div>`;
  const northRule = '<div class="northrule"><b>↑</b><span>شمال = بالا = سربالایی، سمت کوه</span></div>';
  const footer = `<div class="foot">«تأییدشده» یعنی هندسه‌ی OpenStreetMap با این ردیف می‌خواند؛ <b>نه</b> اینکه پیچیدن از یک خط به خط دیگر مجاز باشد. ·
    Geography © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> (ODbL)</div>`;

  const COLS = {
    highways: ['id', 'name_fa', 'name_en', 'orientation', 'color', 'level', 'verified', 'source'],
    nodes: ['id', 'name_fa', 'name_en', 'type', 'x', 'y', 'verified', 'source'],
    landmarks: ['id', 'node_id', 'name_fa', 'name_en', 'icon', 'hint_fa', 'elevation_m', 'verified', 'source']
  };
  const q = (cols, table, where) => `SELECT ${cols.join(', ')}\nFROM ${table}${where ? '\nWHERE ' + where : ''};`;

  // rows of "highways that meet this node"
  const meetRows = nodeId => hwsAtNode(nodeId).map(id => {
    const segs = (segsAtNode.get(nodeId) || []).filter(s => s.highway_id === id);
    return { highway_id: id, name_en: HW.get(id).name_en, segment: segs.map(s => s.id).join(' + '), _go: 'highway:' + id };
  });

  function renderHome() {
    const hs = [...D.highways].sort((a, b) => a.level - b.level || group(a).localeCompare(group(b)));
    const all = [...D.highways, ...D.nodes, ...D.segments, ...D.landmarks];
    const ok = all.filter(r => r.verified).length;
    return `<div class="p">${northRule}
      <p class="plain">روی هر <b>خط</b>، <b>دایره</b> یا <b>نماد</b> بزن تا ردیف‌های جدول و کوئری SQL پشتش را ببینی.<br>
      آبی = <b>عمودی</b> (شمال–جنوب) · نارنجی = <b>افقی</b> (غرب–شرق) · بنفش خط‌چین = <b>استثنا</b>.</p>
      <ul class="how"><li>یک بار روی خط بزن: کل بزرگراه. دوباره روی همان خط: همان قطعه (segment).</li><li>در جدول‌ها هم روی هر ردیف می‌شود زد. <kbd>Esc</kbd> = بستن.</li></ul>
      ${devHead}
      ${sql(q(['id', 'name_fa', 'name_en', 'orientation', 'level', 'verified'], 'highways').replace(';', '\nORDER BY level, orientation;'))}
      ${listTable(['id', 'name_fa', 'name_en', 'orientation', 'level', 'verified'], hs, r => 'highway:' + r.id)}
      <div class="rows">${ok} / ${all.length} rows verified (highways, nodes, segments, landmarks)</div>
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

  function renderHighway(id) {
    const h = HW.get(id), segs = segsOfHw.get(id) || [];
    const plain = h.orientation === 'NS' ? 'خط <b>عمودی</b>: روی نقشه از بالا (شمال، سمت کوه) به پایین (جنوب) کشیده می‌شود.'
      : h.orientation === 'EW' ? 'خط <b>افقی</b>: روی نقشه از چپ (غرب) به راست (شرق) کشیده می‌شود.'
      : h.orientation === 'MIXED' ? '<b>استثنا</b>: وسط راه جهتش را عوض می‌کند — بخشی افقی، بخشی عمودی.'
      : '<b>استثنا</b>: مورب است، نه عمودی و نه افقی.';
    // Other highways that share a node with this one (this is the JOIN the lessons will use later).
    const crossings = [];
    for (const nid of nodesOfHw(id)) for (const o of hwsAtNode(nid)) if (o !== id) crossings.push({ other_highway: o, node: nid, _go: 'node:' + nid });
    const nodeCount = new Set(nodesOfHw(id)).size;
    return `<div class="p">${northRule}${head(h, h.color)}
      <div class="badges">${oriBadge(h)}${verifiedBadge(h)}<span class="badge n">درس ${h.level}</span></div>
      <p class="plain">${plain}<br>${endsText(h)}<br><small>${segs.length} قطعه · ${nodeCount} نقطه</small></p>
      ${unverifiedBox(h, 'بزرگراه')}${noteLine(h)}${h.official_name_fa ? `<div class="note">official_name_fa: ${esc(h.official_name_fa)}</div>` : ''}
      ${devHead}
      ${sql(HIDDEN + q(COLS.highways, 'highways', `id = '${id}'`))}${kvTable(COLS.highways, h)}
      ${sql(q(['order_on_highway', 'from_node', 'to_node', 'direction', 'kind', 'verified'], 'segments', `highway_id = '${id}'`).replace(';', '\nORDER BY order_on_highway;'))}
      ${listTable(['order_on_highway', 'from_node', 'to_node', 'direction', 'kind', 'verified'], segs.map(s => ({ ...s, _go: 'segment:' + s.id })), r => r._go)}
      ${sql(`-- which other highways share a node with '${id}'?\nSELECT DISTINCT o.highway_id AS other_highway, n.id AS node\nFROM segments m\nJOIN nodes n ON n.id IN (m.from_node, m.to_node)\nJOIN segments o ON n.id IN (o.from_node, o.to_node)\n  AND o.highway_id <> m.highway_id\nWHERE m.highway_id = '${id}';`)}
      ${crossings.length ? listTable(['other_highway', 'node'], crossings, r => r._go) : '<div class="rows">(0 rows) — no other highway touches this one in the data</div>'}
      ${sourcesBlock([h])}${footer}</div>`;
  }

  function renderNode(id) {
    const n = ND.get(id), hws = hwsAtNode(id), color = hws.length === 1 ? HW.get(hws[0]).color : null;
    const names = hws.map(h => `<button class="go" data-go="highway:${h}">${esc(HW.get(h).name_fa)}</button>`);
    const plain = n.type === 'interchange' ? (hws.length > 1 ? 'تقاطع: اینجا این خط‌ها به هم می‌رسند (در جدول یعنی یک <b>JOIN</b>).' : 'یک نقطه‌ی مهم روی این خط.')
      : n.type === 'endpoint' ? 'سر خط: جایی که این خط شروع یا تمام می‌شود.' : 'یک نقطه‌ی روی نقشه.';
    return `<div class="p">${northRule}${head(n, color)}
      <div class="badges"><span class="badge n">${TYPE_FA[n.type] || n.type}</span>${verifiedBadge(n)}</div>
      <p class="plain">${plain}</p>
      ${hws.length ? `<div class="join">${names.join(' ⋈ ')}</div>` : ''}
      ${n.alias_fa ? `<div class="note" style="direction:rtl;text-align:right">نام رایج‌تر: <b>${esc(n.alias_fa)}</b> (این اسم در OpenStreetMap نیست؛ از منبع زیر آمده)</div>` : ''}
      ${unverifiedBox(n, 'نقطه')}${noteLine(n)}
      ${devHead}
      ${sql(HIDDEN + q(COLS.nodes, 'nodes', `id = '${id}'`))}${kvTable(COLS.nodes, n)}
      ${sql(`SELECT h.id AS highway_id, h.name_en, s.id AS segment\nFROM segments s\nJOIN highways h ON h.id = s.highway_id\nWHERE '${id}' IN (s.from_node, s.to_node);`)}
      ${(segsAtNode.get(id) || []).length ? listTable(['highway_id', 'name_en', 'segment'],
        (segsAtNode.get(id) || []).map(s => ({ highway_id: s.highway_id, name_en: HW.get(s.highway_id).name_en, segment: s.id })), r => 'segment:' + r.segment) : '<div class="rows">(0 rows) — no highway is attached to this node</div>'}
      ${sourcesBlock([n])}${footer}</div>`;
  }

  function renderSegment(id) {
    const s = SG.get(id), h = HW.get(s.highway_id), a = ND.get(s.from_node), b = ND.get(s.to_node);
    const cols = ['id', 'highway_id', 'from_node', 'to_node', 'direction', 'order_on_highway', 'kind', 'verified', 'source'];
    return `<div class="p">${northRule}${head({ name_fa: `قطعه‌ی ${s.order_on_highway} از ${h.name_fa}`, name_en: `${h.name_en} · segment ${s.order_on_highway}` }, h.color)}
      <div class="badges"><span class="badge n">${DIR_FA[s.direction]} ${ARROW[s.direction]} (${DIR_UP[s.direction]})</span>${s.kind === 'tunnel' ? '<span class="badge n">تونل</span>' : ''}${verifiedBadge(s)}</div>
      <p class="plain">از <button class="go" data-go="node:${a.id}"><b>${esc(nm(a))}</b></button> به <button class="go" data-go="node:${b.id}"><b>${esc(nm(b))}</b></button>
        — حرکت به سمت <b>${DIR_FA[s.direction]}</b> (روی نقشه: ${DIR_UP[s.direction]}).</p>
      ${unverifiedBox(s, 'قطعه')}${noteLine(s)}
      ${devHead}
      ${sql(q(cols, 'segments', `id = '${id}'`))}${kvTable(cols, s)}
      ${sql(`SELECT a.name_fa AS from_name, b.name_fa AS to_name, h.name_en AS highway\nFROM segments s\nJOIN nodes a ON a.id = s.from_node\nJOIN nodes b ON b.id = s.to_node\nJOIN highways h ON h.id = s.highway_id\nWHERE s.id = '${id}';`)}
      ${listTable(['from_name', 'to_name', 'highway'], [{ from_name: nm(a), to_name: nm(b), highway: h.name_en }])}
      ${sourcesBlock([s, h])}${footer}</div>`;
  }

  function renderLandmark(id) {
    const l = LM.get(id), n = ND.get(l.node_id);
    return `<div class="p">${northRule}${head(l, null)}
      <div class="badges"><span class="badge n">نماد مرجع برای حافظه</span>${verifiedBadge(l)}</div>
      <p class="plain">${esc(l.hint_fa || '')}</p>
      ${unverifiedBox(l, 'نماد')}
      ${devHead}
      ${sql(HIDDEN + q(COLS.landmarks, 'landmarks', `id = '${id}'`))}${kvTable(COLS.landmarks, l)}
      ${sql(`SELECT n.id, n.x, n.y\nFROM landmarks l\nJOIN nodes n ON n.id = l.node_id\nWHERE l.id = '${id}';`)}
      ${listTable(['id', 'x', 'y'], [n])}
      ${sourcesBlock([l])}${footer}</div>`;
  }

  // ---------- map state ----------
  const state = { sel: null, filter: 'all', zoom: 1 };
  const mk = (tag, cls, attrs) => { const e = document.createElementNS(NS_URI, tag); e.setAttribute('class', cls); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const under = mk('g', 'sel-under', {}), over = mk('g', 'sel-over', {});
  svg.insertBefore(under, svg.querySelector('#highways'));
  svg.appendChild(over);
  const pathD = ids => ids.map((id, i) => `${i ? 'L' : 'M'}${ND.get(id).x} ${ND.get(id).y}`).join(' ');

  function focusSets() {
    const sel = state.sel; if (!sel) return { hw: null, nodes: null, lm: null };
    if (sel.type === 'highway') return { hw: new Set([sel.id]), nodes: new Set(nodesOfHw(sel.id)), lm: new Set() };
    if (sel.type === 'segment') { const s = SG.get(sel.id); return { hw: new Set([s.highway_id]), nodes: new Set([s.from_node, s.to_node]), lm: new Set() }; }
    if (sel.type === 'node') return { hw: new Set(hwsAtNode(sel.id)), nodes: new Set([sel.id]), lm: new Set() };
    return { hw: null, nodes: null, lm: new Set([sel.id]) };
  }

  function applyView() {
    const { hw, nodes, lm } = focusSets();
    const inFilter = h => state.filter === 'all' || group(HW.get(h)) === state.filter;
    const nodeGhost = id => state.filter !== 'all' && !hwsAtNode(id).some(inFilter);
    svg.querySelectorAll('[data-highway]').forEach(el => {
      const id = el.dataset.highway;
      el.classList.toggle('dim', !!hw && !hw.has(id));
      el.classList.toggle('ghost', !inFilter(id));
      el.classList.toggle('sel', !!hw && hw.has(id)); // a selected highway is never greyed out by the filter
    });
    svg.querySelectorAll('.node[data-node]').forEach(el => {
      const id = el.dataset.node;
      el.classList.toggle('dim', !!nodes && !nodes.has(id));
      el.classList.toggle('ghost', nodeGhost(id));
    });
    svg.querySelectorAll('.landmark[data-landmark]').forEach(el => {
      el.classList.toggle('dim', !!state.sel && !(lm && lm.has(el.dataset.landmark)));
    });
    // halos
    under.replaceChildren(); over.replaceChildren();
    const sel = state.sel; if (!sel) return;
    if (sel.type === 'highway') under.append(mk('path', 'halo-under', { d: pathD(nodesOfHw(sel.id)) }));
    if (sel.type === 'segment') { const s = SG.get(sel.id); under.append(mk('path', 'halo-under', { d: pathD([s.from_node, s.to_node]) })); }
    if (sel.type === 'node') { const n = ND.get(sel.id); over.append(mk('circle', 'halo-ring-soft', { cx: n.x, cy: n.y, r: 34 }), mk('circle', 'halo-ring', { cx: n.x, cy: n.y, r: 34 })); }
    if (sel.type === 'landmark') { const n = ND.get(LM.get(sel.id).node_id); over.append(mk('circle', 'halo-ring-soft', { cx: n.x, cy: n.y, r: 56 }), mk('circle', 'halo-ring', { cx: n.x, cy: n.y, r: 56 })); }
  }

  const RENDER = { highway: renderHighway, node: renderNode, segment: renderSegment, landmark: renderLandmark };
  const TABLE = { highway: HW, node: ND, segment: SG, landmark: LM };
  function select(type, id, opts = {}) {
    if (type && !(TABLE[type] && TABLE[type].has(id))) { type = null; }
    state.sel = type ? { type, id } : null;
    panel.innerHTML = type ? RENDER[type](id) : renderHome();
    panel.scrollTop = 0;
    applyView();
    try { history.replaceState(null, '', type ? `#${type}=${encodeURIComponent(id)}` : location.pathname + location.search); } catch (_) { /* file:// in some browsers */ }
    if (type && !opts.noScroll) {
      const target = (type === 'node' || type === 'landmark' ? over : under).firstElementChild;
      if (target && target.scrollIntoView) target.scrollIntoView({ block: 'center', inline: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }

  // ---------- events ----------
  svg.addEventListener('click', e => {
    const t = e.target.closest('[data-segment],[data-node],[data-landmark],[data-highway]');
    if (!t) { if (state.sel) select(null); return; }
    if (t.dataset.segment) {
      const s = SG.get(t.dataset.segment);
      // first click = the whole highway, a second click on the same highway = the segment under the finger
      if (state.sel && state.sel.type === 'highway' && state.sel.id === s.highway_id) select('segment', s.id, { noScroll: true });
      else select('highway', s.highway_id, { noScroll: true });
    } else if (t.dataset.node) select('node', t.dataset.node, { noScroll: true });
    else if (t.dataset.landmark) select('landmark', t.dataset.landmark, { noScroll: true });
    else if (t.dataset.highway) select('highway', t.dataset.highway, { noScroll: true });
  });
  // keyboard access for the things that have labels
  svg.querySelectorAll('.hw-label,.landmark,.hit-node').forEach(el => {
    const type = el.dataset.highway ? 'highway' : el.dataset.landmark ? 'landmark' : 'node';
    const id = el.dataset.highway || el.dataset.landmark || el.dataset.node;
    const row = TABLE[type].get(id);
    el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button'); el.setAttribute('aria-label', `${row.name_fa || row.name_en || id} (${row.name_en || id})`);
    el.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(type, id); } });
  });
  panel.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) return select(null);
    const go = e.target.closest('[data-go]'); if (!go) return;
    const [type, ...rest] = go.dataset.go.split(':'); select(type, rest.join(':'));
  });
  panel.addEventListener('keydown', e => {
    const go = e.target.closest && e.target.closest('tr[data-go]');
    if (go && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go.click(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.sel) select(null); });

  const fromHash = () => {
    const m = /^#(highway|node|segment|landmark)=(.+)$/.exec(location.hash);
    if (m) select(m[1], decodeURIComponent(m[2])); else select(null);
  };
  window.addEventListener('hashchange', () => {
    const m = /^#(\w+)=(.+)$/.exec(location.hash), cur = state.sel;
    if (!m ? !!cur : !cur || cur.type !== m[1] || cur.id !== decodeURIComponent(m[2])) fromHash();
  });

  // ---------- filter chips ----------
  const chips = document.getElementById('chips');
  const FILTERS = [['all', 'همه', null], ['NS', 'عمودی', 'var(--c-v)'], ['EW', 'افقی', 'var(--c-h)'], ['X', 'استثنا', 'var(--c-x)']];
  chips.innerHTML = FILTERS.map(([k, label, c]) => `<button class="chip" data-f="${k}" aria-pressed="${k === 'all'}">${c ? `<i style="background:${c}"></i>` : ''}${label}</button>`).join('');
  chips.addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    state.filter = b.dataset.f;
    chips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    applyView();
  });

  // ---------- zoom (1 = the whole map fits; the map is never rotated) ----------
  const LEVELS = [1, 1.5, 2, 3];
  function fit() {
    const w = scroller.clientWidth, h = scroller.clientHeight, ratio = 1600 / 1400;
    svg.style.width = Math.max(240, Math.min(w, h * ratio)) * LEVELS[state.zoom] + 'px';
  }
  const setZoom = z => { state.zoom = Math.max(0, Math.min(LEVELS.length - 1, z)); fit(); };
  document.getElementById('zin').addEventListener('click', () => setZoom(state.zoom + 1));
  document.getElementById('zout').addEventListener('click', () => setZoom(state.zoom - 1));
  new ResizeObserver(fit).observe(scroller);

  // ---------- theme ----------
  const root = document.documentElement;
  try { const t = localStorage.getItem('theme'); if (t) root.dataset.theme = t; } catch (_) { /* storage can be blocked */ }
  document.getElementById('theme').addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (_) { /* ignore */ }
  });

  setZoom(0);
  fromHash();
})();
