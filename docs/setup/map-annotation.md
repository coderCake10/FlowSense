# Annotating a floor (Map Annotation)

The kiosk finds routes over a network of points placed on the building
model. Each point is a navigation node, and each connection between two
points is an edge. The Navigation API searches this network, and it only
knows what has been placed here. This guide covers the admin page
**Map Annotation**.

Every change saves straight away. The header shows "Saving…" and then
"All changes saved".

## Buildings

**Building** at the top picks a building with a live 3D model (the EYA and A
Buildings, and any added here), or **Campus (outdoors)** (next section). Each has its own floors, rooms and
points. The A Building's network comes from `seed_a_routes`, like EYA's from
`seed_eya_routes`: 46 rooms, three staircases (front left, front right, back)
and the front entrance (teal, the **Entrance** tool), where routes from the
EYA kiosk arrive.
A-401 and A-412 have no sign in the model: place their doors here.

The walk between the buildings (EYA front doors → MacArthur Highway →
overpass → A front gate) is outside both buildings, on the campus walkways:
edit it in the Campus view. A point joined to it lists "The walk outside
(campus walkways)" under *Selected point*. `seed_a_routes` loads it from
`backend/django/apps/map/seed_data/a_building.py` (`WALK`).

For the building shown, the right-hand side also has:

- **Add a room** (under *Rooms on this floor*): its number and, optionally,
  its name. The kiosk lists and searches it; place its door as usual.
  **Remove this room** is under *Room details* (its door point stays, as a
  plain point).
- **This floor**: the floor's button label ("1F") and name ("First
  floor"), which the kiosk shows, and **Add floor n**. For a building added
  here, also its **walking height** (the top of the slab: clicks and points
  sit on it). Making a new model version live resets that height to the
  model's lowest point on the floor, so check it afterwards.

## The campus

**Campus (outdoors)** shows the campus model with every building placed on
it. Its tools:

| Tool | What it does |
|---|---|
| **Walkway point** | Draws the walks between buildings: click along the walk in order (points land on the ground or the overpass deck, not on roofs). Click a building's entrance (teal) or the kiosk to join the walk to it. |
| **Connect**, **Delete**, **Select** (drag) | As on a floor. Points inside buildings can be joined, not deleted, here. |
| **Label** | Type the text under *Labels*, then click where it goes. Rename (click its name, Enter), **Move**, delete. The kiosk's campus view shows them. |
| **Place a building** | Under *Buildings on the campus*, **Move** (or **Place** for a new building), click where its model stands, turn it, set its ground height, **Save**. Its route points move with it; check the walk to its entrance afterwards. |

## Adding a building

1. **Add building** (next to the Building picker): its name, a short code
   (e.g. `B`; also used in its sensors' MQTT topic) and how many floors. Its
   floors are created as `FLOOR_1`, `FLOOR_2`, … It shows in the picker as
   "(upload its model first)".
2. **Asset Management → Upload model**, linked to the new building. The
   model needs one group per floor named `FLOOR_1`, `FLOOR_2`, … (see
   [building models](building-models.md)); validation checks it. **Make it
   live**.
3. Back here, **Campus (outdoors) → Place a building**: put it where it
   stands.
4. Pick the building: add its rooms, check each floor's walking height, place
   its **Entrance** (where routes into it arrive; the kiosk marks it),
   corridor points and doors, and link its floors with **Stairs / elevator**.
5. **Campus (outdoors)**: draw the walk from the nearest walkway point to its
   entrance.

The kiosk lists it from its next load, with its rooms, floors and routes.
Nothing in the code changes.

## The points

| Tool | What it places | Colour |
|---|---|---|
| **Corridor point** | A point along the middle of a corridor. Click in walking order; each new point connects to the previous one. Click an existing point to continue from it (and join it up). **Start a new line** begins a separate line. | Gold |
| **Room door** | The end of a route to a room. Pick the room in *Rooms on this floor*, then click the corridor side of its door. The door connects to the last point you placed. | Blue |
| **Kiosk** | Where the kiosk stands. Routes start here. | Navy |
| **Entrance** | Just inside a building's entrance, where routes from another building arrive (the A Building's front entrance). Connect it to the corridor. | Teal |
| **Connect** | Click two points to connect them, for example to close a loop. | |
| **Stairs / elevator** | Links two floors. Click the stairs point on this floor, switch floors with the floor buttons, then click the matching point there. | Purple ring |
| **Delete** | Click a point to delete it, with its connections. Click a line to delete just that connection. | |

