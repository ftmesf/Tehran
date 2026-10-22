// ===== lessons: Levels 0-3, short teaching cards, then a quiz that answers on the map =====
// Every question is generated from the data tables, so the answers cannot drift away from the rows the learner sees.
const LEVELS = [
  { n: 0, fa: 'قطب‌نما', en: 'Compass', quiz: 6 },
  { n: 1, fa: 'شبکه', en: 'The grid', quiz: 8 },
  { n: 2, fa: 'تقاطع‌ها', en: 'Intersections', quiz: 8 },
  { n: 3, fa: 'استثناها', en: 'Edge cases', quiz: 8 }
];
const PASS = 0.8; // "about 80% right" unlocks the next level
const hwUpTo = n => new Set(D.highways.filter(h => h.level <= n && n > 0).map(h => h.id));
const progress = () => store.get('progress', { passed: {} });
const allOpen = () => store.get('openAll', false);
const unlocked = n => n === 0 || allOpen() || !!progress().passed[n - 1];

const L = { n: null, phase: 'intro', steps: [], si: 0, queue: [], qi: 0, first: new Map(), total: 0, q: null, answered: false, token: 0 };

// ---------- small bits of UI ----------
// a highway name always carries its own colour dot, so the learner connects the word with the line on the map
const nameBtn = id => `<b class="hwn"><i style="background:${esc(HW.get(id).color)}"></i>${esc(HW.get(id).name_fa)}</b>`;
const nameBoth = id => `<b>${esc(HW.get(id).name_fa)}</b> <small>${esc(HW.get(id).name_en)}</small>`;
const lmName = id => LM.get(id).name_fa;
const devBlock = blocks => blocks.map(b => (b.sql ? sql(b.sql) : '') + (b.cols ? listTable(b.cols, b.rows) : '') + (b.note ? `<div class="note" style="direction:rtl;text-align:right">${b.note}</div>` : '')).join('');
const rowLine = t => t ? `<code class="rowline" dir="ltr">${esc(t)}</code>` : '';

function card({ kicker, bar, title, body = '', en = '', choices = '', hint = '', foot = '' }) {
  panel.innerHTML = `<div class="card">
    <div class="kick"><span>${kicker}</span><button class="x" data-quit title="خروج از درس" aria-label="خروج از درس">✕</button></div>
    <div class="bar">${bar}</div>
    ${title ? `<h2 class="qt">${title}</h2>` : ''}${en ? `<div class="en-sub" dir="ltr">${en}</div>` : ''}
    ${body ? `<div class="body">${body}</div>` : ''}
    ${hint ? `<div class="tiphint">${hint}</div>` : ''}${choices}
    <div class="fb" id="fb" aria-live="polite"></div>
    <div class="foot-slot" id="slot">${foot}</div>
  </div>`;
  panel.scrollTop = 0;
}
const kickerOf = (n, extra) => `درس ${toFa(n)} · ${LEVELS[n].fa}${extra ? ' · ' + extra : ''}`;

