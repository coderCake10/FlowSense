"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path

# Every API route lives under /api/v1/, as specified in
# architecture-notes-main/07 API/00 API Design.md. Paths may be called with
# or without a trailing slash (see common.middleware.ApiTrailingSlashMiddleware).
urlpatterns = [
    path('admin/', admin.site.urls),
    # Authentication API (/auth/*) and Users API (/users) share one app.
    path('api/v1/', include('authentication.urls')),
    path('api/v1/map/', include('map.urls')),
    path('api/v1/navigation/', include('navigation.urls')),
    path('api/v1/search/', include('search.urls')),
    path('api/v1/annotations/', include('annotation.urls')),
    path('api/v1/sessions/', include('fs_sessions.urls')),
    path('api/v1/hardware/', include('hardware.urls')),
]
