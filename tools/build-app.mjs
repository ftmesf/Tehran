// Builds index.html as ONE self-contained file: the SVG map, the data tables, CSS and JS are all inlined,
// so it opens by double-click, from GitHub Pages, or from any static host. Run: npm run build:app
//
// The learner never sees coordinates, so lat/lon and the OSM evidence are removed here. The "real shape" view needs the real
// carriageway geometry, so it is projected into the map's own drawing units (x, y on the 1600x1400 canvas, north up) and simplified here;
// only those drawing units reach the page.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = f => readFileSync(new URL(f, root), 'utf8');
const rows = f => JSON.parse(read(`data/${f}.json`)).rows;
const strip = ({ lat, lon, osm, ...rest }) => rest;

const nodesRaw = rows('nodes');
const geo = JSON.parse(read('data/osm/highways.geojson'));

// ---------- real-shape projection (same local flat frame as tools/analyze_osm.py) ----------
const LAT0 = 35.70, LON0 = 51.40, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KY = 110574;
const km = ([lon, lat]) => [(lon - LON0) * KX / 1000, (lat - LAT0) * KY / 1000];
const all = [...geo.features.flatMap(f => f.geometry.coordinates), ...nodesRaw.filter(n => n.lat != null).map(n => [n.lon, n.lat])].map(km);
const minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0]));
const minY = Math.min(...all.map(p => p[1])), maxY = Math.max(...all.map(p => p[1]));
// Fit inside the area under the mountains, same scale on both axes (a real shape, not a stretched one).
const AREA = { x0: 150, x1: 1450, y0: 300, y1: 1215 };
const S = Math.min((AREA.x1 - AREA.x0) / (maxX - minX), (AREA.y1 - AREA.y0) / (maxY - minY));
const ox = (AREA.x0 + AREA.x1) / 2 - S * (minX + maxX) / 2, oy = (AREA.y0 + AREA.y1) / 2 + S * (minY + maxY) / 2;
const proj = c => { const [x, y] = km(c); return [Math.round(ox + S * x), Math.round(oy - S * y)]; };

// Ramer-Douglas-Peucker in drawing units (1.2 px of the 1600-wide canvas)
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  let dmax = 0, imax = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / len;
    if (d > dmax) { dmax = d; imax = i; }
  }
  if (dmax <= eps) return [a, b];
  return [...rdp(pts.slice(0, imax + 1), eps).slice(0, -1), ...rdp(pts.slice(imax), eps)];
}
const realLines = {};
for (const f of geo.features) {
  const pts = rdp(f.geometry.coordinates.map(proj), 1.2);
  if (pts.length < 2) continue;
  (realLines[f.properties.highway] ||= []).push(pts.flat());
}
const realNodes = Object.fromEntries(nodesRaw.filter(n => n.lat != null).map(n => [n.id, proj([n.lon, n.lat])]));

const data = {
  highways: rows('highways').map(strip),
  nodes: nodesRaw.map(strip),
  segments: rows('segments').map(strip),
  landmarks: rows('landmarks').map(strip),
  // `used_for` notes quote coordinates and the app never shows them, so they stay out of the page
  sources: JSON.parse(read('data/sources.json')).sources.map(({ id, title, url, license }) => ({ id, title, url, license })),
  real: { lines: realLines, nodes: realNodes }
};

// The SVG keeps its own size attributes for the PNG export; the app sizes it from CSS.
const svg = read('map/schematic.svg').replace(' width="1600" height="1400"', '');
if (/^<svg[^>]* width="1600"/.test(svg)) throw new Error('could not strip the fixed SVG size');

const json = JSON.stringify(data).replace(/</g, '\\u003c');
// One scope for all the app scripts, in dependency order.
const js = ['core', 'real', 'explore', 'lessons', 'main'].map(f => read(`app/${f}.js`)).join('\n');
const code = `(() => {\n'use strict';\n${js}\n})();`.replace(/<\/script/gi, '<\\/script');

// split/join instead of String.replace so "$&" inside the inlined code is never treated as a replacement pattern.
const html = read('app/index.template.html')
  .split('/*CSS*/').join(read('app/app.css'))
  .split('<!--SVG-->').join(svg)
  .split('/*DATA*/').join(json)
  .split('/*JS*/').join(code);

writeFileSync(new URL('index.html', root), html);
console.log(`✓ index.html (${(html.length / 1024).toFixed(0)} KB, self-contained; real-shape geometry ${Object.values(realLines).flat().length} lines)`);
