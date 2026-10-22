"""Derive the facts the data tables need from the OSM-derived segments.

Reads  data/raw/overture_segments.json        (tools/overture_fetch.py; not committed, 24 MB)
Writes data/osm/summary.json                  junctions, continuations, endpoints, orientation checks
       data/osm/highways.geojson              main carriageways of the 15 highways (small, committed)

Definitions used below (so the numbers mean something):
  junction      two highways come within TOL metres of each other (2-D, so overpasses count)
  crossing      their lines actually intersect inside the cluster
  ramp          an undirected chain of <=3 'link' segments within 500 m joins the two highways.
                It says "a ramp exists in OSM", NOT "every turn is allowed".
  continuation  one road changes name into another (gap measured between the two ends)
Data: (c) OpenStreetMap contributors, ODbL 1.0, via Overture Maps transportation segments.
"""
import collections, json, math, sys
from pathlib import Path
from shapely import wkb
from shapely.geometry import Point
from shapely.ops import nearest_points, unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
import analyze_osm as A

ROOT = A.ROOT
OUT = ROOT / 'data' / 'osm'
MINE = ['kordestan', 'modares', 'sayyad', 'navvab', 'imam_ali', 'niayesh', 'hemmat', 'resalat', 'sadr', 'babaei',
        'zeinoddin', 'hakim', 'chamran', 'yadegar', 'azadegan']
TOL = 250          # junction tolerance, metres
CLUSTER = 600      # merge junction samples closer than this
RAMP_R = 500
CONTINUATIONS = [('hemmat', 'zeinoddin'), ('hakim', 'resalat'), ('sadr', 'babaei'), ('niayesh', 'sadr'),
                 ('chamran', 'navvab'), ('chamran', 'modares'), ('hemmat', 'khorrazi')]


def ll(x, y):
    lon, lat = A.to_ll(x, y)
    return [round(lat, 5), round(lon, 5)]


