# Step 8d: Phone handoff, following the team's wireframe

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Requested by the team (2026-09-25) | Wireframe "Mobile Handoff": loading page, navigation checklist with step-by-step directions and distances, Bluetooth states, and a "You've reached …" confirmation. Use its content and flow, in the app's own design. |
| Scope | Phone page (`/mobile`), the QR payload, the kiosk's route requests (read only) |
| Test report | [step-08d-test-report.md](../qa/step-08d-test-report.md) |

## What changed

| Wireframe | Now |
|---|---|
| Loading page ("Preparing your route", progress bar) | Shown while the phone loads the kiosk's routes. The kiosk now puts each routed stop's Navigation API route id in the QR link (`t` in the payload). The phone reads them with `GET /navigation/routes/{id}`, which only returns an existing route, so the visit isn't logged twice. A route that can't be loaded falls back to the stop's built-in route, or to "follow the room signs". |
| Checklist of steps with distances | The current stop lists directions worked out from the route's shape: "Start at the kiosk · walk about 5 m", "Turn left · walk about 41 m", "Go up to the third floor · take the stairs or the elevator", "Arrive at EA-110". Turns come from the angle between straight runs seen from above; bends under 30° and jogs under 1.5 m count as straight on (`lib/routeSteps.ts`). The route sketch stays above the steps, with a legend. |
| Bluetooth on/off, "Detect Nearby Sensor" | A status row: "Confirm each stop yourself. Sensor arrival detection isn't available on phones yet." See below. |
| "Sensor detected: You've reached Guidance Office", Not yet / Yes, continue | The arrival dialog reads "Have you reached …?", shows the room and floor, and offers **Not yet** / **Yes, continue** (**Yes, finish** on the last stop). |

## Not built: Bluetooth arrival detection

A web page can't do what the wireframe's Bluetooth parts need:

- **iPhone:** no browser on an iPhone lets a web page use Bluetooth; Apple blocks it.
- **Android Chrome:** Web Bluetooth works, but only after a tap and a device-picker popup. It can't notice a nearby sensor in the background.
- **Firmware:** the ESP32s would also need to broadcast a Bluetooth signal, which the current firmware doesn't; it publishes over Wi-Fi/MQTT.

Arrival stays manual, and the page says so. The confirmation dialog is where automatic detection would plug in (`POST /sessions/{id}/destinations/{destination_id}/reach` in 07 API, once the QR Session API exists, QA-66).

## Files

| File | Role |
|---|---|
| `frontend/client/src/lib/routeSteps.ts` (**new**), `routeSteps.test.ts` | Directions from a route |
| `frontend/client/src/lib/handoff.ts`, `handoff.test.ts` | `t`: route ids in the QR payload |
| `frontend/client/src/lib/kioskDirectory.ts` | Keeps the route id; `fetchSavedRoute` |
| `frontend/client/src/data/navigation.ts` | `Destination.routeId` |
| `frontend/client/src/pages/experience/MobilePage.tsx` | Loading page, directions, status row, dialog |
| `frontend/e2e/step8d.qa.mjs` (**new**) | Kiosk → phone with a real route |
| `frontend/e2e/step2.qa.mjs` | Updated for the new wording |
