"""
common/db.py

choice_check() builds the database CHECK constraint the schema specifies for a
choices field (architecture-notes-main/06 Database: `CHECK (col IN (...))`).

The allowed values are written out in each model's Meta because a nested Meta
class cannot see the model's CHOICES constants. config/tests.py asserts that
every chk_* constraint equals its field's choices, so the two cannot drift.
"""
from django.db import models


def choice_check(name: str, field: str, values, *, nullable: bool = False) -> models.CheckConstraint:
    condition = models.Q(**{f"{field}__in": list(values)})
    if nullable:
        condition |= models.Q(**{f"{field}__isnull": True})
    return models.CheckConstraint(condition=condition, name=name)
