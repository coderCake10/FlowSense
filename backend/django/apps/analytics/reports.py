"""
Analytics reports (Analytics page, "Reports and Exports"; QA-65).

A report is a snapshot: when it's generated, each chosen section is built
from the same metrics as the Analytics API (analytics.metrics) and stored in
analytics.reports.data. Downloads render that snapshot, so a report always
shows the figures of the day it was made.

The contents vary with the data, so a report is a list of self-describing
blocks, not a fixed layout:

    {"format_version": 1, "title": …, "period": {"start", "end"},
     "generated_at": …, "generated_by": …,
     "sections": [{"id", "title", "blocks": [
         {"kind": "metrics", "title", "items": [{"label", "value", "unit"}]},
         {"kind": "table",   "title", "columns": [{"key", "label", "unit"}], "rows": [{…}]},
         {"kind": "note",    "text"}
     ]}]}

A table with no rows carries `empty` (why it's empty); figures the system
doesn't record yet come through as notes, never as zeros. The page and the
CSV export draw whatever blocks are there, so a new section only needs a
builder here.
"""
from __future__ import annotations

import csv
import io
import re
import zipfile
from datetime import date, datetime

from django.utils import timezone

from analytics import metrics
from analytics.ranges import DateRange

FORMAT_VERSION = 1
NO_DATA = "No data in this period."


# Blocks ------------------------------------------------------------------------

def _metrics(title, items):
    return {"kind": "metrics", "title": title,
            "items": [{"label": label, "value": value, "unit": unit} for label, value, unit in items]}


def _table(title, columns, rows, empty=NO_DATA):
    block = {"kind": "table", "title": title,
             "columns": [{"key": key, "label": label, "unit": unit} for key, label, unit in columns],
             "rows": rows}
    if not rows:
        block["empty"] = empty
    return block


def _notes(not_collected):
    return [{"kind": "note", "text": text} for text in dict.fromkeys((not_collected or {}).values())]


# Sections ----------------------------------------------------------------------

def _search(r):
    m = metrics.search(r)
    t = m["totals"]
    return [
        _metrics("Search activity", [
            ("Total searches", t["total"], None),
            ("Successful", t["successful"], None),
            ("Failed", t["failed"], None),
            ("Success rate", t["success_rate"], "%"),
            ("Average search time", m["latency_ms"]["average"], "ms"),
            ("95th percentile search time", m["latency_ms"]["p95"], "ms"),
        ]),
        _table("Searches per day",
               [("date", "Date", None), ("successful", "Successful", None), ("failed", "Failed", None),
                ("success_rate", "Success rate", "%")],
               m["trend"] if t["total"] else []),
        _table("Most frequent failed searches",
               [("query", "Search", None), ("failures", "Failures", None), ("last_occurrence", "Last seen", None)],
               m["failed_queries"], "No failed searches in this period."),
    ]


def _navigation(r):
    m = metrics.navigation(r)
    q, routes = m["queues"], m["routes"]
    lengths = routes["average_length_m"]
    return [
        _metrics("Navigation and queues", [
            ("Navigation requests", q["navigation_requests"], None),
            ("Queues (several stops)", q["queue_usage"], None),
            ("Average queue size", q["average_queue_size"], "stops"),
            ("Single destination", q["single_destination_percent"], "%"),
            ("Multiple destinations", q["multi_destination_percent"], "%"),
            ("Routes generated successfully", q["route_generation_success_percent"], "%"),
            ("Average route length", lengths["all"], "m"),
        ]),
        _table("Top destinations",
               [("rank", "Rank", None), ("name", "Destination", None), ("room_code", "Room", None),
                ("requests", "Requests", None)],
               m["top_destinations"]),
        _table("Most common routes",
               [("origin", "From", None), ("destination", "To", None), ("count", "Times", None)],
               routes["most_common"]),
        _table("Most common queue orders",
               [("sequence", "Stops in order", None), ("count", "Times", None)],
               [{"sequence": " → ".join(row["sequence"]), "count": row["count"]} for row in q["common_sequences"]],
               "No multi-stop queues in this period."),
        *_notes(m["not_collected"]),
    ]


