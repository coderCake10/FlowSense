"""
EYA Building rooms, transcribed from the "EYA LABELS" document (Tab 1).

Conventions (confirmed by the team; see docs/changes/step-04b-database-conformance.md):
- Room codes are "EA-" + the room number, keeping a room's letter as part of
  its number: EA-110, EA-101A, EA-101B, EA-210A, EA-210B (the document mixes
  "101A", "EA - 201", and "EA301").
- Aliases expand abbreviations for search ("FC" -> "Faculty Center",
  "Psych" -> "Psychology"). The document's own wording is kept in
  `label` and stored as the room description, so nothing is lost.
- Rooms with no name in the document are lecture or laboratory rooms. They
  get "Room EA-###" as their alias (campus.rooms.room_alias is NOT NULL) and
  UNNAMED_DESCRIPTION as their description; they are searchable by code.
- CAS is "College of Arts and Sciences" (confirmed).
"""

CAMPUS = {"code": "AUF", "name": "Angeles University Foundation", "area_type": "campus"}
BUILDING = {"code": "EYA", "name": "EYA Building", "area_type": "building"}

# Description for rooms the document lists without a name (confirmed by the
# team: these are lecture or laboratory rooms).
UNNAMED_DESCRIPTION = "Lecture or laboratory room"

# Codes used by earlier seeds, renamed in place so re-seeding doesn't
# leave duplicates behind.
RENAMED_CODES = {
    "EA-101-A": "EA-101A",
    "EA-101-B": "EA-101B",
    "EA-210-A": "EA-210A",
    "EA-210-B": "EA-210B",
}

FLOORS = {1: "First floor", 2: "Second floor", 3: "Third floor", 4: "Fourth floor", 5: "Fifth floor", 6: "Sixth floor"}

