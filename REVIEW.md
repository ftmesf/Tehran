# REVIEW.md — check these facts before Phase 2

**Why you are getting this list:** I could not reach OpenStreetMap. The Overpass API (`overpass-api.de` and its mirrors) was blocked by this environment's network policy (HTTP 403 from the egress proxy). Direct page fetches of Wikipedia also failed. So:

- Every row in `data/*.json` is `verified: false`.
- The facts below come from **Wikipedia (and a few other pages) read through web-search summaries**, not from map geometry. Several of those articles carry "multiple issues" / cleanup tags, and one (Chamran) is described as dated August 2007.
- Schematic `x, y` positions only keep **order** (who is north / west of whom). They do not keep distance.

**How to use this list:** tick `[x]` when the fact matches a real map. If it is wrong, write the correction next to it. Every item names the data row it controls, so a "no" maps to an exact edit.

Sources are listed in `data/sources.json`. The bracketed names below, such as [Hemmat], link to them.

---

## 0. Where the sources disagree with the brief (read these first)

These change the lesson plan, so please decide them before anything else.

- [ ] **0.1 "Chamran → Modares" is not one north–south line.** The sources say Chamran's north end turns west–east and reaches Parkway, and Modares *starts* at Parkway and runs south. Together they make an upside-down U (∩), not a straight line. The straight north–south line is **Chamran → Navvab**: Navvab "is Chamran Expressway renamed after passing the [Tohid] tunnel". Is that right? — rows `chamran`, `navvab`, `n_parkway`, `n_tohid` — [Chamran], [Navvab], [Modarres]
- [ ] **0.2 Chamran changes direction**, so I set it to `MIXED` (purple, Level 3). It "changes its direction to west-east near Seoul Street". **Your call:** keep it `MIXED`, or teach it as `NS` with a short hook at the top? (`NS` would make it a Level 1 line.) — row `chamran` — [Chamran] / [Yadegar] (a search summary quoted this sentence; I could not tell which of the two articles it came from)
- [ ] **0.3 Hemmat does not reach Sayyad Shirazi or Imam Ali.** Its east end is Pasdaran / Shariati, and it continues east as **Zeinoddin**. I added `zeinoddin` (it was not on your list) so the learner does not think Hemmat crosses Sayyad. OK? — rows `hemmat`, `zeinoddin`, `n_pas_h` — [Hemmat], [Zeinoddin]
- [ ] **0.4 Your 6 east–west highways are really 3 rows:** north row = Niayesh → (tunnel) → Sadr → Babaei; middle row = Hemmat → Zeinoddin; south row = Hakim → Resalat (they meet at Kordestan). Is that right? — [Niayesh], [Sadr], [Babayi], [Hemmat], [Hakim], [Resalat]
- [ ] **0.5 Azadegan is not a straight diagonal.** The sources call it the "Tehran Ringway" in southern Tehran. Its west end is at Hemmat / Tehran–Shomal Freeway (north-west) and its east end is the Basij Interchange (south-east). Roads that meet it on the west side (Sheikh Fazlollah Nouri, Allameh Jafari, Saidi) and on the south side (Tondguyan, Behesht-e Zahra, Raisi) suggest an L-shaped arc. I drew it that way and set it to `MIXED`. Is the shape right? — rows `azadegan`, `n_azg_bend1`, `n_azg_bend2` — [Azadegan]
- [ ] **0.6 Official names changed.** Resalat is now officially "Lieutenant General Qasem Soleimani Expressway" (سپهبد قاسم سلیمانی). Niayesh is officially "Hashemi Rafsanjani Expressway". I kept the everyday names (رسالت, نیایش) in `name_fa` and put the official names in `official_name_*`. Keep it that way? — rows `resalat`, `niayesh` — [Resalat], [Niayesh]
- [ ] **0.7 Imam Ali is EAST of Sayyad Shirazi in the north.** Two separate tables say so: Babayi (east→west: Niru-ye Zamini, **Imam Ali**, **Sayyad**, …) and Zeinoddin (east→west: Bagheri, **Imam Ali**, **Sayyad**). But Imam Ali runs "from Darabad to Ray", and Ray is far south. I could not find where it goes south of Zeinoddin, so the map shows a dashed "؟" there instead of a road. Is Imam Ali east of Sayyad on Babaei and on Zeinoddin? — rows `n_bab_imam`, `n_zei_imam` — [Babayi], [Zeinoddin], [Imam Ali]