Clicks land on the floor's walking surface, so room boxes, ceilings and the
atrium don't get in the way. Points stay the same size on screen at any
zoom. **Top down** is easiest for placing points; **Isometric** is for
checking.

## A floor, step by step

1. Choose the floor.
2. **Corridor point**: trace every corridor, clicking at each corner and
   junction. Keep points in the middle of the corridor. Routes follow them
   exactly, and the kiosk draws its arrows along them.
3. For each room in *Rooms on this floor*, click the room (its circle is
   empty while it isn't placed), then click the corridor side of its door.
   Place the doors while the nearest corridor point is the last one placed,
   or connect them afterwards with **Connect**.
4. At each staircase and elevator, place a corridor point and connect it
   to the corridor.
5. **Stairs / elevator**: link that point to the matching point on the
   floor above. For stairs, link each floor to the next (1F↔2F, 2F↔3F, …).
6. On the kiosk's floor, place the **Kiosk** point and connect it to the
   corridor.

When a room shows a green tick, the kiosk can route to it (if the network
connects it to the kiosk). *This building* counts the points, connections,
floor links, and placed rooms.

## Moving a point

With **Select**, press on a point and drag it: its connections follow, and it
saves when you let go ("All changes saved"). The camera holds still while a
point moves. A press without moving still just selects the point. Routes use
the new position straight away.

## Stairs or an elevator out of service

The **Stairs and elevators** panel lists each staircase and elevator in the
building, with a switch. Switch one off during maintenance: routes find
another way (the stairs instead of the elevator) straight away, and the
kiosk and phone tell visitors, for example "The elevator is out of service."
Switch it back on when it's working. The setting stays when
`seed_eya_routes` runs again.

## Removing a connection

Two ways, both leaving the points in place:

- With **Delete**, click the line itself.
- Select one of its points: *Selected point* lists its connections, each with
  **Remove**.

## Room details

The **Room details** panel (right side, under the room list) edits the room
you pick in the list, or the room whose door point you click:

| Field | What it is | Notes |
|---|---|---|
| Room number | The room code, e.g. EA-110 | Required, and unique on its floor. The door point is renamed to match. |
| Name (optional) | What the kiosk shows, e.g. "Office of the Dean" | Left blank, the room is called "Room EA-110". |
| Purpose (optional) | What is usually done in the room | Kiosk search finds rooms by these words too. |

Click **Save room details**. Changes are kept when `seed_campus` runs again.

Renumbering a room has side effects:
- The kiosk's built-in demo route for that room stops matching it.
- `seed_eya_routes` stops matching it: a re-run loads the generated door for the old number as a plain corridor point and lists the room, so place the renumbered room's door here.
- Re-running `seed_campus` adds the old number back as a new, unplaced room.

## Which kiosk point a kiosk uses

A kiosk device uses the node chosen for it on the **Hardware** page
(*Map node*). If none is chosen, it uses the only kiosk point on its floor,
or the only one in the building.

## The generated network

`python manage.py seed_eya_routes` loads the EYA Building's routes: corridor
centre lines, a door point for each of the 97 rooms, both stair cores and
the elevator on every floor, and the kiosk. They're generated from the 3D
model (`frontend/scripts/blender/build_navigation.py`; see
[building models](building-models.md#2c-the-navigation-network)). Their points
are tagged, so re-running the command resets them without touching anything
placed here. They can be edited or deleted like any other point.

A door placed here for a room wins: `seed_eya_routes` then keeps it, loads
its own door for that room as a plain corridor point, and names the room in
its output, so check the placed door is connected.

Place corridor points in the **middle of the walkway**, not along a wall.
The kiosk draws the route on top of everything so it's never hidden, so a
route beside a wall looks as if it runs on the wall.

An open floor is viewed more steeply than the whole building (62° from
the horizon instead of about 45°), so the walls in front hide less of the
corridors behind them.

## Coordinates

Points are stored in metres, in campus coordinates: the EYA model's own
coordinates, x, then −z, then height (EPSG:3857 numbers, not map longitude
and latitude). See `backend/django/apps/navigation/coordinates.py`. Every
other building's points are placed and shown on its own model, and stored in
campus coordinates by where it stands (its area's `placement`, set in the
Campus view), so one route can run from one building to another. Moving a
building moves its points with it (`backend/django/apps/map/placement.py`).
