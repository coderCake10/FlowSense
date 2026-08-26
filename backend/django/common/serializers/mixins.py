"""
common/serializers/mixins.py

Small, dumb, reusable serializer mixins. Nothing in this file may perform a
database query, aggregation, or derived calculation — mixins here only
declare/shape fields. Anything that needs to *compute* something belongs in
a service function that the view calls before handing data to the
serializer.
"""
from rest_framework import serializers


class TimestampedSerializerMixin(serializers.Serializer):
    """
    Adds the standard read-only created_at/updated_at pair used by almost
    every FlowSense table. Mix this into a ModelSerializer for models that
    have both columns.
    """

    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)


class SoftDeleteExcludedMixin:
    """
    Marker mixin only — documents that a serializer intentionally never
    exposes `deleted_at`.

    NOTE (business logic): filtering out soft-deleted rows (`deleted_at IS
    NULL`) is a queryset concern, not a serializer concern. It belongs on
    the model manager or the view's `get_queryset()`, not here.
    """

    pass