def _kiosks(r):
    m = metrics.kiosks(r)
    s = m["sessions"]
    return [
        _metrics("Kiosk sessions", [
            ("Sessions", s["total"], None),
            ("Average session length", s["average_seconds"], "s"),
        ]),
        _table("Kiosk use per day",
               [("date", "Date", None), ("sessions", "Sessions", None), ("searches", "Searches", None)],
               m["usage_over_time"] if s["total"] else []),
        _table("Kiosk use by hour",
               [("hour", "Hour", None), ("sessions", "Sessions", None), ("searches", "Searches", None)],
               [row for row in m["usage_by_hour"] if row["sessions"] or row["searches"]]),
        _table("Kiosk availability",
               [("name", "Kiosk", None), ("availability_percent", "Online", "%")],
               m["availability"], "No registered kiosks."),
    ]


def _qr(r):
    m = metrics.qr(r)
    t, h = m["totals"], m["handoff_seconds"]
    return [
        _metrics("QR handoff", [
            ("QR codes shown", t["generated"], None),
            ("Scanned", t["scanned"], None),
            ("Scan rate", t["scan_rate"], "%"),
            ("Average handoff time", h["average"], "s"),
            ("Median handoff time", h["median"], "s"),
            ("Longest handoff time", h["longest"], "s"),
        ]),
        _table("QR codes per day",
               [("date", "Date", None), ("generated", "Shown", None), ("scanned", "Scanned", None),
                ("scan_rate", "Scan rate", "%")],
               m["over_time"] if t["generated"] or t["scanned"] else []),
        _table("QR codes by kiosk",
               [("name", "Kiosk", None), ("generated", "Shown", None), ("scanned", "Scanned", None),
                ("scan_rate", "Scan rate", "%")],
               m["by_kiosk"]),
    ]


def _sensors(r):
    m = metrics.sensors(r)
    o = m["overall"]
    return [
        _metrics("Sensor reliability", [
            ("Readings expected", o["expected"], None),
            ("Readings received", o["received"], None),
            ("Reliability", o["reliability_percent"], "%"),
        ]),
        _table("Sensors",
               [("name", "Sensor", None), ("location", "Location", None), ("expected", "Expected", None),
                ("received", "Received", None), ("reliability_percent", "Reliability", "%"),
                ("average_density", "Average density", None), ("peak_density", "Peak density", None)],
               m["sensors"], "No registered sensors."),
    ]


def _spatial(r):
    m = metrics.spatial(r)
    c = m["crowd_density"]
    return [
        _metrics("Crowd density", [
            ("Average density", c["average"], None),
            ("Level", c["level"], None),
        ]),
        _table("Busiest locations",
               [("location", "Location", None), ("sensor", "Sensor", None),
                ("average_density", "Average density", None), ("average_level", "Average level", None),
                ("peak_density", "Peak density", None), ("peak_level", "Peak level", None),
                ("readings", "Readings", None)],
               m["busiest_locations"], "No sensor readings in this period."),
        *_notes(m["not_collected"]),
    ]


def _system(r):
    m = metrics.system(r)
    lat = m["latency_ms"]
    return [
        _metrics("System performance", [
            ("Average search time", lat["search_api"]["average"], "ms"),
            ("95th percentile search time", lat["search_api"]["p95"], "ms"),
            ("Average route calculation time", lat["pathfinding"]["average"], "ms"),
            ("95th percentile route calculation time", lat["pathfinding"]["p95"], "ms"),
            ("Sensor reliability", m["sensor_reliability"]["reliability_percent"], "%"),
        ]),
        *_notes(m["not_collected"]),
    ]


def _activity(r):
    m = metrics.activity(r)
    busy = any(
        any(v for k, v in row.items() if k != "date") for row in m["days"]
    )
    return [
        _table("Daily activity",
               [("date", "Date", None), ("kiosk_sessions", "Kiosk sessions", None), ("searches", "Searches", None),
                ("successful_searches", "Successful", None), ("navigation_requests", "Routes", None),
                ("queues", "Queues", None), ("qr_generated", "QR shown", None), ("qr_scanned", "QR scanned", None),
                ("admin_actions", "Admin actions", None)],
               m["days"] if busy else []),
    ]


