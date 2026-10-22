// Browser test for the app (headless Chromium). Run: npm run test:app  (optionally: node tools/test-app.mjs <screenshot-dir>)
//  1. Quiz answers are checked against the REAL OpenStreetMap coordinates in data/nodes.json, not against the schematic they were built from.
//  2. The learner flow: locks, scoring, re-asking wrong answers, unlocking, tap questions, real-shape view, explore mode.
//  3. Phone layout, no coordinates in the page, no console errors.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(`${execSync('npm root -g').toString().trim()}/playwright`)); }

const root = new URL('../', import.meta.url);
const table = f => JSON.parse(readFileSync(new URL(`data/${f}.json`, root), 'utf8')).rows;
const nodes = new Map(table('nodes').map(n => [n.id, n])), highways = new Map(table('highways').map(h => [h.id, h])), segs = table('segments'), lms = new Map(table('landmarks').map(l => [l.id, l]));
const url = new URL('index.html', root).href;
const shots = process.argv[2]; if (shots) mkdirSync(shots, { recursive: true });
const errors = [], fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`${ok ? '✓' : '✗'} ${msg}`); };

const browser = await chromium.launch();
async function open(opts) {
  const page = await browser.newPage(opts);
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  return page;
}
const shot = (page, name) => shots && page.screenshot({ path: `${shots}/${name}.png` });

// ============ 1. quiz answers against real coordinates ============
const page = await open({ viewport: { width: 1360, height: 820 }, colorScheme: 'light' });
const qs = await page.evaluate(() => {
  const T = window.__tehran, out = [];
  for (let n = 0; n <= 3; n++) for (let i = 0; i < 60; i++) for (const q of T.buildQuiz(n))
    out.push({ n, k: q.facts?.k, facts: q.facts, kind: q.kind, ok: q.choices ? q.choices.some(c => String(c.key) === String(q.correct)) && new Set(q.choices.map(c => c.key)).size === q.choices.length : true, nChoices: q.choices?.length });
  return out;
});
check(qs.length > 1500 && qs.every(q => q.ok), `${qs.length} generated questions: every multiple-choice question contains its right answer exactly once`);
const kinds = [...new Set(qs.map(q => q.k).filter(Boolean))];
check(['landNS', 'landWE', 'rel', 'dir', 'nb', 'tapNode'].every(k => kinds.includes(k)), `question kinds covered: ${kinds.join(', ')}`);

