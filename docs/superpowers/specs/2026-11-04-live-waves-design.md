# Waves during chapter transitions

Approved in chat on 2026-11-04.

The first screen keeps simulating its existing liquid while any part is visible.
Mouse movement alone creates new desktop waves. Scrolling introduces no impulses.
When the next chapter fully covers the hero, freeze the GPU fields and simulation
clock. Returning resumes those fields with the remaining decay time.
A phone creates one wave on a completed short tap. A swipe keeps native scrolling.

## Approach

Keep the existing GPU targets resident and pause only at full occlusion. This is
the agreed approach. Rebuilding the simulation from a bitmap would discard its
velocity field, and continuing hidden simulation would consume the saved trace.

The chapter controller reports hero exposure using its cached reveal endpoint.
The renderer combines that flag with viewport and document visibility. The fields
are retained until resize, reset, or graphics-context loss, following existing
renderer behavior. Motion-off continues to reset the effect as it does today.

Implementation choices supplied by the agent are a maximum tap time of 350 ms,
movement tolerance of 8 CSS px, and native scroll tolerance of 2 CSS px.

Validate partial-scroll animation, zero new mouse input from scrolling, complete
occlusion and return after more than 6.5 s, tap versus swipe, and both builds.
