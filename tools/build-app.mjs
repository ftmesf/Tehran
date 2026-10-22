// Builds index.html (explore mode) as ONE self-contained file: the SVG map, the data tables, CSS and JS are all inlined,
// so it opens by double-click, from GitHub Pages, or from any static host. Run: npm run build:app
// lat/lon and the OSM evidence are removed here on purpose: the learner never sees coordinates.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = f => readFileSync(new URL(f, root), 'utf8');
const rows = f => JSON.parse(read(`data/${f}.json`)).rows;
const strip = ({ lat, lon, osm, ...rest }) => rest;

const data = {
  highways: rows('highways').map(strip),
  nodes: rows('nodes').map(strip),
  segments: rows('segments').map(strip),
  landmarks: rows('landmarks').map(strip),
  sources: JSON.parse(read('data/sources.json')).sources
};

// The SVG keeps its own size attributes for the PNG export; the app sizes it from JS.
const svg = read('map/schematic.svg').replace(' width="1600" height="1400"', '');
if (/^<svg[^>]* width="1600"/.test(svg)) throw new Error('could not strip the fixed SVG size');

const json = JSON.stringify(data).replace(/</g, '\\u003c');
// split/join instead of String.replace so "$&" inside the inlined code is never treated as a replacement pattern.
const html = read('app/index.template.html')
  .split('/*CSS*/').join(read('app/app.css'))
  .split('<!--SVG-->').join(svg)
  .split('/*DATA*/').join(json)
  .split('/*JS*/').join(read('app/app.js').replace(/<\/script/gi, '<\\/script'));

writeFileSync(new URL('index.html', root), html);
console.log(`✓ index.html (${(html.length / 1024).toFixed(0)} KB, self-contained)`);
