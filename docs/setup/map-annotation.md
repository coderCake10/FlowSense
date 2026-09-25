# Annotating a floor (Map Annotation)

The kiosk finds routes over a network of points placed on the building
model. Each point is a navigation node, and each connection between two
points is an edge. The Navigation API searches this network, and it only
knows what has been placed here. This guide covers the admin page
**Map Annotation**.

Every change saves straight away. The header shows "Saving…" and then
"All changes saved".

## The points

| Tool | What it places | Colour |
|---|---|---|
| **Corridor point** | A point along the middle of a corridor. Click in walking order; each new point connects to the previous one. Click an existing point to continue from it (and join it up). **Start a new line** begins a separate line. | Gold |
| **Room door** | The end of a route to a room. Pick the room in *Rooms on this floor*, then click the corridor side of its door. The door connects to the last point you placed. | Blue |
| **Kiosk** | Where the kiosk stands. Routes start here. | Navy |
| **Connect** | Click two points to connect them, for example to close a loop. | |
| **Stairs / elevator** | Links two floors. Click the stairs point on this floor, switch floors with the floor buttons, then click the matching point there. | Purple ring |
| **Delete** | Click a point to delete it, with its connections. | |

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

## Which kiosk point a kiosk uses

A kiosk device uses the node chosen for it on the **Hardware** page
(*Map node*). If none is chosen, it uses the only kiosk point on its floor,
or the only one in the building.

## The first floor's starter network

`python manage.py seed_eya_routes` loads the three original first-floor
routes (kiosk to EA-101A, EA-110 and EA-111). Their points are tagged, so
re-running the command resets them without touching anything placed here.
They can be edited or deleted like any other point.

## Coordinates

Points are stored in metres, in the model's own coordinates: x, then −z,
then height (EPSG:3857 numbers, not map longitude and latitude). See
`backend/django/apps/navigation/coordinates.py`.