## 1. Orientation: one question per highway

- [ ] 1.1 Is **Kordestan** a vertical (north–south) line? — `kordestan` — [Kordestan]
- [ ] 1.2 Is **Modares** a vertical (north–south) line? — `modares` — [Modarres]
- [ ] 1.3 Is **Sayyad Shirazi** a vertical (north–south) line? — `sayyad` — [Sayyad]
- [ ] 1.4 Is **Navvab** a vertical (north–south) line? — `navvab` — [Navvab]
- [ ] 1.5 Is **Imam Ali** a vertical (north–south) line, at least between Babaei and Zeinoddin? (If it slants a lot further south, it may need `DIAGONAL` or `MIXED`.) — `imam_ali` — [Imam Ali]
- [ ] 1.6 Is **Niayesh** a horizontal (east–west) line? — `niayesh` — [Niayesh]
- [ ] 1.7 Is **Sadr** a horizontal (east–west) line? — `sadr` — [Sadr]
- [ ] 1.8 Is **Babaei** a horizontal (east–west) line? — `babaei` — [Babayi]
- [ ] 1.9 Is **Hemmat** a horizontal (east–west) line? — `hemmat` — [Hemmat]
- [ ] 1.10 Is **Zeinoddin** a horizontal (east–west) line? — `zeinoddin` — [Zeinoddin]
- [ ] 1.11 Is **Hakim** a horizontal (east–west) line? — `hakim` — [Hakim]
- [ ] 1.12 Is **Resalat** a horizontal (east–west) line? — `resalat` — [Resalat]
- [ ] 1.13 Does **Yadegar-e Emam** start near Evin, run **west** for a few km, then turn **south**? — `yadegar` — [Yadegar]
- [ ] 1.14 Does **Chamran** run north–south, then turn **west–east** near Seoul St to reach Parkway? — `chamran` — [Chamran]
- [ ] 1.15 Does **Azadegan** run north–south on the west side, then west–east along the south? — `azadegan` — [Azadegan]

## 2. Intersections: one question per interchange

North row (Niayesh / Sadr / Babaei):
- [ ] 2.1 Does Niayesh cross **Yadegar-e Emam**? — `n_nia_yad` — [Niayesh], [Yadegar]
- [ ] 2.2 Does Niayesh cross **Chamran** at Velayat Bridge (پل ولایت)? — `n_velayat` — [Chamran], [Niayesh]
- [ ] 2.3 Does **Kordestan start (north end)** at Niayesh? — `n_nia_kord` — [Kordestan]
- [ ] 2.4 Does Niayesh's east end at **Valiasr St** link to Sadr through a **tunnel**? — `n_nia_vali`, segment `s_niayesh_5` — [Niayesh]
- [ ] 2.5 Does **Sadr start (west end)** at Modares, in Gholhak? — `n_sadr_mod` — [Sadr], [Modarres]
- [ ] 2.6 Does Sadr become **Babaei** where it crosses Pasdaran St? — `n_pas_n` — [Sadr], [Babayi]
- [ ] 2.7 Does **Sayyad Shirazi start (north end)** at Babaei? — `n_bab_say` — [Sayyad]
- [ ] 2.8 Does Babaei cross **Imam Ali**? — `n_bab_imam` — [Babayi] (the only source for this)
- [ ] 2.9 Does **Imam Ali start (north end)** at Artesh Expressway? — `n_artesh` — [Imam Ali]

