"""
A Building rooms, transcribed from the "Data gathering" document (A building
section), checked against the room signs in the team's model (A BUILDING4).

Conventions follow the EYA seed (seed_data/eya.py):
- Room codes are "A-" + the room number, keeping a letter as part of the
  number (A-211B). The document's "406" is A-406 (the model's sign reads A-406).
- Rooms with no name in the document are called "Room A-###"; their
  description is UNNAMED_DESCRIPTION.
- Names without a room number in the document (Cabalen Hall's other doors,
  Cashier 1-3, Windows 4-5, Administrative Service, Pioneer Office, Props &
  Costume Room, the restrooms) aren't rooms here: the kiosk searches rooms by
  code. A-108's and A-109's names come from their signs (Board Room, AUF
  Bookstore).
- A-401 and A-412 are in the document but have no sign in the model: they
  are seeded, and have no route until their doors are placed in Map
  Annotation.
"""

BUILDING = {"code": "A", "name": "A Building", "area_type": "building"}

UNNAMED_DESCRIPTION = "Office or classroom"

FLOORS = {1: "First floor", 2: "Second floor", 3: "Third floor", 4: "Fourth floor"}

# Each floor's group in the 3D model (A.glb) and its walking-surface height in
# metres in the model's own coordinates (the slab tops, measured).
FLOOR_MODEL = {
    1: ("FLOOR_1", "0.00"),
    2: ("FLOOR_2", "3.60"),
    3: ("FLOOR_3", "7.00"),
    4: ("FLOOR_4", "10.05"),
}

# Where the A Building stands in the campus (the EYA model's coordinates,
# glTF: metres, Y up): its model is turned `rotation_y` radians about the
# vertical axis, then moved by `position`. Navigation points are stored in
# campus coordinates, so routes can run from building to building.
# seed_campus sets it on the area when none is set; after that Map
# Annotation's Campus view moves it (map.placement.place_building). The
# kiosk's offline fallback is A_PLACEMENT in client/src/data/aNavigation.ts.
PLACEMENT = {"position": (-189.35, 3.2, 133.44), "rotation_y": 1.5708}

# (code, alias, room_type, document label)
ROOMS = {
    1: [
        ("A-101", "Accounts Management", "office", "A-101 - Accounts Management"),
        ("A-102", "Payroll and Benefits", "office", "A-102 - Payroll and Benefits"),
        ("A-103", "Accounting and Finance Office", "office", "A-103 - Accounting & Finance Office"),
        ("A-104", "Reception Room", "office", "A-104 - Reception Room"),
        ("A-106", "Office of the Chancellor Emeritus", "office", "A-106 - Office of Chancellor Emeritus"),
        ("A-107", "Room A-107", "room", None),
        ("A-108", "Board Room", "room", "A-108 (sign: Board Room)"),
        ("A-109", "AUF Bookstore", "office", "A-109 - Bookstore"),
        ("A-110", "Cabalen Hall", "room", "A-110 Cabalen Hall"),
        ("A-111", "Room A-111", "room", None),
    ],
    2: [
        ("A-201", "Room A-201", "room", None),
        ("A-203", "University Registrar and Admissions", "office", "A-203 - University Registrar and Admissions"),
        ("A-204", "Office of the Vice President for Academic Affairs", "office",
         "A-204 - Office of the Vice President Academic Affairs"),
        ("A-205", "Human Resource Development Center", "office", "A-205 - Human Resource Development Center"),
        ("A-206", "Office of the Vice President for Administration", "office",
         "A-206 - Office of the Vice President Administration"),
        ("A-207", "Room A-207", "room", "A-207 - (CDFO Office moved to Room A-301)"),
        ("A-208", "Student Affairs and Financial Aid", "office", "A-208 - Student Affairs and Financial Aid"),
        ("A-209", "CCFP Campus Ministry", "office", "A-209 - CCFP Campus Ministry"),
        ("A-210", "Center for Christian Formation and Praxis (CCFP)", "office",
         "A-210 - Center for Christian Formation and Praxis (CCFP)"),
        ("A-211", "CCFP Christian Praxis", "office", "A-211 - CCFP Christian Praxis"),
        ("A-211B", "Internal Auditor", "office", "A-211B - Internal Auditor"),
        ("A-212", "Purchasing and Supply Office", "office", "A-212 - Purchasing & Supply Office"),
        ("A-213", "Center for Data Analytics, Information, and Computing (CDAIC) and "
                  "Center for Advanced Research in Education (CARE)", "office",
         "A-213 - Center for Data Analytics, Information, and Computing (CDAIC)/"
         "Center for Advance Research in Education (Care)"),
        ("A-214", "Center for Culture and the Arts", "office", "A-214 - Center for Culture & the Arts"),
    ],
    3: [
        ("A-301", "Room A-301", "office", "A-301 - CDFO Office (moved from A-207)"),
        ("A-302", "Room A-302", "room", None),
        ("A-303", "Guidance and Counseling Center", "office", "A-303 - Guidance & Counseling Center"),
        ("A-304", "Campus Faculty Development Office", "office", "A-304 - Campus Faculty Development Office"),
        ("A-305", "Office of the Vice President for Research and Innovation", "office",
         "A-305 - Office of the Vice President for Research and Innovation (OVPIR)"),
        ("A-306", "Room A-306", "room", None),
        ("A-307", "Alumni Affairs and Placement Services", "office", "A-307 - Alumni Affairs and Placement Services"),
        ("A-308", "Room A-308", "room", None),
        ("A-309", "AUF Ethics Review Committee", "office",
         "A-309 - Angeles University Foundation Ethics Review Committee (AUF- ERC)"),
        ("A-310", "235th Department of Air Science and Tactics", "office",
         "A-310 - 235th Department of Air Science and Tactics"),
        ("A-311", "Room A-311", "room", None),
        ("A-312", "Room A-312", "room", None),
        ("A-313", "Room A-313", "room", None),
        ("A-314", "Room A-314", "room", None),
        ("A-315", "Room A-315", "room", None),
        ("A-316", "Room A-316", "room", None),
    ],
    4: [
        ("A-401", "Management Information System Service", "office", "A-401 - Management Information System Service"),
        ("A-402", "Room A-402", "room", None),
        ("A-403", "Room A-403", "room", None),
        ("A-404", "University Radio Station, Department of Communication and Smart Wireless Laboratory",
         "office", "A-404 University Radio Station/Department of Communication/Smart Wireless Laboratory"),
        ("A-406", "Room A-406", "room", "406"),
        ("A-407", "Room A-407", "room", None),
        ("A-408", "USC-CSC Office", "office", "A-408 USC-CSC Office"),
        ("A-412", "Rehearsal Room", "room", "A-412 - Rehearsal Room"),
    ],
}