def main():
    raw = json.load(open(A.RAW / 'overture_segments.json'))
    rows = raw['rows']
    groups = A.load()
    U = {k: unary_union([ln for _, ln in v]) for k, v in groups.items() if v}
    summary = {
        'provenance': {
            'source': 'OpenStreetMap contributors (ODbL 1.0) via Overture Maps transportation segments',
            'overture_release': raw['release'], 'bbox_lonlat': raw['bbox'],
            'classes': ['motorway', 'trunk', 'primary'],
            'note': 'Main carriageways only: segments whose OSM name is exactly the highway name; bypass lanes (کنارگذر/کندرو) excluded.',
        },
        'highways': {}, 'junctions': {}, 'continuations': {}}

    # ---- per-highway shape ----
    A_info = A.main()['highways']
    for k in MINE:
        h = A_info[k]
        ew, ns = h['ew_extent_km'], h['ns_extent_km']
        rule = 'NS' if ns >= 1.5 * ew else 'EW' if ew >= 1.5 * ns else 'BOTH'
        summary['highways'][k] = {
            'ew_extent_km': ew, 'ns_extent_km': ns, 'axis_angle_deg': h['axis_angle_deg'], 'rule_orientation': rule,
            'extremes': {d: [h[d][1], h[d][0]] for d in ('north', 'south', 'west', 'east')},  # [lat, lon]
            'osm_way_count': len(h['osm_ways']),
        }

    # ---- junctions among the 15 ----
    link_rows = [r for r in rows if r.get('subclass') == 'link']
    link_xy = [A.to_xy(*wkb.loads(bytes.fromhex(r['geometry'])).coords[0][:2]) for r in link_rows]
    main_conn = {k: {c['connector_id'] for r, _ in groups[k] for c in (r.get('connectors') or [])} for k in groups}

    def ramp(a, b, cx, cy):
        adj = collections.defaultdict(set)
        for r, (x, y) in zip(link_rows, link_xy):
            if math.hypot(x - cx, y - cy) < RAMP_R:
                cs = [c['connector_id'] for c in r['connectors'] or []]
                for p in cs:
                    for q in cs:
                        if p != q: adj[p].add(q)
        seen = {c for c in main_conn[a] if c in adj}; frontier = set(seen)
        for _ in range(3):
            nxt = set()
            for c in frontier:
                for d in adj[c]:
                    if d in main_conn[b]: return True
                    if d not in seen: seen.add(d); nxt.add(d)
            frontier = nxt
        return False

    for i, a in enumerate(MINE):
        for b in MINE[i + 1:]:
            samples = []
            for ln in (U[a].geoms if U[a].geom_type == 'MultiLineString' else [U[a]]):
                n = max(2, int(ln.length / 20))
                for t in range(n + 1):
                    p = ln.interpolate(t * ln.length / n)
                    d = p.distance(U[b])
                    if d <= TOL: samples.append((p.x, p.y, d))
            if not samples: continue
            clusters = []
            for s in samples:
                for c in clusters:
                    if math.hypot(s[0] - c[0][0], s[1] - c[0][1]) < CLUSTER: c.append(s); break
                else: clusters.append([s])
            recs = []
            for c in clusters:
                best = min(c, key=lambda t: t[2])
                zone = Point(best[0], best[1]).buffer(CLUSTER)
                crossing = not U[a].intersection(U[b]).intersection(zone).is_empty
                recs.append({'lat_lon': ll(best[0], best[1]), 'min_dist_m': round(best[2]), 'crossing': crossing,
                             'ramp': ramp(a, b, best[0], best[1]), 'samples': len(c)})
            recs.sort(key=lambda r: (r['min_dist_m'], -r['samples']))
            summary['junctions'][f'{a}|{b}'] = {'shared_connectors': len(main_conn[a] & main_conn[b]),
                                                'primary': recs[0], 'others': recs[1:]}

    # ---- name continuations ----
    for a, b in CONTINUATIONS:
        p, q = nearest_points(U[a], U[b])
        summary['continuations'][f'{a}|{b}'] = {'gap_m': round(p.distance(q)), 'lat_lon': ll((p.x + q.x) / 2, (p.y + q.y) / 2)}

    # ---- landmark check: is Milad Tower inside the box Hemmat (N) / Hakim (S) / Chamran (E) / Sheikh Fazlollah Nouri (W)? ----
    # Milad's coordinates come from Wikipedia; this only tests that they sit where the OSM roads say the tower is.
    mx, my = A.to_xy(51.3753, 35.7447)
    me = Point(mx, my)
    box = {}
    for road, want in (('hemmat', 'N'), ('hakim', 'S'), ('chamran', 'E'), ('sheikh_fazlollah', 'W')):
        q, _ = nearest_points(U[road], me)
        dx, dy, dist = q.x - mx, q.y - my, q.distance(me)
        got = ('N' if dy > 0 else 'S') if abs(dy) > abs(dx) else ('E' if dx > 0 else 'W')
        box[road] = {'expected_side': want, 'actual_side': got, 'distance_m': round(dist), 'ok': got == want and dist < 2000}
    summary['landmark_checks'] = {'milad': {'all_ok': all(v['ok'] for v in box.values()), 'box': box}}

    # Squares: is the Wikipedia coordinate within 300 m of the centre of the OSM square (mean of its segment vertices)?
    # A failed check is kept in the data on purpose: it shows the two sources disagree.
    for key, (lat, lon), names in (('tajrish', (35.8056, 51.4381), ['میدان تجریش']), ('azadi', (35.6994, 51.3378), ['میدان آزادی']),
                                   ('rahahan', (35.658, 51.398), ['میدان راه آهن'])):
        pts = []
        for r in rows:
            n = A.norm((r.get('names') or {}).get('primary'))
            if n in names:
                pts += [c[:2] for c in wkb.loads(bytes.fromhex(r['geometry'])).coords]
        if not pts: continue
        cx, cy = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
        ax, ay = A.to_xy(cx, cy); bx, by = A.to_xy(lon, lat)
        dist = round(math.hypot(ax - bx, ay - by))
        summary['landmark_checks'][key] = {'all_ok': dist < 300, 'osm_square_centre': [round(cy, 5), round(cx, 5)], 'wikipedia_coords': [lat, lon], 'distance_m': dist}

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=1) + '\n')

    # ---- compact geometry for the optional real-map view ----
    feats = []
    for k in MINE:
        for r, ln in groups[k]:
            src = next((s['record_id'] for s in (r.get('sources') or []) if s.get('dataset') == 'OpenStreetMap'), None)
            coords = [[round(v, 5) for v in A.to_ll(x, y)] for x, y in ln.coords]
            feats.append({'type': 'Feature', 'properties': {'highway': k, 'osm': src, 'class': r['class']},
                          'geometry': {'type': 'LineString', 'coordinates': coords}})
    (OUT / 'highways.geojson').write_text(json.dumps({
        'type': 'FeatureCollection', 'attribution': '(c) OpenStreetMap contributors, ODbL 1.0', 'features': feats},
        separators=(',', ':')) + '\n')
    size = (OUT / 'highways.geojson').stat().st_size / 1024
    print(f"junction pairs: {len(summary['junctions'])}, continuations: {len(summary['continuations'])}, geojson {len(feats)} features, {size:.0f} KB")


if __name__ == '__main__':
    main()