# id → (title, builder). The order is the report's order.
SECTIONS = {
    "search": ("Search", _search),
    "navigation": ("Navigation and routes", _navigation),
    "kiosks": ("Kiosks", _kiosks),
    "qr": ("QR handoff", _qr),
    "sensors": ("Sensors", _sensors),
    "spatial": ("Crowd density", _spatial),
    "system": ("System performance", _system),
    "activity": ("Daily activity", _activity),
}


def period_label(start: datetime, end: datetime) -> str:
    """"Sep 20, 2026 to Sep 26, 2026" in the server's time zone, so every
    viewer sees the days the report was made for, wherever their browser is."""
    first, last = timezone.localtime(start).date(), timezone.localtime(end).date()
    return f"{first:%b} {first.day}, {first.year} to {last:%b} {last.day}, {last.year}"


def build(section_ids, start: datetime, end: datetime, title: str, generated_by: str | None) -> dict:
    """The report snapshot for these sections over [start, end]."""
    r = DateRange("custom", start, end)
    sections = []
    for section_id in SECTIONS:
        if section_id not in section_ids:
            continue
        name, builder = SECTIONS[section_id]
        sections.append({"id": section_id, "title": name, "blocks": builder(r)})
    return {
        "format_version": FORMAT_VERSION,
        "title": title,
        "period": {"start": start, "end": end, "label": period_label(start, end)},
        "generated_at": timezone.now(),
        "generated_by": generated_by,
        "sections": sections,
    }


# CSV ----------------------------------------------------------------------------

def _cell(value):
    if value is None:
        return ""
    if isinstance(value, datetime):
        return timezone.localtime(value).strftime("%Y-%m-%d %H:%M")
    if isinstance(value, str) and re.match(r"^\d{4}-\d{2}-\d{2}T", value):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return timezone.localtime(parsed).strftime("%Y-%m-%d %H:%M")
    if isinstance(value, date):
        return value.isoformat()
    return value


def _slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40]


def csv_zip(report) -> bytes:
    """A ZIP of one CSV per table and figures block, plus summary.csv. Sections
    have different columns, so one CSV per block opens cleanly in Excel."""
    data = report.data or {}
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        def write(name, rows):
            text = io.StringIO()
            writer = csv.writer(text)
            writer.writerows(rows)
            # Excel reads UTF-8 CSV correctly with a byte-order mark.
            archive.writestr(name, "﻿" + text.getvalue())

        period = data.get("period", {})
        summary = [
            ["Report", data.get("title", "")],
            ["Period start", _cell(period.get("start"))],
            ["Period end", _cell(period.get("end"))],
            ["Generated", _cell(data.get("generated_at"))],
            ["Generated by", data.get("generated_by") or ""],
            ["Sections", ", ".join(s["title"] for s in data.get("sections", []))],
        ]
        notes = []
        index = 0
        for section in data.get("sections", []):
            for block in section["blocks"]:
                if block["kind"] == "note":
                    notes.append([section["title"], block["text"]])
                    continue
                index += 1
                name = f"{index:02d}-{_slug(section['title'])}-{_slug(block['title'])}.csv"
                if block["kind"] == "metrics":
                    write(name, [["Figure", "Value", "Unit"]] + [
                        [item["label"], _cell(item["value"]), item["unit"] or ""] for item in block["items"]
                    ])
                else:
                    columns = block["columns"]
                    header = [c["label"] + (f" ({c['unit']})" if c["unit"] else "") for c in columns]
                    rows = [[_cell(row.get(c["key"])) for c in columns] for row in block["rows"]]
                    if not rows:
                        rows = [[block.get("empty", NO_DATA)]]
                    write(name, [header] + rows)
        if notes:
            summary.append([])
            summary.append(["Not recorded yet", ""])
            summary.extend(notes)
        write("00-summary.csv", summary)
    return buffer.getvalue()
