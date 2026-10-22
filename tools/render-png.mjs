// Renders the squint-test PNGs from map/schematic.svg with headless Chromium. Run: npm run render
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// Use the project's playwright if installed, else the global one.
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(`${execSync('npm root -g').toString().trim()}/playwright`)); }

const svg = readFileSync(new URL('../map/schematic.svg', import.meta.url), 'utf8');
const [, W, H] = svg.match(/viewBox="0 0 (\d+) (\d+)"/).map(Number);
const out = f => new URL(`../map/${f}`, import.meta.url).pathname;

const browser = await chromium.launch();
async function shot(file, scale, colorScheme) {
  const page = await browser.newPage({ viewport: { width: Math.round(W * scale), height: Math.round(H * scale) }, colorScheme });
  await page.setContent(`<html><body style="margin:0">${svg.replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"')}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out(file) });
  await page.close();
  console.log(`✓ map/${file} (${Math.round(W * scale)}×${Math.round(H * scale)}, ${colorScheme})`);
}
await shot('schematic-full.png', 1, 'light');
await shot('schematic-25pct.png', 0.25, 'light');
await shot('schematic-full-dark.png', 1, 'dark');
await browser.close();
