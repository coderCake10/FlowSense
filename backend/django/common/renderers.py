"""
Response envelope from the OpenAPI contract (docs/openapi/flowsense-openapi.yaml):

    success:   {"success": true, "data": ..., "message": null}
    paginated: {"success": true, "data": [...], "meta": {"page", "page_size", "total_count", "total_pages"}}
    error:     {"success": false, "error": {"code": "NOT_FOUND", "message": "..."}}

Views keep returning plain data (and DRF keeps raising its usual exceptions);
this renderer wraps every API response in one place.
"""
from rest_framework.renderers import JSONRenderer

STATUS_CODES = {
    400: "VALIDATION_ERROR",
    401: "NOT_AUTHENTICATED",
    403: "PERMISSION_DENIED",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    429: "RATE_LIMITED",
    501: "NOT_IMPLEMENTED",
}
# DRF's generic codes that the status already says better.
GENERIC_CODES = {"invalid", "error", "not_found", "not_authenticated", "permission_denied",
                 "method_not_allowed", "throttled", "parse_error"}


class PaginatedData(dict):
    """Returned by common.pagination: {"results": [...], "meta": {...}}."""


def _first_message(value):
    if isinstance(value, dict):
        for key, inner in value.items():
            message = _first_message(inner)
            if message:
                return message if key == "non_field_errors" else f"{key}: {message}"
        return None
    if isinstance(value, (list, tuple)):
        return _first_message(value[0]) if value else None
    return str(value) if value is not None else None


def error_envelope(data, status_code):
    code = STATUS_CODES.get(status_code, "SERVER_ERROR" if status_code >= 500 else "ERROR")
    error = {"code": code, "message": ""}
    if isinstance(data, dict) and "detail" in data:
        detail = data["detail"]
        error["message"] = str(detail)
        specific = getattr(detail, "code", None)
        if specific and specific not in GENERIC_CODES:
            error["code"] = str(specific).upper()
    elif data is not None:
        error["message"] = _first_message(data) or ""
        if isinstance(data, dict):
            error["fields"] = data  # per-field validation messages
    return {"success": False, "error": error}


def success_envelope(data):
    if isinstance(data, PaginatedData):
        return {"success": True, "data": data["results"], "meta": data["meta"]}
    if isinstance(data, dict) and set(data) == {"detail"}:
        return {"success": True, "data": None, "message": str(data["detail"])}
    return {"success": True, "data": data, "message": None}


def already_wrapped(data, status_code):
    """
    Some views (the session endpoints) build {"success": ..., "data"/"error": ...}
    themselves. Keep their extra keys (e.g. qr_token) and give their errors
    the contract's {code, message} shape.
    """
    if data["success"] is False or status_code >= 400:
        inner = data.get("error")
        if isinstance(inner, dict) and {"code", "message"} <= set(inner):
            return data
        return error_envelope({"detail": inner} if isinstance(inner, str) else inner, status_code)
    return {"success": True, "data": data.get("data"), "message": data.get("message"),
            **{k: v for k, v in data.items() if k not in ("success", "data", "message")}}


class EnvelopeJSONRenderer(JSONRenderer):
    def render(self, data, accepted_media_type=None, renderer_context=None):
        response = (renderer_context or {}).get("response")
        status_code = getattr(response, "status_code", 200)
        if isinstance(data, dict) and not isinstance(data, PaginatedData) and "success" in data:
            body = already_wrapped(data, status_code)
        elif status_code == 204:
            # The contract answers DELETE with 200 and a success envelope.
            response.status_code = 200
            body = {"success": True, "data": None, "message": "Deleted."}
        elif status_code >= 400:
            body = error_envelope(data, status_code)
        else:
            body = success_envelope(data)
        return super().render(body, accepted_media_type, renderer_context)
