# Tehran Highways for Backend Developers

A small learning app that teaches Tehran's highway network as a **graph with fixed positions**. North is always up, and the Alborz mountains are always at the top.

**Status: Phase 1 (data only).** Every data row is `verified: false` until the checklist in [`REVIEW.md`](REVIEW.md) is done.

## What is here

| Path | What it is |
|---|---|
| `data/highways.json` | One row per highway: `orientation` (NS / EW / DIAGONAL / MIXED), color, level |
| `data/nodes.json` | Interchanges, line ends, squares, landmarks, plus hidden bend `waypoint`s. `x,y` = schematic position |
| `data/segments.json` | Edges: `from_node → to_node`, compass `direction`, `order_on_highway` |
| `data/landmarks.json` | The 4 Level-0 anchors (Tajrish, Milad, Azadi, Rah-Ahan) |
| `data/sources.json` | Where each fact came from |
| `map/schematic.svg` | The static schematic map (follows the light/dark theme) |
| `map/schematic-full.png`, `map/schematic-25pct.png`, `map/schematic-full-dark.png` | Squint-test exports |
| `REVIEW.md` | One question per fact, to check against a real map |

## Commands

Needs Node 18+. The PNG step also needs Playwright with Chromium.

```sh
npm run validate    # integrity checks: references, 0/45/90° lines, directions, chain order, landmark order
npm run build:map   # data/*.json -> map/schematic.svg
npm run render      # map/schematic.svg -> PNGs
npm run phase1      # all three
```

Tech choice: plain HTML + SVG + JS, with no framework or build step. The data is small and static, and the map is hand-placed SVG, so React would add weight without helping.

The font is Vazirmatn (SIL Open Font License, see `assets/fonts/OFL-LICENSE.txt`). It is embedded in the SVG, so Persian renders the same everywhere.