Middle row (Hemmat / Zeinoddin):
- [ ] 2.10 Does Hemmat cross **Yadegar-e Emam**? — `n_hem_yad` — [Hemmat], [Yadegar]
- [ ] 2.11 Does Hemmat cross **Chamran**? — `n_hem_cham` — [Hemmat], [Chamran]
- [ ] 2.12 Does Hemmat cross **Kordestan**? — `n_hem_kord` — [Hemmat], [Kordestan]
- [ ] 2.13 Does Hemmat cross **Modares** at the Fajr Interchange? (Is "تقاطع فجر" the right Persian name?) — `n_fajr` — [Hemmat], [Modarres]
- [ ] 2.14 Does Hemmat **end** at Pasdaran / Shariati and continue as **Zeinoddin**? — `n_pas_h` — [Hemmat]
- [ ] 2.15 Does Zeinoddin cross **Sayyad Shirazi**? — `n_zei_say` — [Zeinoddin], [Sayyad]
- [ ] 2.16 Does Zeinoddin cross **Imam Ali**? — `n_zei_imam` — [Zeinoddin]

South row (Hakim / Resalat):
- [ ] 2.17 Does Hakim cross **Yadegar-e Emam**? — `n_hak_yad` — [Hakim], [Yadegar]
- [ ] 2.18 Does Hakim cross **Chamran**? (The Chamran article says it passes under "Resalat" here. The Hakim article lists Chamran. I assumed the Chamran article means Hakim.) — `n_hak_cham` — [Hakim], [Chamran]
- [ ] 2.19 Does **Hakim end and Resalat begin** at Kordestan, just past the Resalat Tunnel? — `n_kord_hak_res` — [Hakim], [Resalat], [Kordestan]
- [ ] 2.20 Does Resalat cross **Modares**? — `n_res_mod` — [Modarres]
- [ ] 2.21 Does Resalat cross **Sayyad Shirazi** at the Sayyad Shirazi Interchange? — `n_sayyad_ic` — [Sayyad]
- [ ] 2.22 Does Resalat **end** (east end) at Yasini Expressway? — `n_res_e` — [Resalat]
- [ ] 2.23 Does Resalat cross **Imam Ali**? (**Not in the data.** I found no source either way.) — no row yet

Other:
- [ ] 2.24 Is **Parkway** the meeting point of Chamran's north end, Modares's north end and Valiasr St? — `n_parkway` — [Chamran], [Modarres]
- [ ] 2.25 Does Yadegar-e Emam's **north end** meet Chamran at **Seoul St**, where Chamran bends? — `n_seoul` — [Yadegar], [Chamran]
- [ ] 2.26 Does Chamran become **Navvab** at the **Tohid Tunnel**? — `n_tohid` — [Chamran], [Navvab]
- [ ] 2.27 Does Hemmat's **west end** meet **Azadegan**? (**Conflict:** Hemmat's infobox says the west end is Kharrazi Expressway; its text says Azadegan / Tehran–Shomal Freeway.) — `n_hem_w` — [Hemmat], [Azadegan]
- [ ] 2.28 Does Hakim **end** (west end) at Allameh Jafari Square? — `n_hak_w` — [Hakim], [Allameh Jafari]

## 3. Order along each highway (the "which do you cross next?" quiz depends on these)