// ---------- intro steps (teach first) ----------
function centerOf(id) { const ns = nodesOfHw(id).map(P); return [ns.reduce((s, p) => s + p[0], 0) / ns.length, ns.reduce((s, p) => s + p[1], 0) / ns.length]; }
// route points oriented so the car goes north (vertical lines) or east (horizontal lines)
function routeFor(id) {
  const pts = nodesOfHw(id).map(P), a = pts[0], b = pts[pts.length - 1], g = group(HW.get(id));
  const rev = g === 'NS' ? b[1] > a[1] : g === 'EW' ? b[0] < a[0] : false;
  return rev ? pts.reverse() : pts;
}
function introSteps(n) {
  const S = [];
  if (n === 0) {
    const lms = D.landmarks.map(l => ({ l, p: P(l.node_id) }));
    const ext = { N: Math.min(...lms.map(o => o.p[1])), S: Math.max(...lms.map(o => o.p[1])), W: Math.min(...lms.map(o => o.p[0])), E: Math.max(...lms.map(o => o.p[0])) };
    const describe = o => o.p[1] === ext.N ? 'شمالی‌ترین نماد — بالای نقشه، نزدیک کوه' : o.p[1] === ext.S ? 'جنوبی‌ترین نماد — پایین نقشه'
      : o.p[0] === ext.W ? 'غربی‌ترین نماد — سمت چپ' : o.p[0] === ext.E ? 'شرقی‌ترین نماد — سمت راست' : 'وسط شهر';
    S.push({ title: 'کوه‌ها بالای نقشه‌اند', body: '<p class="big">بالا = <b>شمال</b> = سمت کوه</p><p>این قانون همیشه برقرار است: نقشه هیچ‌وقت نمی‌چرخد.</p>', en: 'Up = north = the mountains. The map never rotates.',
      vis: [], landmarks: false, pulse: ['#mountains', '#compass'], focus: null });
    S.push({ title: 'بالا یعنی سربالایی', body: '<p>شهر از کوه به سمت جنوب سرازیر می‌شود.<br><b>بالا = شمال = سربالایی</b><br><b>پایین = جنوب = سرازیری</b></p>', en: 'North = uphill, south = downhill.',
      vis: [], landmarks: false, car: [[800, 1080], [800, 520]], focus: null });
    S.push({ title: 'راست و چپ', body: '<p>سمت <b>راست</b> = <b>شرق</b> →<br>سمت <b>چپ</b> = <b>غرب</b> ←</p>', en: 'Right = east, left = west.',
      vis: [], landmarks: false, car: [[420, 800], [1180, 800]], focus: null });
    S.push({ title: 'چهار نماد برای حافظه', en: 'Four landmarks to remember',
      body: `<div class="lmlist">${lms.map(o => `<button class="lmrow" data-lm="${o.l.id}"><b>${esc(o.l.name_fa)}</b><span>${describe(o)}${o.l.verified ? '' : ' <i>(موقعیت دقیقش هنوز تأییدنشده)</i>'}</span></button>`).join('')}</div>`,
      vis: [], landmarks: true, focus: null, lmClick: true,
      dev: [{ sql: q(['id', 'name_fa', 'x', 'y'], 'nodes', `id IN (${D.landmarks.map(l => `'${l.node_id}'`).join(', ')})`), cols: ['id', 'name_fa', 'x', 'y'], rows: D.landmarks.map(l => ND.get(l.node_id)), note: 'y کوچک‌تر = بالاتر = شمالی‌تر · x کوچک‌تر = چپ‌تر = غربی‌تر' }] });
    return S;
  }
  if (n === 1) {
    const order = ['kordestan', 'modares', 'sayyad', 'niayesh', 'hemmat', 'resalat'];
    order.forEach((id, i) => {
      const h = HW.get(id), v = group(h) === 'NS';
      S.push({ title: `${esc(h.name_fa)}`, en: h.name_en, vis: order.slice(0, i + 1), halo: [['highway', id]], focus: nodesOfHw(id).map(P), car: routeFor(id), landmarks: true,
        body: v ? `<p>این یک خط <b class="c-v">عمودی</b> است.<br>از بالا (شمال) تا پایین (جنوب).</p>` : `<p>این یک خط <b class="c-h">افقی</b> است.<br>از چپ (غرب) تا راست (شرق).</p>`,
        dev: [{ sql: q(['id', 'name_en', 'orientation'], 'highways', `id = '${id}'`), cols: ['id', 'name_en', 'orientation'], rows: [h], note: v ? 'NS = north–south = عمودی' : 'EW = east–west = افقی' }] });
    });
    return S;
  }
  if (n === 2) {
    const fresh = D.highways.filter(h => h.level === 2).map(h => h.id), prev = [...hwUpTo(1)], vs = [...hwUpTo(2)];
    S.push({ title: 'شش خط تازه', en: 'Six new highways', vis: vs, focus: null, halo: fresh.map(id => ['highway', id]),
      body: `<p>خط‌های درخشان تازه‌اند. باز هم آبی = عمودی، نارنجی = افقی.</p><div class="chiprow">${fresh.map(id => `<span class="mini"><i style="background:${esc(HW.get(id).color)}"></i>${esc(HW.get(id).name_fa)}</span>`).join('')}</div>` });
    const join = (id, title, text) => {
      const hws = hwsAtNode(id).filter(h => vs.includes(h)), names = hws.map(h => HW.get(h).name_en);
      return { title, en: names.join(' ⋈ '), vis: vs, halo: [['node', id]], focus: [P(id)], pulse: [],
        body: `<p>${text}</p><div class="join">${hws.map(nameBtn).join(' ⋈ ')}</div>`,
        dev: [{ sql: `SELECT h.id AS highway_id\nFROM segments s\nJOIN highways h ON h.id = s.highway_id\nWHERE '${id}' IN (s.from_node, s.to_node);`, cols: ['highway_id'], rows: hws.map(h => ({ highway_id: h })), note: 'تقاطع = یک node که قطعه‌های (segments) چند بزرگراه به آن وصل‌اند' }] };
    };
    S.push(join('n_fajr', 'تقاطع = جایی که دو خط به هم می‌رسند', 'مثل یک JOIN: ردیف‌هایی که یک node مشترک دارند.'));
    S.push(join('n_sadr_mod', 'گاهی سه خط یک جا می‌رسند', 'یک تقاطع می‌تواند بیشتر از دو خط داشته باشد.'));
    return S;
  }
  // level 3
  const vs = [...hwUpTo(3)];
  const iso = id => nodesOfHw(id).every(nid => hwsAtNode(nid).length === 1);
  S.push({ title: 'استثناها بنفش خط‌چین‌اند', en: 'Edge cases are purple and dashed', vis: vs, halo: ['chamran', 'yadegar', 'azadegan'].map(id => ['highway', id]), focus: null,
    body: '<p>تا حالا همه‌چیز عمودی یا افقی بود. سه خط استثنا هستند: یا وسط راه جهت عوض می‌کنند، یا مورب‌اند.</p>' });
  for (const id of ['chamran', 'yadegar', 'azadegan']) {
    const h = HW.get(id), segs = segsOfHw.get(id), seq = []; for (const s of segs) if (seq[seq.length - 1] !== s.direction) seq.push(s.direction);
    S.push({ title: esc(h.name_fa), en: h.name_en, vis: vs, halo: [['highway', id]], focus: nodesOfHw(id).map(P), car: nodesOfHw(id).map(P),
      body: `<p>${plainOf(h)}</p><p class="seq">${seq.map(d => `${DIR_FA[d]} ${ARROW[d]}`).join('، بعد ')}</p>${iso(id) ? '<p><small>در داده‌ی ما به هیچ بزرگراه دیگری وصل نیست.</small></p>' : ''}`,
      dev: [{ sql: q(['order_on_highway', 'direction'], 'segments', `highway_id = '${id}'`).replace(';', '\nORDER BY order_on_highway;'), cols: ['order_on_highway', 'direction'], rows: segs }] });
  }
  return S;
}

