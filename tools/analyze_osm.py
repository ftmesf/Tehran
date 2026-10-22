"""Turn the raw Overture/OSM segments into facts about the 15 highways (shape, ends, crossings, order).

Reads  data/raw/overture_segments.json   (from tools/overture_fetch.py)
Writes data/raw/analysis.json            (machine-readable, used by tools/apply_osm.py)
Prints a human summary.

All distances are metres in a local flat frame (good enough inside one city); lat/lon stay in the output only for the learner-hidden columns.
"""
import json, math, re, sys
from pathlib import Path
from shapely import wkb
from shapely.geometry import LineString, MultiLineString, Point
from shapely.ops import unary_union, linemerge

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'data' / 'raw'
LAT0, LON0 = 35.70, 51.40
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574


def to_xy(lon, lat): return ((lon - LON0) * KX, (lat - LAT0) * KY)
def to_ll(x, y): return (LON0 + x / KX, LAT0 + y / KY)


norm = lambda s: re.sub(r'\s+', ' ', (s or '').replace('ي', 'ی').replace('ك', 'ک').replace('‌', ' ')).strip()

# Exact (normalised) OSM names that form each highway's main carriageway. Bypass lanes (کنارگذر / کندرو) are excluded on purpose.
MAIN = {
    'kordestan': ['بزرگراه کردستان'],
    'modares': ['بزرگراه آیت الله مدرس'],
    'sayyad': ['بزرگراه صیاد شیرازی'],
    'navvab': ['نواب صفوی', 'بزرگراه نواب صفوی'],
    'imam_ali': ['بزرگراه امام علی'],
    'niayesh': ['بزرگراه آیت الله هاشمی رفسنجانی'],
    'hemmat': ['بزرگراه همت', 'بزرگراه شهید همت', 'بزرگراه همت شرق'],
    'resalat': ['بزرگراه شهید سلیمانی', 'تونل رسالت'],
    'sadr': ['بزرگراه صدر'],
    'babaei': ['بزرگراه بابایی'],
    'zeinoddin': ['بزرگراه زین الدین'],
    'hakim': ['بزرگراه آیت الله حکیم'],
    'chamran': ['بزرگراه چمران', 'بزرگراه شهید چمران'],
    'yadegar': ['بزرگراه یادگار امام'],
    'azadegan': ['بزرگراه آزادگان', 'آزادگان', 'آزادگان شرق', 'آزادگان غرب'],
    # reference roads, not in the dataset: help to place things
    'sheikh_fazlollah': ['بزرگراه شیخ فضل الله نوری'],
    'jalal': ['بزرگراه جلال آل احمد'],
    'haghani': ['بزرگراه حقانی'],
    'ashrafi': ['بزرگراه آیت الله اشرفی اصفهانی'],
    'khorrazi': ['بزرگراه خرازی'],
    'yasini': ['بزرگراه یاسینی'],
    'bagheri': ['بزرگراه باقری'],
}


def load():
    rows = json.load(open(RAW / 'overture_segments.json'))['rows']
    groups = {k: [] for k in MAIN}
    for r in rows:
        n = norm((r.get('names') or {}).get('primary'))
        for k, names in MAIN.items():
            if n in names and r['class'] in ('trunk', 'primary', 'motorway'):
                geom = wkb.loads(bytes.fromhex(r['geometry']))
                lines = list(geom.geoms) if geom.geom_type == 'MultiLineString' else [geom]
                for ln in lines:
                    groups[k].append((r, LineString([to_xy(x, y) for x, y, *_ in ln.coords])))
    return groups


def principal_axis(lines):
    pts = [p for ln in lines for p in ln.coords]
    mx = sum(p[0] for p in pts) / len(pts); my = sum(p[1] for p in pts) / len(pts)
    sxx = sum((p[0] - mx) ** 2 for p in pts); syy = sum((p[1] - my) ** 2 for p in pts); sxy = sum((p[0] - mx) * (p[1] - my) for p in pts)
    ang = 0.5 * math.atan2(2 * sxy, sxx - syy)  # radians from east, counter-clockwise
    return math.degrees(ang) % 180


