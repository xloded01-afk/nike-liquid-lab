# Design and motion review — 3 November 2026

Direction: The name as a monument, seed 446114718. Retained the existing white/black
Nike identity, one Lab type family, and the GPU hero. Applied the direction's
large wordmark and quiet supporting grid. Retained the product photograph instead
of the dealt architecture images, which do not represent this product. Material
bands use the existing normal-map raster artwork, not newly sourced photography.

Idea: Nike's letterforms become surfaces that pointer momentum reveals.
Live thing: GPU liquid reveal with three materials; motion is on by default.
Section argument: recognizable logo → original shoe silhouette → surface studies
using the same letterforms → return to the experiment.

ROUND 2
Seen in one second: a large black Nike wordmark.
Layout words by section: hero=monument / silhouette=split / materials=wide bands / footer=large type.
Scores: design 7.5 · usability 8 · creativity 7 · content 7 → overall 7.6.
Caps applied: the reference-inspired idea is not original enough for creativity above 7.
Top three problems and fixes:
1. Small low-contrast text below the original hero: body increased to 16–18 px with solid ink.
2. Decorative CSS spheres and repeated cards: replaced with large, actual material artwork.
3. Scroll reversal could flicker on trackpads: added direction hysteresis, with 8 px return and 12 px exit thresholds.

Verified in the browser: desktop exit opacity 0 / translateY -20px and reverse
opacity 1; mobile -10px / 220ms. Hero height stays unchanged. At 390 and 768 px
there is no horizontal overflow; section headings remain two lines. Full desktop
render reviewed at 1440 px. Six unit tests pass. The standalone embedded build
loads with WebGL 2 and no console errors via HTTP.

Automated style inspector could not start because local Chrome/crashpad exits.
Source lint has 0 FAIL and 1 WARN (em dashes in names and retained Russian copy).
No attached video was available. Direct file:// navigation is not supported by
the browser tool; the self-contained artifact was checked through HTTP.

No new external images or footage were added. Existing Nike photography and
project font notices remain documented in README.md and the about dialog.