const real = id => nodes.get(id), TOL = 0.002;
const meanOf = (hw, key) => { const v = nodesOf(hw).map(n => real(n)[key]).filter(x => x != null); return v.reduce((a, b) => a + b, 0) / v.length; };
const routeNodes = new Map();
function nodesOf(hw) {
  if (!routeNodes.has(hw)) { const s = segs.filter(x => x.highway_id === hw).sort((a, b) => a.order_on_highway - b.order_on_highway); routeNodes.set(hw, [s[0].from_node, ...s.map(x => x.to_node)]); }
  return routeNodes.get(hw);
}
const hwsAt = id => [...new Set(segs.filter(s => s.from_node === id || s.to_node === id).map(s => s.highway_id))];
const bad = [];
for (const q of qs) {
  const f = q.facts; if (!f) continue;
  if (f.k === 'landNS') { const a = real(lms.get(f.win).node_id).lat, b = real(lms.get(f.lose).node_id).lat; if ((a > b) !== f.north) bad.push(['landNS', f]); }
  if (f.k === 'landWE') { const a = real(lms.get(f.win).node_id).lon, b = real(lms.get(f.lose).node_id).lon; if ((a < b) !== f.west) bad.push(['landWE', f]); }
  if (f.k === 'rel') {
    const key = f.ax === 'x' ? 'lon' : 'lat', w = meanOf(f.win, key), l = meanOf(f.lose, key);
    // x small = west = small longitude; y small = north = LARGE latitude
    const winnerIsLower = f.ax === 'x' ? w < l : w > l;
    if (winnerIsLower !== f.low) bad.push(['rel', f, w, l]);
  }
  if (f.k === 'dir') {
    const s = segs.find(x => x.id === f.seg), a = real(s.from_node), b = real(s.to_node), dlat = b.lat - a.lat, dlon = b.lon - a.lon;
    if ((f.dir === 'N' && dlat < -TOL) || (f.dir === 'S' && dlat > TOL) || (f.dir === 'E' && dlon < -TOL) || (f.dir === 'W' && dlon > TOL)) bad.push(['dir', f, dlat, dlon]);
  }
  if (f.k === 'nb') {
    const a = real(f.from), b = real(f.to), dlat = b.lat - a.lat, dlon = b.lon - a.lon;
    if ((f.dir === 'N' && dlat < -TOL) || (f.dir === 'S' && dlat > TOL) || (f.dir === 'E' && dlon < -TOL) || (f.dir === 'W' && dlon > TOL)) bad.push(['nb-direction', f, dlat, dlon]);
    if (!hwsAt(f.to).includes(f.ans) || !hwsAt(f.from).includes(f.start) || !hwsAt(f.to).includes(f.hw)) bad.push(['nb-nodes', f]);
    // nothing visible sits between the two crossings along the line
    const route = nodesOf(f.hw), i = route.indexOf(f.from), j = route.indexOf(f.to), vis = new Set([...highways.values()].filter(h => h.level <= q.n).map(h => h.id));
    for (const n of route.slice(Math.min(i, j) + 1, Math.max(i, j))) if (hwsAt(n).some(h => h !== f.hw && vis.has(h))) bad.push(['nb-between', f, n]);
  }
  if (f.k === 'tapNode') {
    const vis = new Set([...highways.values()].filter(h => h.level <= q.n).map(h => h.id));
    const hit = [...nodes.values()].filter(n => n.type === 'interchange' && hwsAt(n.id).includes(f.a) && hwsAt(n.id).includes(f.b));
    if (hit.length !== 1 || !vis.has(f.a) || !vis.has(f.b)) bad.push(['tapNode', f, hit.length]);
  }
}
check(bad.length === 0, `every answer agrees with the real OSM coordinates${bad.length ? ' — WRONG: ' + JSON.stringify(bad.slice(0, 3)) : ''}`);
await page.close();

// ============ 2. the learner flow (fresh storage) ============
const p = await open({ viewport: { width: 1360, height: 820 }, colorScheme: 'light' });
await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.evaluate(() => document.fonts.ready);
check((await p.locator('.card .qt').innerText()).includes('کوه'), 'first screen is Level 0: "the mountains are at the top"');
check(await p.locator('#levels .lv:disabled').count() >= 4, 'levels 1-3 (and routing) are locked at the start');
check(await p.locator('.top').innerText().then(t => t.includes('قطب‌نما') && t.includes('شبکه') && t.includes('تقاطع') && t.includes('استثنا')), 'level tabs are shown');
check(await p.locator('svg [data-highway]:not(.off)').count() === 0, 'Level 0 shows no highways at all (only mountains, compass, landmarks)');
check(await p.locator('svg .landmark:not(.off)').count() === 0, 'Level 0, card 1: only the mountains and the compass (landmarks come later)');
check(await p.locator('details.dev[open]').count() === 0, 'Developer view is collapsed by default');
await shot(p, '1-level0-intro');