# (code, alias, room_type, label from the document or None)
ROOMS = {
    1: [
        ("EA-101A", "Guidance and Counseling Center (Extension Office)", "office", "101A- Guidance and counseling center (extension office)"),
        ("EA-101B", "University Health Clinic", "facility", "101B - University Health Clinic"),
        ("EA-102", "Office of the Dean, College of Education", "office", "102 - Office of the Dean College of Education"),
        ("EA-103", "Office of the Dean, College of Criminal Justice Education", "office", "103 - Office of the Dean College of Criminal Justice Education"),
        ("EA-104", "Faculty Center, College of Engineering and Architecture", "office", "104 - FC College of Engineering and Architecture"),
        ("EA-105", "Office of the Dean, College of Engineering and Architecture", "office", "105 - Office of the Dean College of Engineering and Architecture"),
        ("EA-106", "Surveying, Fluid Mechanics, and Hydraulics Laboratory", "laboratory", "106 - Surveying, Fluid Mechanics, and Hydraulics Lab"),
        ("EA-107", "Supply and Instrument Room, Civil Engineering Laboratories", "service", "107 - Supply and Instrument Room Civil Engineering Laboratories"),
        ("EA-108", "Material Testing and Soil Mechanics Laboratory", "laboratory", "108 - Material Testing and Soil Mechanics Laboratory"),
        ("EA-109", "EYA CLI Canteen", "facility", "109 - EYA CLI Canteen"),
        ("EA-110", "Office of the Dean, College of Computer Studies", "office", "110 - Office of the Dean (CCS)"),
        ("EA-111", "Faculty Center, College of Computer Studies", "office", "111 - FC College of Computer Studies"),
        ("EA-112", "Faculty Center, College of Criminal Justice Education", "office", "112 - FC College of Criminal Justice Education"),
        ("EA-113", "Faculty Center, College of Education", "office", "113 - Faculty Center College of Education"),
        ("EA-114", "Room EA-114", "room", None),
    ],
    2: [
        *[(f"EA-{n}", f"Room EA-{n}", "room", None) for n in range(201, 207)],
        ("EA-207", "Office of the Dean, College of Arts and Sciences", "office", "EA - 207 (DEAN OFFICE OF CAS)"),
        ("EA-208", "Faculty Department of Social Sciences", "office", "EA - 208 (Faculty Department of Social Sciences)"),
        ("EA-209", "Faculty Department of Psychology", "office", "EA - 209 (Faculty Dept. of Psych)"),
        ("EA-210A", "Faculty Department of Communication", "office", "EA - 210A (Faculty Dept. of Comm)"),
        ("EA-210B", "Faculty Department of Mathematics", "office", "EA - 210B (Faculty Dept. of Mathematics)"),
        ("EA-211", "Teacher Resource Center", "facility", "EA - 211 (Teacher Resource Center)"),
        *[(f"EA-{n}", f"Room EA-{n}", "room", None) for n in range(212, 216)],
    ],
    3: [
        *[(f"EA-{n}", f"Room EA-{n}", "room", None) for n in range(301, 308)],
        ("EA-308", "Experimental Research Laboratory", "laboratory", "EA308 (Experimental Research Lab)"),
        ("EA-309", "Psychology Laboratory", "laboratory", "EA309 (Psych Lab)"),
        *[(f"EA-{n}", f"Room EA-{n}", "room", None) for n in range(310, 317)],
    ],
    4: [(f"EA-{n}", f"Room EA-{n}", "room", None) for n in range(401, 419)],
    5: [
        ("EA-501", "Room EA-501", "room", None),
        ("EA-502", "Electronics Laboratory", "laboratory", "EA - 502 - Electronics Laboratory"),
        ("EA-503", "Supply and Instrument Room, Digital and Electronics Laboratories", "service", "EA - 503 - Supply and Instrument Room/Digital and Electronics Laboratories"),
        ("EA-504", "Digital Laboratory", "laboratory", "EA - 504 - Digital Laboratory"),
        ("EA-505", "Open Room EA-505", "room", "EA - 505 - Open"),
        ("EA-506", "Open Room EA-506", "room", "EA - 506 - Open"),
        ("EA-507", "Drafting Studio 1", "laboratory", "EA - 507 - Drafting Studio - 1"),
        ("EA-508", "Material Studio", "laboratory", "EA - 508 - Material Studio"),
        ("EA-509", "Drafting Studio 2", "laboratory", "EA - 509 - Drafting Studio - 2"),
        ("EA-510", "Open Room EA-510", "room", "EA - 510 - Open"),
        ("EA-511", "Communications Laboratory", "laboratory", "EA - 511 - Communications Laboratory"),
        ("EA-512", "DSP/CAD Laboratory", "laboratory", "EA - 512 - DSP/CAD Laboratory"),
        ("EA-513", "Physics Laboratory", "laboratory", "EA - 513 - Physics Laboratory"),
        ("EA-514", "Supply and Instrument Room, Physics and Communication Laboratories", "service", "EA - 514 - Supply and Instrument Room/ Physics and Communication Laboratories"),
    ],
    6: [
        ("EA-601", "Room EA-601", "room", None),
        ("EA-602", "IT Laboratories Operations and Services Office", "office", "EA602 - IT Laboratories Operations and Services Office"),
        ("EA-603", "Data Innovation Laboratory", "laboratory", "EA603 - Data Innovation Lab"),
        ("EA-604", "Tech Productivity Laboratory", "laboratory", "EA604 - Tech Productivity Lab"),
        ("EA-605", "Digital Arts Laboratory", "laboratory", "EA605 - Digital Arts Lab"),
        ("EA-606", "Multimedia Production Laboratory", "laboratory", "EA606 - Multimedia Production Lab"),
        ("EA-607", "Forensic Science Laboratory", "laboratory", "EA607 - Forensic Science Lab"),
        ("EA-608", "Open Laboratory", "laboratory", "EA608 - Open Lab"),
        ("EA-609", "CCS Research Laboratory", "laboratory", "EA609 - CCS Research Lab"),
        ("EA-610", "App Development Laboratory", "laboratory", "EA610 - App Development Lab"),
        ("EA-611", "Web and Mobile Innovation Laboratory", "laboratory", "EA611 - Web and Mobile Innovation Lab"),
        ("EA-612", "IT Infrastructure and Networking Laboratory", "laboratory", "EA612 - IT Infrastructure and Networking Lab"),
        ("EA-613", "Hardware Laboratory", "laboratory", "EA613 - Hardware Lab"),
    ],
}

# First floor exits, in document order (positions to be set in Map Annotation).
ENTRANCES = [
    {"name": "EYA first floor exit near EA-109 (canteen)", "entrance_type": "exit", "is_primary": False},
    {"name": "EYA first floor exit near EA-106", "entrance_type": "exit", "is_primary": False},
]