// ---------- question generators ----------
const centerKey = (id, axis) => centerOf(id)[axis === 'x' ? 0 : 1];
function repNode(id) { const ns = nodesOfHw(id).filter(n => ND.get(n).type === 'interchange'); return ns[Math.floor(ns.length / 2)] || nodesOfHw(id)[0]; }
const choiceFrom = (arr, key) => shuffle(arr).map(o => ({ key: o[key], ...o }));
function mkChoices(items, correct) { return { choices: shuffle(items), correct }; }
const dirChoice = [{ key: 'N', fa: 'بالا ↑' }, { key: 'S', fa: 'پایین ↓' }, { key: 'E', fa: 'راست →' }, { key: 'W', fa: 'چپ ←' }];

const GEN = {
  mountain() {
    return { sig: 'mountain', kind: 'direction', fa: 'کوه‌ها بالای نقشه‌اند. بالا کدام جهت است؟', ...mkChoices([{ key: 'N', fa: 'شمال' }, { key: 'S', fa: 'جنوب' }, { key: 'E', fa: 'شرق' }, { key: 'W', fa: 'غرب' }], 'N'),
      why: 'بالا = شمال = سمت کوه.', line: '', dev: [{ note: 'اینجا جدولی نیست؛ قانون ثابت نقشه است: y کوچک‌تر = بالاتر = شمالی‌تر.' }],
      setup: () => { focusAll(); }, reveal: () => { pulse(document.querySelector('#mountains'), true); return driveCar([[800, 1000], [800, 520]]); } };
  },
  dirword() {
    const d = shuffle(['N', 'S', 'E', 'W'])[0], start = [800, 760], end = [start[0] + VEC[d][0] * 380, start[1] + VEC[d][1] * 300];
    return { sig: 'dirword:' + d, kind: 'direction', fa: `اگر به سمت <b>${DIR_FA[d]}</b> بروی، روی نقشه به کدام طرف می‌روی؟`, ...mkChoices(dirChoice.map(c => ({ ...c })), d),
      why: `${DIR_FA[d]} = ${DIR_UP[d]}.`, line: '', dev: [{ note: 'شمال = بالا · جنوب = پایین · شرق = راست · غرب = چپ' }],
      setup: () => { focusAll(); parkCar(start, 0); }, reveal: () => driveCar([start, end]) };
  },
  landNS() {
    const ls = D.landmarks.map(l => ({ id: l.id, p: P(l.node_id) })), pairs = [];
    for (const a of ls) for (const b of ls) if (a.id < b.id && Math.abs(a.p[1] - b.p[1]) >= 150) pairs.push([a, b]);
    const [a, b] = shuffle(pairs)[0], north = Math.random() < .6, win = (a.p[1] < b.p[1]) === north ? a : b, lose = win === a ? b : a;
    return { facts: { k: 'landNS', win: win.id, lose: lose.id, north }, sig: `landNS:${a.id}:${b.id}:${north}`, kind: 'relative', fa: north ? 'کدام نماد <b>شمالی‌تر</b> است؟ (سربالاتر، نزدیک‌تر به کوه)' : 'کدام نماد <b>جنوبی‌تر</b> است؟ (سرازیرتر، دورتر از کوه)',
      ...mkChoices([a, b].map(o => ({ key: o.id, fa: lmName(o.id), en: LM.get(o.id).name_en })), win.id),
      why: `${lmName(win.id)} روی نقشه ${north ? 'بالاتر' : 'پایین‌تر'} است، پس ${north ? 'شمالی‌تر' : 'جنوبی‌تر'}.`,
      line: `y: ${LM.get(win.id).name_en}=${win.p[1]} ${north ? '<' : '>'} ${LM.get(lose.id).name_en}=${lose.p[1]}`,
      dev: [{ sql: q(['id', 'name_en', 'x', 'y'], 'nodes', `id IN ('${LM.get(a.id).node_id}', '${LM.get(b.id).node_id}')`), cols: ['id', 'name_en', 'x', 'y'], rows: [ND.get(LM.get(a.id).node_id), ND.get(LM.get(b.id).node_id)], note: 'y کوچک‌تر = بالاتر = شمالی‌تر' }],
      setup: () => { focusAll(); clearCar(); }, reveal: () => { halo('landmark', a.id); halo('landmark', b.id); return driveCar(north ? [lose.p, win.p] : [lose.p, win.p]); } };
  },
  landWE() {
    const ls = D.landmarks.map(l => ({ id: l.id, p: P(l.node_id) })), pairs = [];
    for (const a of ls) for (const b of ls) if (a.id < b.id && Math.abs(a.p[0] - b.p[0]) >= 150) pairs.push([a, b]);
    const [a, b] = shuffle(pairs)[0], west = Math.random() < .5, win = (a.p[0] < b.p[0]) === west ? a : b, lose = win === a ? b : a;
    return { facts: { k: 'landWE', win: win.id, lose: lose.id, west }, sig: `landWE:${a.id}:${b.id}:${west}`, kind: 'relative', fa: west ? 'کدام نماد <b>غربی‌تر</b> است؟ (چپ‌تر)' : 'کدام نماد <b>شرقی‌تر</b> است؟ (راست‌تر)',
      ...mkChoices([a, b].map(o => ({ key: o.id, fa: lmName(o.id), en: LM.get(o.id).name_en })), win.id),
      why: `${lmName(win.id)} روی نقشه ${west ? 'چپ‌تر' : 'راست‌تر'} است، پس ${west ? 'غربی‌تر' : 'شرقی‌تر'}.`,
      line: `x: ${LM.get(win.id).name_en}=${win.p[0]} ${west ? '<' : '>'} ${LM.get(lose.id).name_en}=${lose.p[0]}`,
      dev: [{ sql: q(['id', 'name_en', 'x', 'y'], 'nodes', `id IN ('${LM.get(a.id).node_id}', '${LM.get(b.id).node_id}')`), cols: ['id', 'name_en', 'x', 'y'], rows: [ND.get(LM.get(a.id).node_id), ND.get(LM.get(b.id).node_id)], note: 'x کوچک‌تر = چپ‌تر = غربی‌تر' }],
      setup: () => { focusAll(); clearCar(); }, reveal: () => { halo('landmark', a.id); halo('landmark', b.id); return driveCar([lose.p, win.p]); } };
  },
  orient(vis, n) {
    const pool = [...vis].map(id => HW.get(id)), weight = h => (h.level === n ? 3 : 1) * (n === 3 && group(h) === 'X' ? 3 : 1);
    const bag = pool.flatMap(h => Array(weight(h)).fill(h)), h = shuffle(bag)[0], g = group(h);
    const items = [{ key: 'NS', fa: 'عمودی ↕' }, { key: 'EW', fa: 'افقی ↔' }].concat(n >= 3 ? [{ key: 'X', fa: 'استثنا (جهت عوض می‌کند / مورب)' }] : []);
    return { sig: 'orient:' + h.id, kind: 'orientation', fa: `${nameBtn(h.id)} یک خط عمودی است یا افقی؟${n >= 3 ? ' (یا استثنا؟)' : ''}`, en: h.name_en, ...mkChoices(items, g),
      why: plainOf(h).replace(/<\/?b>/g, ''), line: `highways['${h.id}'].orientation = ${h.orientation}`,
      dev: [{ sql: q(['id', 'name_en', 'orientation'], 'highways', `id = '${h.id}'`), cols: ['id', 'name_en', 'orientation'], rows: [h] }],
      setup: () => { halo('highway', h.id); focusOn(nodesOfHw(h.id).map(P), 200); }, reveal: () => driveCar(routeFor(h.id)) };
  },
  rel(vis) {
    const ids = [...vis].filter(id => group(HW.get(id)) !== 'X'), pairs = [];
    for (const a of ids) for (const b of ids) if (a < b && group(HW.get(a)) === group(HW.get(b))) {
      const ax = group(HW.get(a)) === 'NS' ? 'x' : 'y';
      if (Math.abs(centerKey(a, ax) - centerKey(b, ax)) >= 90) pairs.push([a, b, ax]);
    }
    if (!pairs.length) return null;
    const [a, b, ax] = shuffle(pairs)[0], low = Math.random() < .5;
    const words = ax === 'x' ? (low ? ['غربی‌تر', 'چپ‌تر'] : ['شرقی‌تر', 'راست‌تر']) : (low ? ['شمالی‌تر', 'بالاتر، سربالاتر'] : ['جنوبی‌تر', 'پایین‌تر، سرازیرتر']);
    const win = (centerKey(a, ax) < centerKey(b, ax)) === low ? a : b, lose = win === a ? b : a, na = repNode(a), nb = repNode(b);
    return { facts: { k: 'rel', win, lose, ax, low }, sig: `rel:${a}:${b}:${low}`, kind: 'relative', fa: `کدام <b>${words[0]}</b> است: ${nameBtn(a)} یا ${nameBtn(b)}؟ <small>(${words[1]})</small>`,
      ...mkChoices([a, b].map(id => ({ key: id, fa: HW.get(id).name_fa, en: HW.get(id).name_en })), win),
      why: `${HW.get(win).name_fa} روی نقشه ${ax === 'x' ? (low ? 'چپ‌تر' : 'راست‌تر') : (low ? 'بالاتر' : 'پایین‌تر')} است.`,
      line: `${ax}: ${HW.get(win).name_en}=${Math.round(centerKey(win, ax))} ${low ? '<' : '>'} ${HW.get(lose).name_en}=${Math.round(centerKey(lose, ax))}`,
      dev: [{ sql: q(['id', 'name_fa', 'x', 'y'], 'nodes', `id IN ('${na}', '${nb}')`), cols: ['id', 'name_fa', 'x', 'y'], rows: [ND.get(na), ND.get(nb)], note: ax === 'x' ? 'x کوچک‌تر = چپ‌تر = غربی‌تر' : 'y کوچک‌تر = بالاتر = شمالی‌تر' }],
      setup: () => { halo('highway', a); halo('highway', b); focusOn([...nodesOfHw(a), ...nodesOfHw(b)].map(P), 160); },
      reveal: () => { clearHalos(); halo('highway', win); return driveCar(ax === 'x' ? [[...P(repNode(lose))], [...P(repNode(win))]] : [[...P(repNode(lose))], [...P(repNode(win))]]); } };
  },
  dir(vis) {
    const segs = D.segments.filter(s => vis.has(s.highway_id) && group(HW.get(s.highway_id)) !== 'X' && VEC[s.direction] && s.kind === 'road');
    if (!segs.length) return null;
    const s = shuffle(segs)[0], h = HW.get(s.highway_id), g = group(h), a = ND.get(s.from_node), b = ND.get(s.to_node);
    const items = g === 'NS' ? dirChoice.slice(0, 2) : dirChoice.slice(2);
    const word = { N: 'بالا', S: 'پایین', E: 'راست', W: 'چپ' }[s.direction];
    return { facts: { k: 'dir', seg: s.id, dir: s.direction }, sig: 'dir:' + s.id, kind: 'direction', fa: `روی ${nameBtn(h.id)} از «${esc(nm(a))}» به سمت <b>${DIR_FA[s.direction]}</b> می‌روی. روی نقشه به کدام طرف می‌روی؟`, en: h.name_en,
      ...mkChoices(items.map(c => ({ ...c })), s.direction), why: `${DIR_FA[s.direction]} = ${word}.`, line: `segments['${s.id}'].direction = ${s.direction} ${ARROW[s.direction]}`,
      dev: [{ sql: q(['id', 'from_node', 'to_node', 'direction'], 'segments', `id = '${s.id}'`), cols: ['id', 'from_node', 'to_node', 'direction'], rows: [s] }],
      setup: () => { halo('highway', h.id); parkCar(P(a.id), Math.atan2(P(b.id)[1] - P(a.id)[1], P(b.id)[0] - P(a.id)[0]) * 180 / Math.PI); focusOn([P(a.id), P(b.id)], 260); }, reveal: () => driveCar([P(a.id), P(b.id)]) };
  },
  neighbor(vis) {
    const cands = [];
    for (const id of vis) {
      if (group(HW.get(id)) === 'X') continue;
      const ns = nodesOfHw(id), cr = ns.map((nid, i) => ({ nid, i, others: hwsAtNode(nid).filter(o => o !== id && vis.has(o)) })).filter(c => c.others.length);
      for (let k = 0; k < cr.length - 1; k++) if (cr[k].others.length === 1 && cr[k + 1].others.length === 1) cands.push({ id, ns, a: cr[k], b: cr[k + 1] });
    }
    for (const c of shuffle(cands)) {
      const rev = Math.random() < .5, from = rev ? c.b : c.a, to = rev ? c.a : c.b, [fx, fy] = P(from.nid), [tx, ty] = P(to.nid), dx = tx - fx, dy = ty - fy;
      if (Math.abs(Math.abs(dx) - Math.abs(dy)) < 30) continue;
      const d = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'N' : 'S') : (dx > 0 ? 'E' : 'W'), start = from.others[0], ans = to.others[0];
      const rest = shuffle([...vis].filter(o => ![c.id, start, ans].includes(o))).slice(0, 2);
      if (rest.length < 1) continue;
      const route = rev ? c.ns.slice(c.a.i, c.b.i + 1).reverse() : c.ns.slice(c.a.i, c.b.i + 1), hws = hwsAtNode(to.nid).filter(o => vis.has(o));
      return { facts: { k: 'nb', hw: c.id, from: from.nid, to: to.nid, dir: d, start, ans }, sig: `nb:${c.id}:${start}:${d}`, kind: 'neighbor', fa: `روی ${nameBtn(c.id)} از تقاطع با ${nameBtn(start)} به سمت <b>${DIR_FA[d]}</b> می‌روی. اولین بزرگراهی که بعد قطع می‌کنی کدام است؟`,
        en: 'only the highways drawn on the map', ...mkChoices([ans, ...rest].map(id => ({ key: id, fa: HW.get(id).name_fa, en: HW.get(id).name_en })), ans),
        why: `بعد از ${HW.get(start).name_fa}، به ${HW.get(ans).name_fa} می‌رسی.`, line: `node ${to.nid}: ${hws.join(' ⋈ ')}`,
        dev: [{ sql: `SELECT h.id AS highway_id\nFROM segments s\nJOIN highways h ON h.id = s.highway_id\nWHERE '${to.nid}' IN (s.from_node, s.to_node);`, cols: ['highway_id'], rows: hws.map(h => ({ highway_id: h })) }],
        setup: () => { halo('highway', c.id); halo('node', from.nid); parkCar(P(from.nid), Math.atan2(ty - fy, tx - fx) * 180 / Math.PI); focusOn(route.map(P), 230); },
        reveal: () => { halo('node', to.nid); return driveCar(route.map(P)); } };
    }
    return null;
  },
  tapNode(vis) {
    const nodes = D.nodes.filter(n => n.type === 'interchange'), pairs = [];
    for (const n of nodes) { const hs = hwsAtNode(n.id).filter(h => vis.has(h)); for (const a of hs) for (const b of hs) if (a < b) pairs.push([a, b]); }
    const uniq = pairs.filter(([a, b]) => nodes.filter(n => { const hs = hwsAtNode(n.id).filter(h => vis.has(h)); return hs.includes(a) && hs.includes(b); }).length === 1);
    if (!uniq.length) return null;
    const [a, b] = shuffle(uniq)[0], target = nodes.find(n => { const hs = hwsAtNode(n.id); return hs.includes(a) && hs.includes(b); }), hws = hwsAtNode(target.id).filter(h => vis.has(h));
    return { facts: { k: 'tapNode', a, b }, sig: `tapnode:${a}:${b}`, kind: 'tap', tap: 'node', ok: id => { const hs = hwsAtNode(id); return hs.includes(a) && hs.includes(b); },
      fa: `تقاطعِ ${nameBtn(a)} و ${nameBtn(b)} را روی نقشه نشان بده.`, en: `${HW.get(a).name_en} ⋈ ${HW.get(b).name_en}`, hint: 'روی دایره‌ی سفید بزن',
      why: `${HW.get(a).name_fa} ⋈ ${HW.get(b).name_fa}: همین‌جا به هم می‌رسند.`, line: `node ${target.id}: ${hws.join(' ⋈ ')}`,
      dev: [{ sql: `SELECT h.id AS highway_id\nFROM segments s\nJOIN highways h ON h.id = s.highway_id\nWHERE '${target.id}' IN (s.from_node, s.to_node);`, cols: ['highway_id'], rows: hws.map(h => ({ highway_id: h })) }],
      setup: () => { clearHalos(); clearCar(); halo('highway', a); halo('highway', b); focusAll(); }, reveal: () => { clearHalos(); halo('node', target.id); return Promise.resolve(); } };
  },
  tapSpecial(vis) {
    const ok = [...vis].filter(id => HW.get(id).orientation === 'MIXED');
    if (!ok.length) return null;
    return { sig: 'tapspecial', kind: 'tap', tap: 'highway', ok: id => HW.get(id).orientation === 'MIXED', fa: 'کدام بزرگراه <b>وسط راه جهتش را عوض می‌کند</b>؟ روی نقشه نشان بده.', hint: 'روی یک خط بزن (هر کدام از دو تا درست است)',
      why: `${ok.map(id => HW.get(id).name_fa).join(' و ')} بخشی افقی‌اند و بخشی عمودی.`, line: `highways.orientation = 'MIXED' → ${ok.join(', ')}`,
      dev: [{ sql: q(['id', 'name_en', 'orientation'], 'highways', "orientation = 'MIXED'"), cols: ['id', 'name_en', 'orientation'], rows: ok.map(id => HW.get(id)) }],
      setup: () => { clearHalos(); clearCar(); focusAll(); }, reveal: () => { clearHalos(); ok.forEach(id => halo('highway', id)); return Promise.resolve(); } };
  },
  isolated(vis) {
    const touches = id => new Set(nodesOfHw(id).flatMap(nid => hwsAtNode(nid)).filter(o => o !== id && vis.has(o))).size;
    const iso = [...vis].filter(id => touches(id) === 0);
    if (iso.length !== 1) return null;
    const ans = iso[0], rest = shuffle([...vis].filter(o => o !== ans && group(HW.get(o)) !== 'X' || o === 'chamran')).filter(o => o !== ans).slice(0, 2);
    return { sig: 'isolated', kind: 'neighbor', fa: 'کدام بزرگراه در داده‌ی ما به <b>هیچ بزرگراه دیگری</b> وصل نیست؟', ...mkChoices([ans, ...rest].map(id => ({ key: id, fa: HW.get(id).name_fa, en: HW.get(id).name_en })), ans),
      why: `${HW.get(ans).name_fa} با هیچ خط دیگری تقاطع ندارد (این را داده‌ی OpenStreetMap می‌گوید).`, line: `touches['${ans}'] = 0`,
      dev: [{ sql: `SELECT s.highway_id, COUNT(DISTINCT o.highway_id) AS touches\nFROM segments s\nLEFT JOIN segments o\n  ON o.highway_id <> s.highway_id\n AND (o.from_node IN (s.from_node, s.to_node) OR o.to_node IN (s.from_node, s.to_node))\nGROUP BY s.highway_id;`, cols: ['highway_id', 'touches'], rows: [...vis].map(id => ({ highway_id: id, touches: touches(id) })) }],
      setup: () => { clearHalos(); clearCar(); focusAll(); }, reveal: () => { halo('highway', ans); return Promise.resolve(); } };
  }
};

