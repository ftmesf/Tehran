// Integrity checks for the data tables. Run: npm run validate
import { readFileSync } from 'node:fs';

const load = f => JSON.parse(readFileSync(new URL(`../data/${f}.json`, import.meta.url)));
const highways = load('highways').rows;
const nodes = load('nodes').rows;
const segments = load('segments').rows;
const landmarks = load('landmarks').rows;
const sources = load('sources').sources;

const errors = [];
const fail = msg => errors.push(msg);
const nodeById = new Map(nodes.map(n => [n.id, n]));
const hwById = new Map(highways.map(h => [h.id, h]));
const sourceIds = new Set(sources.map(s => s.id));

const ORIENTATIONS = ['NS', 'EW', 'DIAGONAL', 'MIXED'];
// NS lines may lean (diagonal pieces) but never run flat; EW lines never run straight up/down. MIXED/DIAGONAL: anything.
const DIAG = ['NE', 'NW', 'SE', 'SW'];
const ALLOWED_DIRS = { NS: ['N', 'S', ...DIAG], EW: ['E', 'W', ...DIAG] };
const DIR_VECTORS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0], NE: [1, -1], NW: [-1, -1], SE: [1, 1], SW: [-1, 1] };

for (const row of [...highways, ...nodes, ...landmarks])
  for (const s of row.source || []) if (!sourceIds.has(s)) fail(`${row.id}: unknown source "${s}"`);

for (const h of highways) {
  if (!ORIENTATIONS.includes(h.orientation)) fail(`${h.id}: bad orientation ${h.orientation}`);
  if (typeof h.verified !== 'boolean') fail(`${h.id}: verified must be boolean`);
}

for (const s of segments) {
  const a = nodeById.get(s.from_node), b = nodeById.get(s.to_node), h = hwById.get(s.highway_id);
  if (!a || !b || !h) { fail(`${s.id}: dangling reference`); continue; }
  const dx = b.x - a.x, dy = b.y - a.y;
  // Schematic rule: only 0/45/90 degree lines.
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) fail(`${s.id}: not a 0/45/90 degree line (dx=${dx}, dy=${dy})`);
  const [ex, ey] = DIR_VECTORS[s.direction] || [NaN, NaN];
  if (Math.sign(dx) !== ex || Math.sign(dy) !== ey) fail(`${s.id}: direction ${s.direction} does not match positions`);
  const allowed = ALLOWED_DIRS[h.orientation];
  if (allowed && !allowed.includes(s.direction)) fail(`${s.id}: ${s.direction} segment on ${h.orientation} highway ${h.id}`);

  // The drawing must never run against the real coordinates (north = up, east = right). ~220 m tolerance.
  // Only axes that actually move on the schematic are tested: a straight vertical line may drift sideways in reality.
  if (a.lat != null && b.lat != null) {
    const tol = 0.002, dlat = b.lat - a.lat, dlon = b.lon - a.lon;
    if (dy !== 0 && Math.abs(dlat) > tol && Math.sign(dlat) !== -Math.sign(dy)) fail(`${s.id}: drawn ${s.direction} but OSM latitude goes the other way (${a.id} -> ${b.id})`);
    if (dx !== 0 && Math.abs(dlon) > tol && Math.sign(dlon) !== Math.sign(dx)) fail(`${s.id}: drawn ${s.direction} but OSM longitude goes the other way (${a.id} -> ${b.id})`);
  }
  if (s.verified && !(a.verified && b.verified)) fail(`${s.id}: verified segment with an unverified end`);
}

for (const n of nodes) {
  if (n.verified && n.type !== 'landmark' && !(n.osm && n.lat != null)) fail(`${n.id}: verified without OSM evidence`);
  if (n.verified && !n.source?.length && n.type !== 'landmark') fail(`${n.id}: verified without a source`);
}

// Each highway's segments must form one chain in order_on_highway order.
for (const h of highways) {
  const segs = segments.filter(s => s.highway_id === h.id).sort((p, q) => p.order_on_highway - q.order_on_highway);
  if (!segs.length) fail(`${h.id}: no segments`);
  segs.forEach((s, i) => {
    if (s.order_on_highway !== i + 1) fail(`${s.id}: order_on_highway gap`);
    if (i && segs[i - 1].to_node !== s.from_node) fail(`${s.id}: breaks the chain of ${h.id}`);
  });
}

for (const l of landmarks) {
  const n = nodeById.get(l.node_id);
  if (!n || n.type !== 'landmark') fail(`${l.id}: node_id must point to a landmark node`);
}

// Landmark order on screen must match the sourced coordinates (north = smaller y, east = larger x).
const geo = nodes.filter(n => n.type === 'landmark' && n.lat != null);
for (const p of geo) for (const q of geo) {
  if (p.lat > q.lat && !(p.y < q.y)) fail(`${p.id} is north of ${q.id} by coordinates but not drawn above it`);
  if (p.lon > q.lon && !(p.x > q.x)) fail(`${p.id} is east of ${q.id} by coordinates but not drawn right of it`);
}

const unverified = [...highways, ...nodes, ...segments, ...landmarks].filter(r => !r.verified).length;
if (errors.length) {
  console.error(errors.map(e => `✗ ${e}`).join('\n'));
  process.exit(1);
}
console.log(`✓ ${highways.length} highways, ${nodes.length} nodes, ${segments.length} segments, ${landmarks.length} landmarks — all checks passed`);
console.log(`  ${unverified} rows still verified:false (see REVIEW.md)`);
