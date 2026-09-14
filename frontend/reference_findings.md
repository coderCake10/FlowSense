# Current bug investigation findings

## Supplied User Management screenshot

The source image is 953 by 277 pixels with a 3.44:1 landscape ratio, so it was inspected as two overlapping horizontal crops. The reference shows the Administrator directory card with the first administrator row visible. The action popover is anchored near the first row's ellipsis at the far right and is visibly clipped by the table/card boundary, leaving only the Disable administrator item visible. This confirms that the current failure is caused by rendering the popover inside an overflow-constrained table wrapper; the full action list must escape the table overflow, preferably with fixed positioning or a portal.

## Current source audit

Map Annotation currently uses a React Three Fiber Canvas inside a min-height workspace with an always-mounted 3D preview. The new patch bounds the preview to 520px, uses a CSS map for 2D mode, mounts WebGL only for explicit 3D mode, sets dpr to [1, 1], disables antialiasing, requests low-power rendering, and keeps frameloop demand. These changes target runaway canvas/resource behavior while preserving the 3D option.

The API contract requires annotation endpoints under /api/v1/annotations, assets endpoints under /api/v1/assets, and auth profile retrieval through GET /api/v1/auth/me. Asset validation and processing actions now expose the matching endpoint in the UI and call POST validation only when a real API base URL is configured; otherwise they remain explicit frontend adapter states. View Profile now opens an in-place profile modal because no dedicated profile route exists.

The kiosk now uses a light admin-style header and AUF navy/gold navigation rail, while preserving its touchscreen keyboard and one-minute inactivity behavior.
