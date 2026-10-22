"""Fetch Tehran road segments from Overture Maps (OSM-derived) without downloading the whole release.

Why: overpass-api.de was blocked in the build environment, but the Overture S3 bucket was reachable.
Overture's transportation theme is built mostly from OpenStreetMap; each segment keeps the OSM way id in `sources`.

It reads only the parquet footers, then only the row groups whose bbox statistics touch the Tehran box.

Usage: python tools/overture_fetch.py [release]   ->  data/raw/overture_segments.json
"""
import io, json, re, sys, threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pyarrow.parquet as pq
import requests

BUCKET = 'https://overturemaps-us-west-2.s3.amazonaws.com'
RELEASE = sys.argv[1] if len(sys.argv) > 1 else '2026-10-21.0'
PREFIX = f'release/{RELEASE}/theme=transportation/type=segment/'
# Generous box around Tehran: lon, lat
XMIN, XMAX, YMIN, YMAX = 51.10, 51.70, 35.55, 35.90
CLASSES = {'motorway', 'trunk', 'primary'}
OUT = Path(__file__).resolve().parent.parent / 'data' / 'raw'

session = requests.Session()


class RangeFile(io.RawIOBase):
    """Read-only file object over HTTP Range requests, with a small block cache."""
    BLOCK = 1 << 20

    def __init__(self, url):
        self.url, self.pos, self.cache = url, 0, {}
        r = session.head(url, timeout=60)
        r.raise_for_status()
        self.size = int(r.headers['Content-Length'])
        self.lock = threading.Lock()

    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos

    def seek(self, off, whence=0):
        self.pos = {0: off, 1: self.pos + off, 2: self.size + off}[whence]
        return self.pos

    def _block(self, i):
        if i not in self.cache:
            a, b = i * self.BLOCK, min((i + 1) * self.BLOCK, self.size) - 1
            for attempt in range(4):
                try:
                    r = session.get(self.url, headers={'Range': f'bytes={a}-{b}'}, timeout=120)
                    r.raise_for_status()
                    self.cache[i] = r.content
                    break
                except requests.RequestException:
                    if attempt == 3: raise
        return self.cache[i]

    def read(self, n=-1):
        if n < 0: n = self.size - self.pos
        end = min(self.pos + n, self.size)
        out, p = [], self.pos
        while p < end:
            i = p // self.BLOCK
            blk = self._block(i)
            s = p - i * self.BLOCK
            take = blk[s:s + (end - p)]
            out.append(take); p += len(take)
        self.pos = end
        return b''.join(out)

    def readinto(self, b):
        d = self.read(len(b)); b[:len(d)] = d; return len(d)


def list_files():
    keys, marker = [], ''
    while True:
        x = session.get(f'{BUCKET}/', params={'prefix': PREFIX, 'marker': marker}, timeout=60).text
        found = re.findall(r'<Key>([^<]+)</Key>', x)
        keys += found
        if '<IsTruncated>true' not in x: return keys
        marker = found[-1]


def touching_groups(key):
    f = pq.ParquetFile(RangeFile(f'{BUCKET}/{key}'))
    md, names = f.metadata, f.schema_arrow.names
    cols = {f.schema.column(i).path: i for i in range(len(f.schema))}
    ix = {n: cols[n] for n in ('bbox.xmin', 'bbox.xmax', 'bbox.ymin', 'bbox.ymax') if n in cols}
    hit = []
    for g in range(md.num_row_groups):
        rg = md.row_group(g)
        st = {n: rg.column(i).statistics for n, i in ix.items()}
        if any(s is None or not s.has_min_max for s in st.values()):
            hit.append(g); continue  # no stats: be safe
        if st['bbox.xmax'].max >= XMIN and st['bbox.xmin'].min <= XMAX and st['bbox.ymax'].max >= YMIN and st['bbox.ymin'].min <= YMAX:
            hit.append(g)
    return key, f, hit, md.num_row_groups


def main():
    keys = list_files()
    print(f'{len(keys)} files in release {RELEASE}')
    with ThreadPoolExecutor(8) as ex:
        scans = list(ex.map(touching_groups, keys))
    todo = [(k, f, h) for k, f, h, n in scans if h]
    print('files with candidate row groups:', [(k.split("part-")[1][:5], len(h), n) for k, f, h, n in scans if h])

    rows = []
    cols = ['id', 'subtype', 'class', 'names', 'bbox', 'geometry', 'connectors', 'road_flags', 'road_surface',
            'access_restrictions', 'sources', 'subclass', 'level_rules', 'width_rules', 'speed_limits']
    for key, f, groups in todo:
        have = [c for c in cols if c in f.schema_arrow.names]
        for g in groups:
            t = f.read_row_group(g, columns=have)
            d = t.to_pydict()
            for i in range(t.num_rows):
                bb = d['bbox'][i]
                if not (bb['xmax'] >= XMIN and bb['xmin'] <= XMAX and bb['ymax'] >= YMIN and bb['ymin'] <= YMAX): continue
                if d['class'][i] not in CLASSES: continue
                r = {c: d[c][i] for c in have}
                r['geometry'] = r['geometry'].hex()  # WKB
                rows.append(r)
        print(key.split('part-')[1][:5], 'done, rows so far', len(rows), flush=True)

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'overture_segments.json').write_text(json.dumps({'release': RELEASE, 'bbox': [XMIN, YMIN, XMAX, YMAX], 'rows': rows}, default=str))
    print('saved', len(rows), 'segments')


if __name__ == '__main__':
    main()
