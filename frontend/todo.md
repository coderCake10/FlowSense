# FlowSense Frontend Correction Tasks

## ESLint and local project naming

- [x] Add a TypeScript-compatible ESLint flat configuration for React, React Hooks, and React Refresh.
- [x] Add `lint` and `lint:fix` scripts and install the required development dependencies.
- [x] Rename the package identity to `frontend` while keeping the managed workspace path stable.
- [x] Document the safe local-clone folder rename to `Frontend`.
- [x] Verify formatting, lint completion, TypeScript, production build, and preview startup.



## Codebase cleanup and stack reconciliation

- [x] Remove platform-specific references from application source, visible documentation, scripts, and project-facing configuration wherever safe.
- [x] Isolate or preserve only managed preview/runtime files that are required for the active hosting environment, and document any unavoidable exception.

- [x] Audit package.json, imports, route map, API design, and technical documentation against the approved frontend stack.
- [x] Format and split Workspaces.tsx and ExperiencePages.tsx into reviewable per-page or feature modules without changing behavior.
- [x] Complete the API endpoint map for alerts, activity, analytics, QR, deletes, and version restore.
- [x] Document Wouter routing and the actual Tailwind, shadcn/ui, Radix, lucide-react, and installed libraries.
- [x] Add route-level code splitting and review the bundle-size result.
- [x] Remove or archive one-off patch and diagnostic scripts after confirming they are not required at runtime.
- [x] Remove or safely guard undefined analytics placeholders in index.html.
- [x] Remove the unused JSX locator plugin dependency; the project now installs with the declared Vite 7 toolchain.
- [x] Run formatting, TypeScript, production build, and visual smoke checks before the cleanup checkpoint.

## Literature Review Matrix formatting

- [x] Rebuild the merged matrix using the supplied six-column layout: Title of the Study, Author(s), Date, Purpose/Rationale, Technology/Methods, and Conclusion.
- [x] Keep numbering at the left and wrap all cell text for portrait paper use.
- [x] Generate matching Word, Markdown, and Excel outputs and verify 63 rows.

- [x] Reformat the merged matrix into a portrait-friendly, wrapped layout with no horizontal scrolling.
- [x] Keep a detailed editable workbook while adding a compact paper-fit matrix for manuscript use.
- [x] Verify 63 unique rows, alphabetical ordering, and readable Word/Markdown output.

## Current revision requirements

- [x] Add a compact floor edit drawer from each floor row with save and cancel states.
- [x] Add a compact transition edit drawer from each transition row with save and cancel states.
- [x] Audit and make every Asset Management button produce a frontend state change or API-bound request state.
- [x] Keep Generate Report as a frontend trigger/request boundary; do not implement backend report generation in the frontend.
- [x] Rebuild and verify Asset Management interactions and responsive drawers.

- [x] Add wireframe-aligned Asset Management Floors view with building floor configuration, ordering, GLB nodes, display names, short names, elevations, navigability, and status.
- [x] Add wireframe-aligned Asset Management Transitions view with stair and lift connections between floors and review status.
- [x] Add wireframe-aligned Asset Management Spatial view with coordinate system, measurement unit, origin, rotation, and scale controls.
- [x] Add wireframe-aligned Asset Management Defaults view with default floor, map view, camera, initial kiosk state, floor selection, and cross-floor search controls.
- [x] Keep Asset Management context rail actions and API endpoint mapping visible and functional.
- [x] Soften kiosk navigation typography and contrast while retaining readable touch targets.
- [x] Rebuild and visually verify the new Asset Management states and kiosk route.

- [x] Identify and stop the Map Annotation infinite or unbounded workspace resource leak.
- [x] Bound the Map Annotation canvas and prevent runaway render or camera behavior.
- [x] Reposition User Management action menus so every action is visible for the first row and later rows.
- [x] Make View Profile open a working profile view or modal.
- [x] Make Asset Management action buttons produce functional frontend state transitions with API-aligned endpoint contracts.
- [x] Recheck API design alignment for annotations, assets, auth profile, and kiosk session responsibilities.
- [x] Restyle the kiosk to match the admin panel’s light AUF Civic Signal appearance while retaining touchscreen targets and the one-minute timeout.
- [x] Rebuild and visually verify the revised routes before the next checkpoint.

## Latest wireframe revision requirements

- [x] Reposition the first User Management action menu so all options remain visible without clipping.
- [x] Add a real Invite Administrator modal with email, role, validation, cancel, and send invitation states.
- [x] Add sign-out confirmation and return-to-authentication behavior.
- [x] Move kiosk visual emphasis from the top header to the navigation area and keep the AUF admin design language.
- [x] Enlarge the kiosk on-screen keyboard as a floating or lower-screen touchscreen control.
- [x] Reset kiosk inactivity on pointer, touch, keyboard, and navigation interaction and return to attraction after one minute.
- [x] Expand Analytics with filters, metric cards, alert panel, trends, destinations, monitored locations, kiosk usage, availability, reports, and export controls.
- [x] Expand Hardware Management with device registry filters, device rows, Register or Manage actions, detail views, command actions, assignment data, firmware, connection, hardware, and software details.
- [x] Verify the revised routes and interactions before the next checkpoint.