ENTRANCES = [
    {"name": "A Building front entrance", "entrance_type": "entrance", "is_primary": True},
]

# The navigation network (A's corridors, doors and stairs) is generated into
# a_navigation.json by frontend/scripts/blender/build_navigation.py and loaded
# by `python manage.py seed_a_routes`, with the walk below.
NAVIGATION_FILE = "a_navigation.json"

# The campus's walkways: an outdoor area with one level, holding the walk
# between the buildings.
WALKWAYS = {"code": "AUF-WALKWAYS", "name": "Campus walkways", "area_type": "outdoor"}

# The walk from the EYA Building's front doors to the A Building's front gate:
# along MacArthur Highway's north side, over the overpass, and along its south
# side. Campus coordinates (glTF: metres, Y up), 0.1 m above the ground of the
# campus model (CAMPUS.glb) and the overpass deck; each line was checked clear
# of the model's buildings and trees. (key, name, position), in walking order.
WALK_EYA_DOOR = ("eya-front-door", "EYA front doors", (0.0, 1.027, 34.0))
WALK = [
    ("eya-front-steps", "EYA front steps", (0.0, 1.27, 39.5)),
    ("highway-north-1", "MacArthur Highway, north side 1", (-26.0, 1.28, 45.5)),
    ("highway-north-2", "MacArthur Highway, north side 2", (-60.0, 1.81, 45.5)),
    ("overpass-north-stairs", "Overpass stairs (north)", (-87.5, 2.37, 42.0)),
    ("overpass-north", "Overpass (north end)", (-81.1, 5.5, 40.5)),
    ("overpass-south", "Overpass (south end)", (-81.4, 5.5, 73.5)),
    ("overpass-south-stairs", "Overpass stairs (south)", (-88.0, 2.31, 76.5)),
    ("highway-south-1", "MacArthur Highway, south side 1", (-100.0, 2.72, 76.0)),
    ("highway-south-2", "MacArthur Highway, south side 2", (-151.0, 3.06, 75.0)),
    ("highway-south-3", "MacArthur Highway, south side 3", (-159.0, 3.22, 71.0)),
    ("a-front-gate", "A Building front gate", (-187.85, 3.3, 70.0)),
]