- [ ] 3.1 Driving **south** on Modares: Sadr → Hemmat (Fajr) → Resalat, in that order? — [Modarres]
- [ ] 3.2 Driving **south** on Kordestan: Niayesh → Hemmat → Hakim/Resalat → Jalal-e Al-e Ahmad, in that order? — [Kordestan]
- [ ] 3.3 Driving **south** on Chamran: Niayesh → Hemmat → Hakim → Jalal-e Al-e Ahmad → Tohid Tunnel, in that order? — [Chamran]
- [ ] 3.4 Driving **south** on Yadegar-e Emam: Niayesh → Hemmat → Hakim → Azadi Ave, in that order? — [Yadegar], [Niayesh]
- [ ] 3.5 Driving **south** on Sayyad Shirazi: Babaei → Zeinoddin → Resalat → Sepah Sq, in that order? — [Sayyad]
- [ ] 3.6 Driving **east** on Hemmat: Yadegar → Chamran → Kordestan → Modares → Pasdaran, in that order? — [Hemmat]
- [ ] 3.7 Driving **east** on Hakim: Yadegar → Chamran → Kordestan, in that order? — [Hakim]
- [ ] 3.8 Driving **east** on Niayesh: Yadegar → Chamran → Kordestan → Valiasr, in that order? — [Niayesh]
- [ ] 3.9 Driving **east** on Babaei: Sayyad Shirazi, then Imam Ali? — [Babayi]
- [ ] 3.10 Driving **east** on Resalat: Modares, then Sayyad Shirazi? — [Modarres], [Sayyad]
- [ ] 3.11 Is **Hemmat north of Hakim / Resalat** everywhere they run side by side? (I worked this out from the Modares, Chamran and Yadegar orders. No source says it directly.) — rows `y` of both
- [ ] 3.12 Is **Niayesh north of Hemmat**? (Worked out from the Chamran order.)
- [ ] 3.13 Is Yadegar's west–east top part **north of Niayesh**? (Worked out: Niayesh crosses Yadegar's north–south part, so the bend must be north of Niayesh.) — `n_yad_bend`
- [ ] 3.14 West → east order of the vertical lines along Hemmat: Yadegar, Chamran, Kordestan, Modares. Correct? — [Hemmat]

## 4. Ends of lines (low confidence on where they sit)

In the schematic these sit roughly level with each other. That is a drawing choice, not a fact. Please do not quiz "which is further south" on these until checked.

- [ ] 4.1 Kordestan south end = Jalal-e Al-e Ahmad / Shahid Gomnam? — `n_kord_s` — [Kordestan]
- [ ] 4.2 Modares south end = Haft-e Tir Square? — `n_haft_tir` — [Modarres]
- [ ] 4.3 Sayyad Shirazi south end = Sepah Square? — `n_sepah` — [Sayyad]
- [ ] 4.4 Yadegar-e Emam south end = Azadi Avenue? (**Conflict:** its infobox says the south end is a "U-Turn".) — `n_yad_s` — [Yadegar]
- [ ] 4.5 Navvab south end = Qale Morghi / Niruye Havaei junction? — `n_nav_s` — [Navvab]
- [ ] 4.6 Niayesh west end = Ashrafi Esfahani, after which it becomes Abshenasan? — `n_nia_w` — [Niayesh]
- [ ] 4.7 Babaei east end = Tehran–Damavand / Tehran–Parchin roads? — `n_bab_e` — [Babayi]
- [ ] 4.8 Azadegan east end = Basij Interchange? — `n_basij` — [Azadegan]

## 5. Landmarks (Level 0)

Coordinates are stored in `nodes.json` (hidden from the learner). They are used only to check the drawing order.

