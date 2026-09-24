from django.contrib import admin

from configuration.models import Semester, Setting

admin.site.register(Setting)
admin.site.register(Semester)
