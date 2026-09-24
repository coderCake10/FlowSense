# Adding a building map

The kiosk reads its selectable maps from `buildings.ts`. Each entry is a
`BuildingConfig` defined in `navigation.ts`; `eyaNavigation.ts` is a working example.
One entry represents one building/floor, with its own kiosk starting point.

1. Put your GLB in `client/public/models/`. Reference it as `/models/your-file.glb`.
2. Create a configuration file alongside `eyaNavigation.ts`. Copy the EYA
   configuration structure, then replace the ID, building/floor names, model URL,
   starting point, destinations, and camera settings with your own values.
3. Omit `kioskObject` if the model has no movable kiosk/person object. The
   "You are here" marker still appears at `start`. If supplied and found, the
   object moves to the start's X/Z coordinates while retaining its original
   world-space height. An absent object does not prevent the model from loading.
4. Import your configuration into `buildings.ts` and append it to `buildings`.
   The selector, labels, and destination list update automatically.

Use unique configuration IDs and unique destination IDs within each configuration.
Destination `building` and `floor` labels should match their configuration.
Route `points` use exported GLB world coordinates (Y up), with at least two
points: start at the kiosk and finish at the destination. Place the route slightly
above the floor and add corridor turns explicitly; routing is not automatic.

Camera `position` and `target` control the initial angle and center. `fitWidth`
and `fitHeight` control visible world-space extents (larger values zoom out).
Adjust clipping distances and zoom limits for the model's scale. These values
are manually configured, not inferred from the GLB.

Changing the selection clears search, destination, active navigation, keyboard,
queue, and QR handoff, and resets the map view. The kiosk's QR code encodes the
building ID and destination IDs, and the phone resolves them against this same
registry. **Renaming a configuration ID or destination ID invalidates any QR
codes already issued for it.**

After registering a model, run `npm run check` and `npm run build` from the
frontend directory. In the kiosk, verify framing, corridor routes, queue, the QR handoff on a phone,
reset view, and switching away from and back to each building.