// run the intro; Level 0 -> quiz
const introCount = await p.evaluate(() => window.__tehran.L.steps.length);
for (let i = 0; i < introCount - 1; i++) { await p.click('[data-next]'); }
check(await p.locator('svg .landmark:not(.off)').count() === 4, 'Level 0, last card: the 4 landmarks are shown');
await p.click('[data-next]');
check(await p.locator('.choice').count() >= 2, 'quiz starts after the teaching cards');
// wrong answer first -> it must come back later and the level must not be passed with many mistakes
const before = await p.evaluate(() => window.__tehran.L.queue.length);
await p.evaluate(() => { const q = window.__tehran.L.q; const wrong = q.choices.find(c => String(c.key) !== String(q.correct)); document.querySelector(`.choice[data-key="${wrong.key}"]`).click(); });
check(await p.locator('.fbbox.bad').count() === 1 && await p.locator('.choice.right').count() === 1, 'a wrong answer shows feedback and marks the right choice');
check(await p.evaluate(() => window.__tehran.L.queue.length) === before + 1, 'the wrong question is queued to come back later');
check(await p.locator('.rowline').count() === 1 || await p.locator('details.dev').count() === 1, 'the related table row is offered after answering');
await shot(p, '2-wrong-answer');
await p.click('[data-next]');
// fail on purpose: answer everything wrong
for (let guard = 0; guard < 20 && !(await p.locator('[data-again]').count()); guard++) {
  if (await p.locator('.choice:not(:disabled)').count()) await p.evaluate(() => { const q = window.__tehran.L.q; const wrong = q.choices.find(c => String(c.key) !== String(q.correct)); document.querySelector(`.choice[data-key="${wrong.key}"]`).click(); });
  await p.click('[data-next]');
}
check(await p.locator('[data-again]').count() === 1, 'finishing a level shows a result card');
check(await p.locator('[data-nextlevel]').count() === 0 && await p.locator('#levels [data-lv="1"]').isDisabled(), 'failing Level 0 does NOT unlock Level 1');
await shot(p, '3-fail');
// pass: answer everything right
await p.click('[data-again]');
for (let i = 0; i < await p.evaluate(() => window.__tehran.L.steps.length); i++) await p.click('[data-next]');
for (let guard = 0; guard < 20 && !(await p.locator('[data-nextlevel]').count()); guard++) {
  if (await p.locator('.choice:not(:disabled)').count()) await p.evaluate(() => window.__tehran.answerRight());
  await p.click('[data-next]');
}
check(await p.locator('[data-nextlevel]').count() === 1, 'getting everything right passes Level 0');
check(await p.locator('#levels [data-lv="1"]').isEnabled(), '... and unlocks Level 1');
check(await p.evaluate(() => JSON.parse(localStorage.getItem('tehran.progress')).passed['0']) === true, 'progress is saved in localStorage');
await shot(p, '4-pass');

// Level 1: highways appear one by one; only Level-1 highways exist
await p.click('[data-nextlevel]');
const shown = async () => p.evaluate(() => [...new Set([...document.querySelectorAll('svg .core[data-highway]:not(.off)')].map(e => e.dataset.highway))]);
check((await shown()).length === 1, 'Level 1, card 1: exactly one highway is on the map');
await p.click('[data-next]'); check((await shown()).length === 2, 'Level 1, card 2: two highways (they appear one by one)');
for (let i = 0; i < 4; i++) await p.click('[data-next]');
check((await shown()).length === 6 && !(await shown()).includes('chamran'), 'Level 1 ends with exactly its six highways (no Level 2/3 highways)');
check(await p.locator('#realbtn').isHidden(), 'real-shape toggle is hidden before Level 2 (as in the brief)');
await shot(p, '5-level1-last-intro');

// reviewer shortcut opens the rest; Level 2 tap question with a REAL mouse click
await p.click('#openall');
await p.click('#levels [data-lv="2"]');
check(await p.locator('#realbtn').isVisible(), 'real-shape toggle appears at Level 2');
for (let i = 0; i < 3; i++) await p.click('[data-next]');
let tapped = false;
for (let guard = 0; guard < 12 && !tapped; guard++) {
  if (await p.evaluate(() => window.__tehran.L.q && window.__tehran.L.q.kind === 'tap')) {
    await p.waitForTimeout(900);
    const nodeId = await p.evaluate(() => { const q = window.__tehran.L.q; return [...document.querySelectorAll('.hit-node')].map(e => e.dataset.node).find(id => !document.querySelector(`.hit-node[data-node="${id}"]`).classList.contains('off') && q.ok(id)); });
    const box = await p.locator(`.hit-node[data-node="${nodeId}"]`).boundingBox();
    await shot(p, '6-tap-question');
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    tapped = true;
  } else { await p.evaluate(() => window.__tehran.answerRight()); await p.click('[data-next]'); }
}
check(tapped && await p.locator('.fbbox.ok').count() === 1, 'tap question: a real mouse click on the right interchange is accepted');
await shot(p, '7-tap-answered');

// real-shape view
await p.click('#realbtn'); await p.waitForTimeout(400);
check(await p.locator('svg.is-real').count() === 1 && await p.locator('#real-note').isVisible(), 'real-shape view switches on and explains itself');
check(await p.locator('#real .real-core').count() >= 10, 'real shapes are drawn');
await shot(p, '8-real-L2');
await p.click('#realbtn'); check(await p.locator('svg.is-real').count() === 0, 'and switches back to the schematic');