const PLAN = {
  0: ['mountain', 'dirword', 'landNS', 'landWE', 'dirword', 'landNS'],
  1: ['orient', 'orient', 'orient', 'rel', 'rel', 'dir', 'dir', 'neighbor'],
  2: ['orient', 'rel', 'dir', 'neighbor', 'neighbor', 'tapNode', 'tapNode', 'tapNode'],
  3: ['orient', 'orient', 'tapSpecial', 'isolated', 'neighbor', 'tapNode', 'dir', 'rel']
};
function buildQuiz(n) {
  const vis = hwUpTo(n), seen = new Set(), out = [];
  for (const kind of PLAN[n]) {
    for (let t = 0; t < 30; t++) {
      const q = GEN[kind](vis, n);
      if (!q) continue;
      if (seen.has(q.sig)) continue;
      seen.add(q.sig); q.id = `${n}-${out.length}`; out.push(q); break;
    }
  }
  return out;
}

// ---------- flow ----------
function applyStepView(s) {
  clearHalos(); clearCar(); document.querySelectorAll('.pulse').forEach(e => e.classList.remove('pulse'));
  setVisible({ hw: new Set(s.vis), landmarks: s.landmarks !== false, nodes: 'meet' });
  (s.halo || []).forEach(([t, id]) => halo(t, id));
  (s.pulse || []).forEach(sel => pulse(document.querySelector(sel), true));
  if (s.focus) focusOn(s.focus, 220); else focusAll();
  if (s.car) driveCar(s.car);
}
function startLevel(n) {
  if (!unlocked(n)) return;
  state.mode = 'learn'; setReal(false); leaveExplore();
  Object.assign(L, { n, phase: 'intro', steps: introSteps(n), si: 0, queue: [], qi: 0, first: new Map(), total: 0, q: null, answered: false, token: L.token + 1 });
  store.set('lastLevel', n);
  document.dispatchEvent(new CustomEvent('levelchange'));
  showIntro();
}
function showIntro() {
  const s = L.steps[L.si], last = L.si === L.steps.length - 1;
  applyStepView(s);
  card({ kicker: kickerOf(L.n, `${toFa(L.si + 1)} از ${toFa(L.steps.length)}`),
    bar: `<i style="width:${Math.round((L.si + 1) / (L.steps.length + 1) * 100)}%"></i>`, title: s.title, en: s.en, body: s.body,
    foot: `${s.dev ? devDetails(DEV_TITLE, devBlock(s.dev)) : ''}<div class="nextrow">${L.si ? '<button class="btn ghost" data-prev>◂ قبلی</button>' : '<span></span>'}<button class="btn" data-next>${last ? 'شروع سؤال‌ها ▸' : 'بعدی ▸'}</button></div>` });
  syncDev();
  document.querySelectorAll('[data-lm]').forEach(b => b.addEventListener('click', () => { clearHalos(); halo('landmark', b.dataset.lm); }));
}
function startQuiz() {
  L.phase = 'quiz'; L.queue = buildQuiz(L.n); L.total = L.queue.length; L.qi = 0; L.first = new Map();
  showQuestion();
}
function showQuestion() {
  const q = L.q = L.queue[L.qi]; L.answered = false; const token = ++L.token;
  clearHalos(); clearCar(); document.querySelectorAll('.pulse').forEach(e => e.classList.remove('pulse'));
  setVisible({ hw: hwUpTo(L.n), landmarks: true, nodes: 'meet' });
  q.setup();
  const dots = Array.from({ length: L.total }, (_, i) => { const r = L.first.get(L.queue.find(x => x.id === `${L.n}-${i}`)?.id); return `<span class="dot-p ${r === true ? 'ok' : r === false ? 'bad' : ''}"></span>`; }).join('');
  const choices = q.choices ? `<div class="choices">${(q.shown = shuffle(q.choices)).map(c => `<button class="choice" data-key="${esc(c.key)}"><span>${c.fa}</span>${c.en ? `<small dir="ltr">${esc(c.en)}</small>` : ''}</button>`).join('')}</div>` : '';
  card({ kicker: kickerOf(L.n, `سؤال ${toFa(Math.min(L.qi + 1, L.total))} از ${toFa(L.total)}`), bar: `<div class="dots">${dots}</div>`, title: q.fa, en: q.en || '', choices, hint: q.hint || '' });
  void token;
}
function reveal(ok, picked) {
  const q = L.q; L.answered = true;
  if (!L.first.has(q.id)) L.first.set(q.id, ok);
  if (!ok && !q.retried) { q.retried = true; const at = Math.min(L.qi + 4, L.queue.length); L.queue.splice(at, 0, q); }
  document.querySelectorAll('.choice').forEach(b => {
    b.disabled = true;
    if (q.choices && b.dataset.key === String(q.correct)) b.classList.add('right');
    else if (b.dataset.key === picked) b.classList.add('wrong');
  });
  const tip = document.querySelector('.tiphint'); if (tip) tip.remove();
  const last = L.qi >= L.queue.length - 1;
  document.getElementById('fb').innerHTML = `<div class="fbbox ${ok ? 'ok' : 'bad'}"><b>${ok ? 'آفرین! ✓' : 'نه، این‌طور نیست ✗'}</b> ${q.why}${!ok && q.retried ? '<br><small>این سؤال کمی بعدتر دوباره می‌آید.</small>' : ''}</div>`;
  document.getElementById('slot').innerHTML = `${rowLine(q.line)}${devDetails(DEV_TITLE, devBlock(q.dev))}<div class="nextrow"><span></span><button class="btn" data-next>${last ? 'نتیجه ▸' : 'ادامه ▸'}</button></div>`;
  syncDev();
  if (q.focusAfter) focusOn(q.focusAfter, 200);
  q.reveal();
  const b = document.querySelector('[data-next]'); if (b) b.focus({ preventScroll: true });
}
function answerChoice(key) { if (L.answered || !L.q || !L.q.choices) return; reveal(String(key) === String(L.q.correct), String(key)); }
function lessonClick(e) {
  if (dragged || state.real || L.phase !== 'quiz' || L.answered || !L.q || L.q.kind !== 'tap') return;
  const t = e.target.closest('[data-node],[data-highway]'); if (!t) return;
  if (L.q.tap === 'node' && t.dataset.node && ND.get(t.dataset.node).type === 'interchange') reveal(L.q.ok(t.dataset.node), t.dataset.node);
  else if (L.q.tap === 'highway' && t.dataset.highway) reveal(L.q.ok(t.dataset.highway), t.dataset.highway);
  else if (L.q.tap === 'node') document.getElementById('fb').innerHTML = '<div class="fbbox hint">برای این سؤال باید روی یک <b>دایره‌ی سفید</b> (تقاطع) بزنی.</div>';
}
function finishLevel() {
  L.phase = 'done'; clearHalos(); clearCar(); focusAll();
  const ids = [...L.first.keys()], right = ids.filter(id => L.first.get(id)).length, ratio = right / Math.max(1, ids.length), pass = ratio >= PASS;
  if (pass) { const p = progress(); p.passed[L.n] = true; store.set('progress', p); }
  document.dispatchEvent(new CustomEvent('levelchange'));
  const next = L.n + 1 < LEVELS.length;
  card({ kicker: kickerOf(L.n, 'نتیجه'), bar: '<i style="width:100%"></i>',
    title: pass ? 'عالی بود! 🎉' : 'کمی دیگر تمرین کنیم', body: `<p class="score"><b>${toFa(right)}</b> از ${toFa(ids.length)} سؤال را بار اول درست زدی.</p>
      <p>${pass ? (next ? `درس بعدی باز شد: <b>${LEVELS[L.n + 1].fa}</b>.` : 'همه‌ی درس‌های این نسخه را تمام کردی. درس ۴ (مسیریابی) هنوز ساخته نشده.') : 'برای باز شدن درس بعد حدود ۸۰٪ لازم است. دوباره امتحان کن؛ سؤال‌ها هر بار فرق می‌کنند.'}</p>`,
    foot: `<div class="nextrow"><button class="btn ghost" data-again>دوباره</button>${pass && next ? '<button class="btn" data-nextlevel>درس بعدی ▸</button>' : '<button class="btn" data-explore>کاوش آزاد ▸</button>'}</div>` });
}
function panelClickLearn(e) {
  const t = e.target;
  if (t.closest('[data-quit]')) { document.dispatchEvent(new CustomEvent('quit')); return; }
  if (t.closest('[data-prev]')) { L.si = Math.max(0, L.si - 1); showIntro(); return; }
  if (t.closest('[data-next]')) {
    if (L.phase === 'intro') { if (L.si < L.steps.length - 1) { L.si++; showIntro(); } else startQuiz(); }
    else if (L.phase === 'quiz') { if (L.qi >= L.queue.length - 1) finishLevel(); else { L.qi++; showQuestion(); } }
    return;
  }
  const c = t.closest('.choice'); if (c) return answerChoice(c.dataset.key);
  if (t.closest('[data-again]')) return startLevel(L.n);
  if (t.closest('[data-nextlevel]')) return startLevel(L.n + 1);
  if (t.closest('[data-explore]')) document.dispatchEvent(new CustomEvent('quit'));
}
