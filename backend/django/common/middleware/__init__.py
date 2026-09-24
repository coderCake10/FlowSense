"""
common/middleware

ApiTrailingSlashMiddleware: the API design (architecture-notes-main/07 API)
writes endpoints without a trailing slash (`/api/v1/auth/login`) and the
frontend calls them that way, while Django/DRF routes end in `/`. Django's
APPEND_SLASH answers with a redirect, which cannot carry a POST body. This
middleware internally appends the slash for /api/ paths before URL
resolution, so both forms reach the same view with no redirect.
"""


class ApiTrailingSlashMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path_info
        if path.startswith("/api/") and not path.endswith("/"):
            request.path_info = path + "/"
        return self.get_response(request)
