"""
Date ranges for the Analytics API (OpenAPI AnalyticsDateRangeParam):

    ?range=today | last_7_days (default) | last_30_days
    ?range=semester&semester_id=<id>
    ?range=custom&start_date=<date or date-time>&end_date=<date or date-time>

Days are local days (settings.TIME_ZONE).
"""
from dataclasses import dataclass
from datetime import datetime, time, timedelta

from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework.exceptions import ValidationError

MAX_DAYS = 366
PRESETS = ("today", "last_7_days", "last_30_days", "semester", "custom")


@dataclass
class DateRange:
    key: str
    start: datetime
    end: datetime

    @property
    def days(self):
        """Every local date in the range, oldest first."""
        first = timezone.localtime(self.start).date()
        last = timezone.localtime(self.end).date()
        return [first + timedelta(days=i) for i in range((last - first).days + 1)]

    def as_dict(self):
        return {"key": self.key, "start": self.start, "end": self.end}


def _local_midnight(day):
    return timezone.make_aware(datetime.combine(day, time.min))


def _parse_moment(value, name, end_of_day=False):
    moment = parse_datetime(value)
    if moment is None:
        day = parse_date(value)
        if day is None:
            raise ValidationError({name: "Use a date (2026-09-24) or an ISO 8601 date and time."})
        moment = _local_midnight(day) + (timedelta(days=1) - timedelta(microseconds=1) if end_of_day else timedelta())
    elif timezone.is_naive(moment):
        moment = timezone.make_aware(moment)
    return moment


def parse_range(params, now=None):
    now = now or timezone.now()
    key = params.get("range", "last_7_days")
    if key not in PRESETS:
        raise ValidationError({"range": f"Use one of: {', '.join(PRESETS)}."})
    today = timezone.localtime(now).date()
    if key == "today":
        return DateRange(key, _local_midnight(today), now)
    if key in ("last_7_days", "last_30_days"):
        days = 7 if key == "last_7_days" else 30
        return DateRange(key, _local_midnight(today - timedelta(days=days - 1)), now)
    if key == "semester":
        from common.models import Semester

        semester = Semester.objects.filter(pk=params.get("semester_id") or 0).first()
        if semester is None:
            raise ValidationError({"semester_id": "Choose an existing semester."})
        return DateRange(key, _local_midnight(semester.start_date),
                         _local_midnight(semester.end_date + timedelta(days=1)) - timedelta(microseconds=1))
    if not params.get("start_date") or not params.get("end_date"):
        raise ValidationError({"start_date": "A custom range needs start_date and end_date."})
    start = _parse_moment(params["start_date"], "start_date")
    end = _parse_moment(params["end_date"], "end_date", end_of_day=True)
    if start > end:
        raise ValidationError({"end_date": "The end can't be before the start."})
    if (end - start).days > MAX_DAYS:
        raise ValidationError({"end_date": f"A range can cover at most {MAX_DAYS} days."})
    return DateRange(key, start, end)