def compass(angle_deg):
    a = angle_deg % 180
    if a < 22.5 or a >= 157.5: return 'EW'
    if 67.5 <= a < 112.5: return 'NS'
    return 'NE-SW' if a < 90 else 'NW-SE'


def main():
    groups = load()
    info, unions = {}, {}
    for k, items in groups.items():
        lines = [ln for _, ln in items]
        if not lines:
            info[k] = None; continue
        u = unary_union(lines); unions[k] = u
        minx, miny, maxx, maxy = u.bounds
        ang = principal_axis(lines)
        info[k] = {
            'segments': len(lines), 'length_km': round(sum(l.length for l in lines) / 1000, 1),
            'ew_extent_km': round((maxx - minx) / 1000, 1), 'ns_extent_km': round((maxy - miny) / 1000, 1),
            'axis_angle_deg': round(ang), 'axis': compass(ang),
            'west': [round(v, 5) for v in to_ll(minx, [c[1] for l in lines for c in l.coords if abs(c[0] - minx) < 1][0])],
            'east': [round(v, 5) for v in to_ll(maxx, [c[1] for l in lines for c in l.coords if abs(c[0] - maxx) < 1][0])],
            'north': [round(v, 5) for v in to_ll([c[0] for l in lines for c in l.coords if abs(c[1] - maxy) < 1][0], maxy)],
            'south': [round(v, 5) for v in to_ll([c[0] for l in lines for c in l.coords if abs(c[1] - miny) < 1][0], miny)],
            'osm_ways': sorted({s['record_id'].split('@')[0] for r, _ in items for s in (r.get('sources') or []) if s.get('dataset') == 'OpenStreetMap'})[:400],
        }

    # crossings between every pair (2-D, so grade-separated crossings count too)
    keys = [k for k in unions]
    cross = {}
    for i, a in enumerate(keys):
        for b in keys[i + 1:]:
            inter = unions[a].intersection(unions[b])
            if inter.is_empty: continue
            pts = []
            def collect(g):
                if g.geom_type == 'Point': pts.append((g.x, g.y))
                elif g.geom_type in ('MultiPoint', 'GeometryCollection', 'MultiLineString'):
                    for s in g.geoms: collect(s)
                elif g.geom_type == 'LineString': pts.append(g.interpolate(0.5, normalized=True).coords[0])
            collect(inter)
            clusters = []
            for p in pts:
                for c in clusters:
                    if math.hypot(p[0] - c[0][0], p[1] - c[0][1]) < 250: c.append(p); break
                else: clusters.append([p])
            cross[f'{a}|{b}'] = [[round(v, 5) for v in to_ll(sum(p[0] for p in c) / len(c), sum(p[1] for p in c) / len(c))] for c in clusters]

    # shared connector ids (= physically joined, not just overlapping on a map)
    conn = {k: {c['connector_id'] for r, _ in groups[k] for c in (r.get('connectors') or [])} for k in groups}
    joined = {}
    for i, a in enumerate(keys):
        for b in keys[i + 1:]:
            n = len(conn[a] & conn[b])
            if n: joined[f'{a}|{b}'] = n

    out = {'highways': info, 'crossings': cross, 'joined_by_connector': joined}
    (RAW / 'analysis.json').write_text(json.dumps(out, ensure_ascii=False, indent=1))
    return out


if __name__ == '__main__':
    o = main()
    for k, v in o['highways'].items():
        if v: print(f"{k:18s} {v['length_km']:6.1f} km  EWx{v['ew_extent_km']:5.1f} NSx{v['ns_extent_km']:5.1f}  axis={v['axis']:6s}({v['axis_angle_deg']:3d}°)  ways={len(v['osm_ways'])}")
        else: print(k, 'NO DATA')
