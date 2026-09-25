# Adding a building map

The kiosk reads its selectable maps from `buildings.ts`. Each entry is a
`BuildingConfig` defined in `navigation.ts`; `eyaNavigation.ts` is a working example.
One entry represents one building and the kiosk that stands in it.

1. Export the building's `.glb` into `client/public/models/` and list it in
   `models.ts` (see `docs/setup/building-models.md`).
2. Create a configuration file alongside `eyaNavigation.ts`. Copy the EYA
   configuration structure, then replace the ID, names, model URL, starting
   point, floors, destinations, and camera direction with your own values.
3. Describe the model in `model`, using object names as they are in Blender:
   - `exterior`: the objects that lift away when a visitor taps the
     building, such as the shell and the roof.
   - `floors`: the floor groups from bottom to top (`FLOOR_1` …), each with a
     button label (`1F`), a spoken name, and its walking-surface height in
     metres. Measure the height from the floor slab's top.
   - `byHeight` (optional): groups whose children belong to different floors,
     for example one group holding every room sign. Each child follows the
     floor it sits on, by height.
4. Set `kioskFloor` to the floor the kiosk stands on. A destination on
   another floor sets `modelFloor`.
5. Omit `kioskObject` if the model has no movable kiosk/person object. The
   "You are here" marker still appears at `start`. If supplied and found, the
   object moves to the start's X/Z coordinates while retaining its original
   world-space height. An absent object does not prevent the model from loading.
6. Import your configuration into `buildings.ts` and append it to `buildings`.
   The selector, labels, floor buttons and destination list update
   automatically.

Use unique configuration IDs and unique destination IDs within each configuration.
Destination `building` and `floor` labels should match their configuration.
Route `points` use exported GLB world coordinates (Y up), with at least two
points: start at the kiosk and finish at the destination. Place the route slightly
above the floor and add corridor turns explicitly; routing is not automatic.

The map opens on the whole building. Tapping it, choosing a floor, or
choosing a destination lifts the exterior and the floors above away. Framing
is computed from the model. Camera `position` and `target` only set the
viewing direction: the angle from above stays fixed (isometric), and visitors
can turn around the building, pan, and zoom.

Changing the selection clears search, destination, active navigation, keyboard,
queue, and QR handoff, and resets the map view. The kiosk's QR code encodes the
building ID and destination IDs, and the phone resolves them against this same
registry. **Renaming a configuration ID or destination ID invalidates any QR
codes already issued for it.**

After registering a model, run `npm run check` and `npm run build` from the
frontend directory. In the kiosk, check:

- the whole-building view, and that tapping the building opens it
- every floor button
- the corridor routes and their arrows
- the queue and the QR handoff on a phone
- Reset view, and switching away from and back to each building
