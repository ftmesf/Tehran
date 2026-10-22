# Tehran Highways for Backend Developers

A small learning app that teaches Tehran's highway network as a **graph with fixed positions**. North is always up, and the Alborz mountains are always at the top.

**Status: Phases 1–3 done (data, schematic map, explore mode, Levels 0–3 with quizzes). Phase 4 (routing) and the Leaflet tile map are not built yet.** Open `index.html` (one self-contained file, no server needed). The data is derived from OpenStreetMap; 109 of 116 rows are `verified: true`. What is still open is in [`REVIEW.md`](REVIEW.md).

**How it teaches:** Level 0 (compass: mountains, 4 directions, 4 landmarks) → 1 (three vertical and three horizontal highways, one at a time) → 2 (intersections as JOINs) → 3 (edge cases). Each level is a few short cards, then a quiz that answers *on the map* with a car driving the answer. Questions are generated from the data tables; a wrong answer comes back a few questions later; about 80% unlocks the next level. The Developer view (table rows + SQL) is behind the `{ }` button. The 🗺 button (Level 2 and up, and explore mode) redraws the highways with their real shapes so the schematic can be compared with reality. The 'open all levels' link at the bottom of the map is a reviewer shortcut.

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
| `index.html` | **The app (explore mode).** Generated: map + data + CSS + JS in one file. Coordinates are stripped from the embedded data. |
| `app/` | Source of the app: `core.js` (data + map drawing), `real.js` (real-shape view), `explore.js`, `lessons.js` (levels + quiz generators), `main.js`, `app.css`, `index.template.html` |
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
npm run build:app    # data + svg + app/ -> index.html
npm run render       # svg -> PNGs (needs Playwright + Chromium)
npm run test:app     # headless-browser test: quiz answers vs the real OSM coordinates, learner flow, phone layout (needs Playwright + Chromium)
npm run build        # data, validate, map, app, render, test
```

The committed `data/osm/` files are enough to run everything from `build:data` onward.

Tech choice: plain HTML + SVG + JS, with no framework or build step. The data is small and static, and the map is hand-placed SVG.

## Data and licence

Geography © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/). It was fetched through Overture Maps' transportation segments because `overpass-api.de` was not reachable from the build environment. Keep the credit visible in the app.
The font is Vazirmatn (SIL OFL, see `assets/fonts/OFL-LICENSE.txt`), embedded in the SVG.
