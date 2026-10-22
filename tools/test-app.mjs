// Smoke test for explore mode with headless Chromium. Run: npm run test:app  (optionally: node tools/test-app.mjs <screenshot-dir>)
// Checks: no console errors, every clickable thing opens a panel with a SQL block, no coordinates leak, north rule is visible,
// filter/theme/zoom work, and a real mouse click on the map selects a highway.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(`${execSync('npm root -g').toString().trim()}/playwright`)); }

const url = new URL('../index.html', import.meta.url).href;
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

// ---------- desktop ----------
const page = await open({ viewport: { width: 1360, height: 820 }, colorScheme: 'light' });
check(await page.locator('#panel .northrule').count() === 1, 'home: north rule is shown');
check((await page.locator('#panel tr[data-go]').count()) === 15, 'home: highways table lists 15 rows');
await shot(page, '1-home');

// real mouse click on a straight horizontal piece of Hemmat
const seg = page.locator('[data-segment="s_hemmat_1"]');
const box = await seg.boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
check(await page.locator('#panel h2').innerText() === 'همت', 'mouse click on the map opens the Hemmat panel');
check((await page.locator('#panel pre.sql').count()) >= 3, 'highway panel has SQL blocks');
check(await page.locator('#panel .tw table').count() >= 3, 'highway panel has table results');
check(page.url().endsWith('#highway=hemmat'), 'url hash is deep-linkable');
await shot(page, '2-highway-hemmat');
// second click on the same highway -> segment
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
check((await page.locator('#panel h2').innerText()).includes('قطعه'), 'second click on the same highway opens the segment');
await shot(page, '3-segment');

// every selectable thing renders a panel without errors and without coordinates
const ids = await page.evaluate(() => ({
  highway: [...document.querySelectorAll('.hw-label')].map(e => e.dataset.highway),
  node: [...document.querySelectorAll('.node[data-node]')].map(e => e.dataset.node),
  segment: [...document.querySelectorAll('[data-segment]')].map(e => e.dataset.segment),
  landmark: [...document.querySelectorAll('.landmark')].map(e => e.dataset.landmark)
}));
let panels = 0, leaks = 0;
for (const [type, list] of Object.entries(ids)) for (const id of list) {
  await page.evaluate(([t, i]) => { location.hash = `#${t}=${i}`; }, [type, id]);
  const html = await page.locator('#panel').innerHTML();
  panels++;
  if (!html.includes('class="sql"') || !html.includes('<h2>')) fails.push(`panel for ${type}:${id} looks empty`);
  if (/\b(lat|lon)\b\s*[:=]\s*\d|\b3[5-6]\.\d{3,}|\b5[01]\.\d{3,}/.test(html.replace(/--[^<\n]*/g, ''))) leaks++;
}
check(panels === 15 + ids.node.length + ids.segment.length + 4, `${panels} panels render (15 highways, ${ids.node.length} nodes, ${ids.segment.length} segments, 4 landmarks)`);
check(leaks === 0, 'no latitude/longitude numbers in any panel');
check((await page.locator('svg [data-node]').count()) > 0, 'nodes are clickable');

await page.evaluate(() => { location.hash = '#node=does_not_exist'; });
check(await page.locator('#panel .northrule + p.plain').count() === 1, 'unknown id in the url falls back to the home panel');

// unverified things are labelled
await page.evaluate(() => { location.hash = '#landmark=tajrish'; });
check(await page.locator('#panel .warnbox').count() === 1 && (await page.locator('#panel .badge.warn').count()) >= 1, 'unverified landmark (Tajrish) is clearly labelled');
await shot(page, '4-landmark-unverified');
await page.evaluate(() => { location.hash = '#node=n_hem_kord'; });
check((await page.locator('#panel .join').innerText()).includes('⋈'), 'interchange shows the JOIN (A ⋈ B)');
await shot(page, '5-node');

// filter, escape, zoom
await page.keyboard.press('Escape');
check(await page.locator('#panel .northrule + p.plain').count() === 1, 'Esc returns to the home panel');
await page.click('[data-f="EW"]');
const ghosts = await page.evaluate(() => document.querySelectorAll('.core.ghost').length);
check(ghosts === 8, `filter "horizontal" greys out the 8 non-horizontal highways (got ${ghosts})`);
await shot(page, '6-filter-horizontal');
await page.click('[data-f="all"]');
const w1 = await page.evaluate(() => document.querySelector('#map-scroll svg').getBoundingClientRect().width);
await page.click('#zin');
const w2 = await page.evaluate(() => document.querySelector('#map-scroll svg').getBoundingClientRect().width);
check(w2 > w1 * 1.4, 'zoom in makes the map bigger');
await page.click('#zout');

// dark mode
await page.click('#theme');
check(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'theme button switches to dark');
await page.evaluate(() => { location.hash = '#highway=chamran'; });
await shot(page, '7-dark-chamran');
await page.close();

// ---------- phone ----------
const phone = await open({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' });
const overflow = await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
check(!overflow, 'phone: no horizontal page scroll');
await shot(phone, '8-phone-home');
await phone.evaluate(() => { location.hash = '#node=n_hem_kord'; });
check((await phone.locator('#panel h2').innerText()).includes('همت'), 'phone: a node opens its panel');
await shot(phone, '9-phone-node');
const panelBox = await phone.locator('#panel').boundingBox();
const headerH = (await phone.locator('header.top').boundingBox()).height;
check(headerH < 100, `phone: header is compact (${Math.round(headerH)}px)`);
check(panelBox.y > 300 && panelBox.y + panelBox.height <= 781, 'phone: panel sits below the map and inside the screen');
await phone.close();

await browser.close();
check(errors.length === 0, `no console/page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
if (fails.length) { console.error('\nFAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nAll explore-mode checks passed.');
