"""
idx_rooms_search from the schema (06 Database): a GIN full-text index over
room code, alias, and description. The expression matches the one
search.services builds with SearchVector(..., config="simple"), so room
searches can use it.
"""
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("map", "0002_spec_check_constraints")]
    operations = [
        migrations.RunSQL(
            sql="""
                CREATE INDEX IF NOT EXISTS idx_rooms_search
                ON campus.rooms
                USING GIN (
                    to_tsvector(
                        'simple',
                        coalesce(room_code, '') || ' ' ||
                        coalesce(room_alias, '') || ' ' ||
                        coalesce(description, '')
                    )
                );
            """,
            reverse_sql="DROP INDEX IF EXISTS campus.idx_rooms_search;",
        ),
    ]