// Level 3 special questions exist and pass through
await p.click('#levels [data-lv="3"]');
check((await p.locator('.card .qt').innerText()).includes('استثنا'), 'Level 3 starts with the edge-case idea');

// explore mode + Developer view
await p.click('[data-explore]'); await p.waitForTimeout(500);
check(await p.locator('.hwbtn').count() === 15 && await p.locator('svg [data-highway]:not(.off)').count() > 30, 'explore mode shows all 15 highways');
const seg = p.locator('[data-segment="s_hemmat_1"]'), box = await seg.boundingBox();
await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
check(await p.locator('#panel h2').innerText() === 'همت', 'explore: clicking a highway opens its panel');
check(await p.locator('details.dev[open]').count() === 0 && await p.locator('details.dev').count() >= 1, 'explore: SQL and tables are tucked into a collapsed Developer view');
await p.click('#devbtn');
check(await p.locator('details.dev[open]').count() >= 1 && await p.locator('#panel pre.sql').first().isVisible(), '{ } switch opens the Developer view (SQL + rows)');
await shot(p, '9-explore-dev');
await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
check((await p.locator('#panel h2').innerText()).includes('قطعه'), 'explore: second click on the same highway opens the segment');
await p.click('#devbtn');

// every explore panel renders, and no coordinates anywhere in the page
const ids = await p.evaluate(() => ({ highway: [...document.querySelectorAll('.hw-label:not(.real-label)')].map(e => e.dataset.highway), segment: [...document.querySelectorAll('[data-segment]')].map(e => e.dataset.segment), landmark: [...document.querySelectorAll('.landmark')].map(e => e.dataset.landmark) }));
let panels = 0;
for (const [type, list] of Object.entries(ids)) for (const id of list) {
  await p.evaluate(([t, i]) => { location.hash = `#${t}=${i}`; }, [type, id]);
  const html = await p.locator('#panel').innerHTML(); panels++;
  if (!html.includes('<h2>') || !html.includes('class="sql"')) fails.push(`explore panel for ${type}:${id} looks empty`);
}
check(panels >= 15 + 52 + 4, `${panels} explore panels render`);
const leak = await p.evaluate(() => { const h = document.documentElement.outerHTML; return /"lat"|"lon"|\b35\.[0-9]{3}|\b51\.[0-9]{3}/.test(h); });
check(!leak, 'no latitude/longitude anywhere in the page (data, DOM or code)');
await p.evaluate(() => { location.hash = '#node=does_not_exist'; });
check(await p.locator('.hwbtn').count() === 15, 'unknown id in the url falls back to explore home');
await p.click('#theme'); check(await p.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'theme button switches to dark');
await p.evaluate(() => { location.hash = '#highway=chamran'; }); await p.waitForTimeout(600);
await shot(p, '10-dark-explore');
await p.close();

// ============ 3. phone ============
const phone = await open({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' });
check(await phone.evaluate(() => innerWidth) === 390 && !(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'phone: no horizontal page scroll (layout width stays 390)');
check((await phone.locator('header.top').boundingBox()).height < 100, 'phone: header is compact');
await shot(phone, '11-phone-intro');
for (let i = 0; i < await phone.evaluate(() => window.__tehran.L.steps.length); i++) await phone.click('[data-next]');
await phone.waitForTimeout(700);
const choiceH = await phone.locator('.choice').first().boundingBox();
check(choiceH.height >= 48, `phone: answer buttons are thumb-sized (${Math.round(choiceH.height)}px)`);
const pb = await phone.locator('#panel').boundingBox();
check(pb.y > 250 && pb.y + pb.height <= 781, 'phone: lesson card sits below the map, inside the screen');
await shot(phone, '12-phone-question');
await phone.evaluate(() => window.__tehran.answerRight()); await phone.waitForTimeout(1700);
await shot(phone, '13-phone-answered');
// tapping a thumb-sized target on the phone map (tap question)
await phone.click('#openall'); await phone.click('#levels [data-lv="2"]');
await phone.close();

await browser.close();
check(errors.length === 0, `no console/page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
if (fails.length) { console.error('\nFAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nAll checks passed.');
