# Tehran Highways for Backend Developers

A small learning app that teaches Tehran's highway network as a **graph with fixed positions**. North is always up, and the Alborz mountains are always at the top.

**Status: Phase 1 (data only).** The data is derived from OpenStreetMap; 109 of 116 rows are `verified: true`. What is still open is in [`REVIEW.md`](REVIEW.md).

## What is here

| Path | What it is |
|---|---|
| `data/highways.json` | One row per highway: `orientation` (NS / EW / DIAGONAL / MIXED), colour, level, real extents |
| `data/nodes.json` | Interchanges, line ends, squares, landmarks, bends. `x,y` = schematic position, `lat,lon` + `osm` = the OSM evidence |
| `data/segments.json` | Edges: `from_node → to_node`, compass `direction`, `order_on_highway` |
| `data/landmarks.json` | The 4 Level-0 anchors (Tajrish, Milad, Azadi, Rah-Ahan) |
| `data/sources.json` | Where each fact came from |
| `data/osm/summary.json` | Junctions, name changes, line ends and landmark checks derived from OSM |
| `data/osm/highways.geojson` | The real carriageways of the 15 highways with OSM way ids (for the optional real-map view) |
| `map/schematic.svg` | The static schematic map (follows light/dark theme) |
| `map/schematic-full.png`, `-25pct.png`, `-full-dark.png` | Squint-test exports |

## Commands

Node 18+ for everything except re-downloading. Python 3 with `pip install -r requirements.txt` is only needed for the first two.

```sh
npm run fetch:osm    # download Tehran road segments from the Overture/OSM bucket (~1 min, ~24 MB, writes data/raw/)
npm run derive:osm   # raw segments -> data/osm/summary.json + highways.geojson
npm run build:data   # summary.json + schematic layout -> data/*.json
npm run validate     # integrity + "the drawing never contradicts the real coordinates"
npm run build:map    # data -> map/schematic.svg
npm run render       # svg -> PNGs (needs Playwright + Chromium)
npm run build        # data, validate, map, render
```

The committed `data/osm/` files are enough to run everything from `build:data` onward.

Tech choice: plain HTML + SVG + JS, with no framework or build step. The data is small and static, and the map is hand-placed SVG.

## Data and licence

Geography © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/). It was fetched through Overture Maps' transportation segments because `overpass-api.de` was not reachable from the build environment. Keep the credit visible in the app.
The font is Vazirmatn (SIL OFL, see `assets/fonts/OFL-LICENSE.txt`), embedded in the SVG.
