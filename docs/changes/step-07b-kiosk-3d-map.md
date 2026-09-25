# Step 7b: Kiosk 3D map: whole building, floors, animated routes

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Source | The team's Software Plan (Capstone SDP notes) and the kiosk spec (QA-26) |
| Scope | Frontend: kiosk map, attract screen, building configuration |
| Test report | [step-07b-test-report.md](../qa/step-07b-test-report.md) |

## What changed

| Area | Change |
|---|---|
| Whole-building view | The kiosk map opens on the complete EYA building, framed automatically from the model. The label reads "EYA Building · Whole building". |
| Opening the building | Tapping the building (a tap, not a drag) lifts the exterior and roof up and fades them out (0.9 s), then shows the kiosk's floor. Per the Software Plan: "upon clicking the front … will be removed (preferably animated to ascend out of view)". |
| Floors | **New** floor buttons (whole building, 6F … 1F; the kiosk's floor has a gold dot). A floor view shows that floor and the floors below as a cutaway. The floors above lift away with the same animation, and the camera glides to frame the view. |
| Destinations | Choosing a destination switches to its floor (`modelFloor`, default the kiosk floor). The route draws only on its own floor. In the building view, or with another floor shown, it would float over walls. |
| Route | Thinner line (3 px, 6 px white edge; was 5/9 px). Gold chevrons with a navy edge flow toward the destination, about one gap per second. The chevrons stay about 22 px wide at any zoom. A matching arrowhead has its tip on the destination. With reduced motion, the chevrons stand still. |
| Camera | Isometric: the angle from above is locked (about 45°, set by the building's `camera.position`). Visitors can turn around the building, pan, and zoom. The zoom limits come from the building's size. Reset view restores the default direction for the current view. |
| Signs | Each room sign follows the floor at its height (`byHeight: ["SIGNS 1-6"]`), so the first floor shows its 18 signs and the second floor its 19. Replaces 7a's "hide all signs" workaround (QA-70). |
| Attract screen | The sneak peek shows the real model. It turns slowly, opens onto the first floor with a sample route (EA-110) and its moving arrows, and closes again, 7 s per phase. The phases start once the model shows. The animated placeholder remains until then, and stays if the model can't load. The preview is decoration only: taps still open the kiosk. With reduced motion it neither turns nor cycles. |
| Performance | Both canvases draw on demand, only while something moves: a lift, the camera, the visitor, the route arrows, or the attract preview's turning. Animations are time-based, so they finish on schedule on slow devices. The attract preview renders at 1× pixel density. |

## Code

| File | Role |
|---|---|
| `client/src/lib/mapView.ts` (**new**, 13 unit tests) | Pure rules: which parts a view shows, a sign's floor by height, view labels, route length, poses along the route, arrow spacing, route visibility |
| `client/src/components/map/buildingModel.ts` (**new**) | Loads the model (local Draco decoder) and splits it into parts (exterior, each floor). Each part gets its own material copies so it can fade on its own. `applyLift` raises and fades a part in world space. |
| `client/src/components/map/BuildingScene.tsx` (**new**) | `BuildingModel` (animated parts), `CameraRig` (framing, glide, spin, isometric lock), `Marker`, `RoutePath` (line, instanced chevrons, arrowhead), `ModelErrorBoundary` |
| `client/src/components/map/AttractPreview.tsx` (**new**) | The attract screen's model preview |
| `client/src/components/BuildingFloorMap.tsx` | Rewritten as the kiosk wrapper: view state, tap to open, floor buttons, hints, the unavailable-map message |
| `client/src/data/navigation.ts`, `eyaNavigation.ts` | **Changed config shape:** `model` (`exterior`, `floors` with elevations, `byHeight`), `kioskFloor`, `Destination.modelFloor`. `camera` keeps only `position`/`target` (the direction) and `near`/`far`; `fitWidth`, `fitHeight`, `minZoom`, `maxZoom`, `maxPolarAngle` and 7a's `hiddenObjects` are removed, and framing is computed instead. |
| `client/src/pages/experience/AttractionPage.tsx` | Uses `AttractPreview`; the placeholder stays until the model is ready |
| `client/src/data/README.md` | How to describe a building's model and floors |

Floor heights (walking surfaces, from `EYA.glb`): 1F 0.93, 2F 4.42, 3F 8.00,
4F 11.52, 5F 15.08, 6F 18.53 m.

## Not in this step

- Destinations and routes on floors 2–6 need Map Annotation and the
  Navigation API (QA-73).
- The Area level of the back navigation (one building so far), and the
  Location Details sidebar (QA-26).
- Smoothness on the iPad itself (QA-74).
