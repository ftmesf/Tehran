# REVIEW.md — what OpenStreetMap settled, and what is still open

**Data source now:** OpenStreetMap, via Overture Maps' transportation segments (release `2026-10-21.0`, 14,016 motorway/trunk/primary segments inside a box around Tehran). `overpass-api.de` was still blocked from the build environment, but the Overture bucket on S3 was reachable. Overture re-publishes OSM ways and keeps each way id. © OpenStreetMap contributors, ODbL 1.0.

**How a fact became `verified: true`:** it is derived from OSM geometry by `tools/derive_osm.py` (a highway's shape, where it ends, which highways come within 250 m of each other, where one name turns into another). `npm run validate` also tests that the drawing never runs against the real coordinates, and it fails on an unverified row that claims OSM evidence.
**Result:** 109 of 116 rows verified (15/15 highways, 42/45 nodes, 50/52 segments, 2/4 landmarks). Re-run everything with `npm run fetch:osm && npm run derive:osm && npm run build`.

**What "verified" does not mean:** it says the geometry matches. It does not say you may turn from one road onto the other (see section 3). Persian names of interchanges are not in OSM.

---

## 1. Corrections to what I told you before

My earlier checklist and "pass 2" were built from web-search summaries of Wikipedia. OSM contradicts several of them:

| Earlier claim | What OSM shows |
|---|---|
| Hemmat does not reach Sayyad Shirazi (0.3) | **Wrong.** Hemmat ends and Zeinoddin begins exactly where Sayyad Shirazi crosses (35.7569 N, 51.4659 E, gap 0 m). |
| Hemmat/Sadr end at **Pasdaran St** (x=1060 node) | Pasdaran is not in the data. Sadr turns into Babaei at 51.4980 E, east of Imam Ali, not at Pasdaran. The Pasdaran node is deleted. |
| Sayyad Shirazi starts at Babaei | **Wrong.** It crosses Sadr (35.7883, 51.4847) and then **joins Imam Ali** at 35.7992 N, 51.4936 E. It never touches Babaei. |
| Azadegan meets Hemmat's west end | **Not supported.** Azadegan's north-west end is **8.6 km** from Hemmat, and no other of the 14 highways comes within 250 m of it. It is an isolated line in this data. |
| Imam Ali south of Zeinoddin is unknown | It runs about **23 km north to south** (35.809 N down to 35.598 N) and crosses Zeinoddin, Resalat and ends south of Azadegan's lowest point. |
| Hemmat's west end is Azadegan **or** Kharrazi | OSM: it runs into **Kharrazi** (gap 0 m). |
| Seoul/Niayesh interchange might put Yadegar's top level with Niayesh | No. The Chamran × Yadegar junction (35.7900 N) is about 1.5 km north of Niayesh (35.7766 N). |
| Chamran→Modares is a straight line (your brief) | Confirmed **not** straight: Chamran bends east over the top (3.2 km east–west vs 9.7 km north–south) and Modares starts 0.6 km further east. The straight line is Chamran → (1 km tunnel gap) → Navvab. |

## 2. Your original questions, answered by OSM

**Orientation (East–west extent × north–south extent, km):**
- Vertical (NS): Kordestan 1.3×5.5 · Modares 0.8×7.9 · Sayyad Shirazi 5.0×10.4 (leans north-east) · Navvab 0.4×4.4 · Imam Ali 4.1×23.4.
- Horizontal (EW): Niayesh 6.8×0.9 · Hemmat 18.2×0.9 · Resalat 12.2×2.4 · Sadr 6.4×2.0 · Babaei 13.2×6.6 (leans south-east) · Zeinoddin 11.5×4.1 · Hakim 8.9×1.3.
- Changes direction: Chamran 3.2×9.7 · Yadegar-e Emam 4.4×11.9 (west–east at the top, then north–south, as the sources said).
- Diagonal: Azadegan 17.6×8.4, an arc from the north-west down to a southern bulge and back up to the east.

**The three east–west rows (north → south), confirmed:**
1. Niayesh → *(about 1.5 km tunnel gap, OSM has a segment "صدر به تونل نیایش")* → Sadr → Babaei
2. Hemmat → Zeinoddin
3. Hakim → Resalat (Hakim ends about 0.25 km east of the Kordestan crossing)

**Junctions found (all 26 pairs within 250 m among the 15 highways)** are in `data/osm/summary.json`. Two have **no crossing line** and are near-misses only: Niayesh × Yadegar (171 m, Niayesh runs about 0.8 km west past Yadegar) and Hemmat × Chamran (24 m). I kept them as junctions because a ramp chain exists, but those two are the ones to look at on a map.

**Order along each line** (checked automatically against the drawing):
- Modares, south: Sadr → Hemmat → Resalat · Kordestan, south: Niayesh → Hemmat → Hakim/Resalat · Chamran, south: Yadegar/Seoul → Niayesh → Hemmat → Hakim.
- Yadegar, south: Chamran → (bend) → Niayesh → Hemmat → Hakim · Sayyad, south: Imam Ali → Sadr → Hemmat/Zeinoddin → Resalat · Imam Ali, south: Sayyad → Sadr/Babaei → Zeinoddin → Resalat.
- Hemmat, east: Yadegar → Chamran → Kordestan → Modares → Sayyad (Zeinoddin starts) · Niayesh, east: Yadegar → Chamran → Kordestan · Resalat, east: Modares → Sayyad → Imam Ali · Hakim, east: Yadegar → Chamran → Kordestan.
- Rows: Niayesh is north of Hemmat, which is north of Hakim/Resalat.

**Landmarks:**
- Milad Tower: OSM roads put it inside the box Hemmat (north, 528 m), Hakim (south, 370 m), Chamran (east, 750 m), Sheikh Fazlollah Nouri (west, 456 m). **Verified.**
- Rah-Ahan: Wikipedia's point is 144 m from the centre of OSM's "میدان راه آهن". **Verified.**
- Tajrish: Wikipedia's point is **852 m** from OSM's Tajrish Square centre. Two Wikipedia revisions of this article disagree by about 1 km, and OSM matches the older one. **Left unverified**, drawn using the Wikipedia point.
- Azadi: **1,066 m** from OSM's square centre, but that centre is pulled east by the roads leading into the square. **Inconclusive, left unverified.**
- Elevation (Tajrish ~1615 m, Rah-Ahan ~1117 m): not in OSM. Source is the UNESCO tentative list only.

## 3. What is still open (these need a human, not more data)

1. **Chamran: `MIXED` (level 3) or `NS` (level 1)?** OSM says it is mostly vertical with a hook at the top. I kept `MIXED`. Change one field in `tools/build-data.mjs` if you disagree.
2. **Turns.** The data shows a ramp chain between the two highways at 25 of 26 junctions. That only says a ramp exists. It does not say which turns are allowed, and OSM's direction rules are in the raw data but not used yet. The only junction with **no** ramp found is **Hemmat × Yadegar-e Emam**. A Persian page said Kordestan's links to Hemmat and Hakim are U-turn only; OSM shows ramps there, so one of them is incomplete. **Must be resolved before Level 4 routing** (Dijkstra would otherwise suggest turns you cannot make).
3. **Names.** OSM calls Resalat "شهید سلیمانی" and Niayesh "آیت الله هاشمی رفسنجانی". The app shows the everyday names and keeps the official ones in the data. If your phone's map shows only the new names, tell me and I'll switch.
4. **Interchange nicknames** (فجر, ولایت, پارک‌وی, تقاطع صیاد شیرازی) come from Wikipedia, not OSM. They are stored as `alias_fa`, never as the main name.
5. **Azadegan is isolated.** In this data it connects to nothing else, so Level 4 routing cannot use it. It still works as a Level 3 shape lesson.
6. **What I did not test:** where Hakim's west end really is (Allameh Jafari Sq), Jalal-e Al-e Ahmad at Kordestan's south end, Yasini at Resalat's east end, and the "Artesh" name at Imam Ali's north end. I only know where the lines end, not what they end at.
7. **Drawing choices** (not geography): rows are drawn flat even though Sadr→Babaei rises north-east and Zeinoddin falls south-east; Sayyad Shirazi is a 45° line into Imam Ali; Tajrish is placed east of Modares because its coordinates say so; Sheikh Fazlollah Nouri, Valiasr and Pasdaran are not drawn.
8. **Licence.** The ODbL requires the credit "© OpenStreetMap contributors" in the app. It is already on the map; Phase 5 must keep it.