- [ ] 5.1 Tajrish ≈ 35.806 N, 51.438 E? (An older revision of the article gives a point ~1 km west.) — `lm_tajrish` — [Tajrish]
- [ ] 5.2 Milad Tower ≈ 35.745 N, 51.375 E? — `lm_milad` — [Milad]
- [ ] 5.3 Azadi Tower ≈ 35.699 N, 51.338 E? — `lm_azadi` — [Azadi]
- [ ] 5.4 Tehran railway station ≈ 35.658 N, 51.398 E, at Rah-Ahan Square? — `lm_rahahan` — [Railway stn]
- [ ] 5.5 Is Milad Tower inside the box Hemmat (north), Hakim (south), Sheikh Fazlollah Nouri (west), Chamran (east)? — `lm_milad` — [Milad], [SURFIRAN](https://surfiran.com/mag/tehran-milad-tower/)
- [ ] 5.6 Does Valiasr St run from Rah-Ahan Square (south) to Tajrish (north)? — [Valiasr], [UNESCO Valiasr]
- [ ] 5.7 Is Tajrish much higher than Rah-Ahan (UNESCO gives ~1615 m vs ~1117 m)? This is the "north = uphill" proof for Level 0. — `landmarks.elevation_m` — [UNESCO Valiasr]
- [ ] 5.8 From those coordinates: north → south order is Tajrish, Milad, Azadi, Rah-Ahan; west → east order is Azadi, Milad, Rah-Ahan, Tajrish. (`npm run validate` checks the drawing against this.) Does that match the map?
- [ ] 5.9 **Drawing only, not a fact:** Rah-Ahan is drawn east of Navvab's south end and north of Azadegan. Azadi is drawn west of Yadegar's south end. Correct, or should they move?

## 6. Things I could not find (open items)

- 6.1 Imam Ali's route south of Zeinoddin, and whether it crosses Resalat.
- 6.2 Hemmat's true west end (Kharrazi vs Azadegan).
- 6.3 Which highway (if any) Azadegan meets besides Hemmat, among the ones in this dataset.
- 6.4 Persian names of the interchanges (`name_fa` of `n_*` rows) are my wording, for example "تقاطع فجر" and "پل ولایت". Please correct any that people do not actually use.
- 6.5 Real `lat/lon` for every interchange. These stay `null` until we can import OSM.

## 7. Schematic choices to approve (drawing, not geography)

- 7.1 Pasdaran St is where both Hemmat and Sadr end, so both ends share one `x`.
- 7.2 Rows are evenly spaced. Real gaps between Niayesh, Hemmat and Hakim are not equal.
- 7.3 Valiasr St and Sheikh Fazlollah Nouri are **not** drawn, even though they help place Tajrish, Rah-Ahan and Milad. Should Valiasr be a thin reference line in Level 0?
- 7.4 Level split: L1 = Kordestan, Modares, Sayyad (vertical) + Niayesh, Hemmat, Resalat (horizontal). L2 adds Navvab, Imam Ali, Sadr, Babaei, Zeinoddin, Hakim. L3 = Chamran, Yadegar, Azadegan.

---

### Once a fact is confirmed

Set `verified: true` on its row. If a source other than these summaries confirmed it (for example OSM, or you checking the map), add that source to `data/sources.json`. Run `npm run phase1` to re-check and redraw.

[Chamran]: https://en.wikipedia.org/wiki/Chamran_Expressway
[Modarres]: https://en.wikipedia.org/wiki/Modarres_Expressway
[Kordestan]: https://en.wikipedia.org/wiki/Kordestan_Expressway
[Yadegar]: https://en.wikipedia.org/wiki/Yadegar-e-Emam_Expressway
[Navvab]: https://en.wikipedia.org/wiki/Navvab_Expressway
[Imam Ali]: https://en.wikipedia.org/wiki/Imam_Ali_Expressway
[Sayyad]: https://en.wikipedia.org/wiki/Sayyad_Expressway
[Hemmat]: https://en.wikipedia.org/wiki/Hemmat_Expressway
[Hakim]: https://en.wikipedia.org/wiki/Hakim_Expressway
[Resalat]: https://en.wikipedia.org/wiki/Qasem_Soleimani_Expressway
[Niayesh]: https://en.wikipedia.org/wiki/Hashemi_Rafsanjani_Expressway
[Sadr]: https://en.wikipedia.org/wiki/Sadr_Expressway
[Babayi]: https://en.wikipedia.org/wiki/Babayi_Expressway
[Zeinoddin]: https://en.wikipedia.org/wiki/Zeinoddin_Expressway
[Azadegan]: https://en.wikipedia.org/wiki/Azadegan_Expressway
[Allameh Jafari]: https://en.wikipedia.org/wiki/Allameh_Jafari_Expressway
[Milad]: https://en.wikipedia.org/wiki/Milad_Tower
[Azadi]: https://en.wikipedia.org/wiki/Azadi_Tower
[Tajrish]: https://en.wikipedia.org/wiki/Tajrish
[Railway stn]: https://en.wikipedia.org/wiki/Tehran_railway_station
[Valiasr]: https://en.wikipedia.org/wiki/Valiasr_Street
[UNESCO Valiasr]: https://whc.unesco.org/en/tentativelists/6387/