## Latest kiosk and administration fixes

- [x] Align the kiosk appearance with the AUF admin design system while retaining the visitor-focused layout.
- [x] Add an on-screen keyboard for touchscreen kiosk room search with clear, backspace, and close actions.
- [x] Allow only one User Management row action menu to remain open at a time.
- [x] Position the User Management action menu relative to its row and keep it inside the viewport without blank-space scrolling.
- [x] Make the admin profile button open a functional profile and session menu.
- [x] Verify the corrected interactions at desktop and kiosk-sized viewports.

## Wireframe fidelity and interaction fixes

## Newly reported correction requirements

- [x] Make kiosk Navigate start the live route state and improve the kiosk interaction appearance.
- [x] Stop the Map Annotation model from moving or drifting without user input.
- [x] Add Room Node fields for room code, optional room alias, and description.
- [x] Add registered hardware dropdowns to kiosk and sensor information editing.
- [x] Make + Location Node open a creation workflow and allow saving the new node.
- [x] Match Settings to the supplied Alerts and Semester Registry layout and behavior.
- [x] Recheck the frontend API types and fixture adapters against 00APIDesign.md and document whether live API calls are connected.
- [x] Confirm the supported profile or role count from the API design.

## Newly supplied reference-image requirements

- [x] Match Map Annotation to the three-zone wireframe: left Tool Kit, central Annotation Workspace, and right Node Tree plus Selected Node context.
- [x] Restore exact Map Annotation labels and controls: Area, Level, Camera View, Representation View, Undo, Saved, Asset Management, Select, Location Node, Auxiliary Node, Edge, Delete, Focus, and Inspect.
- [x] Add wireframe-style edit modal states for Room Node, Kiosk Node, and Sensor Node information.
- [x] Match Asset Management upload modal with GLB drag and drop or browse, 500 MB limit, asset name, version, validation, cancel, and Begin Processing actions.
- [x] Match kiosk initial view with destination list, building selector, floor controls, 3D campus view, You Are Here marker, and Navigate action.
- [x] Add kiosk Location Details panel with image placeholder, building and floor label, room name and code, description, personnel, availability, and Add to Queue.
- [x] Add kiosk Destination Queue or QR modal with Start Navigation and optional QR handoff.
- [x] Match mobile handoff loading, active checklist, Bluetooth unavailable, and Sensor Detected confirmation states.
- [x] Add the FlowSense attraction screen with logo, sneak-peek video area, current time, motion, click-to-enter kiosk behavior, and inactivity return to attraction.
- [x] Audit Asset Management details against the supplied wireframe before delivery.

## Newly reported wireframe requirements

- [x] Make Filter range apply a visible date or time-range state and update the dashboard view.
- [x] Make New map update open the Map Annotation workflow.
- [x] Make Open analytics navigate to Analytics.
- [x] Make Save changes show a clear success alert or toast and reflect saved state.
- [x] Make Upload asset open a real upload and validation state.
- [x] Make Discover devices open a device discovery state or dialog.
- [x] Make Invite administrator open an invitation form.
- [x] Match Map Annotation controls from the wireframe: area, level, camera view, representation view, undo, saved state, Asset Management, tool kit, node tree, and selected-node actions.
- [x] Add expand or collapse controls for the tool kit and node tree so the canvas can be enlarged by choice.
- [x] Add edit and inspect actions for room nodes, kiosk nodes, sensor nodes, and the selected node context.
- [x] Restore all Settings sections shown in the wireframes rather than only General.
- [x] Treat the Canva wireframes as functional and visual source of truth while retaining only non-destructive Civic Signal improvements.

## Existing correction checklist

- [x] Make Map Annotation responsive without clipping the Context panel at desktop widths.
- [x] Provide a usable horizontal or responsive fallback for narrower viewports, while preserving all three workspace zones.
- [x] Add live route visualization on the kiosk itself, including building or floor context and destination details.
- [x] Keep QR handoff as an optional continuation path rather than the only kiosk route output.
- [x] Implement the User Management ellipsis action menu with editable administrator actions and appropriate disabled or destructive states.
- [x] Audit every wireframe page for omitted controls, modals, loading states, empty states, and error states.
- [x] Preserve the approved Civic Signal shell, AUF branding, navy palette, and Signal Gold route motif without replacing required wireframe details.
- [x] Test desktop, tablet, and mobile layouts plus the main interaction flows before creating the next checkpoint.
