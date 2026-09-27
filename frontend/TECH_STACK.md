# FlowSense Frontend Technology Stack

## Approved frontend stack

The FlowSense frontend is a React single-page app built with **React 19**, **TypeScript**, and **Vite 7**, served against the Django REST API (`/api/v1`). Client-side routing uses **Wouter**, matching the current application implementation.

The visual system uses **Tailwind CSS 4** with CSS-variable design tokens in `client/src/index.css`. Reusable interface primitives come from the local **shadcn/ui** component set, which is implemented with **Radix UI** packages. Icons use **lucide-react**. Notifications use **sonner**.

Local UI state uses React hooks. **TanStack Query** handles every admin API call (`client/src/lib/adminApi.ts`, `analyticsApi.ts`, `annotationApi.ts`). **Zustand** is installed but not used yet. The request client and endpoint map live in `client/src/lib/api.ts`; without `VITE_API_BASE_URL` the admin pages fall back to an offline demo.

The 3D maps (kiosk, attract preview, Map Annotation) use **Three.js** through **React Three Fiber** and drei, loading Draco-compressed `.glb` models from `client/public/models/` with the decoder in `client/public/draco/`. Scenes render on demand and must dispose subscriptions, geometries, materials, and controls correctly.

The frontend uses **React Hook Form** and **Zod** where structured forms and validation are needed. **Recharts** is available for dashboard and analytics visualizations. The project includes a PWA manifest for the mobile handoff experience.

## Route and module structure

| Responsibility                                           | Location                                   |
| -------------------------------------------------------- | ------------------------------------------ |
| Top-level route composition and lazy loading             | `client/src/App.tsx`                       |
| Admin shell, branding, profile, sign-out, and navigation | `client/src/components/FlowSenseShell.tsx` |
| Admin workspace pages                                    | `client/src/pages/workspaces/`             |
| 3D map components                                        | `client/src/components/map/`, `BuildingFloorMap.tsx` |
| Building configuration                                   | `client/src/data/`                         |
| Visitor pages                                            | `client/src/pages/experience/`             |
| API types, request client, and endpoint map              | `client/src/lib/api.ts`                    |
| Shared UI primitives                                     | `client/src/components/ui/`                |
| Global tokens and base styling                           | `client/src/index.css`                     |

## Responsibility boundary

The React application owns page rendering, interaction states, accessibility, client-side navigation, request loading and error states, fixture-mode behavior, and presentation of data returned by the API.

The Django REST API owns authentication enforcement, authorization, persistence, spatial queries, route computation, analytics aggregation, report generation, asset processing, and durable mutations. PostgreSQL/PostGIS owns spatial data. MQTT, ESP32 devices, and BLE advertisements belong to the IoT and backend layers. The frontend must not simulate production persistence or move those responsibilities into browser-only code.

## Development commands

| Command            | Purpose                                            |
| ------------------ | -------------------------------------------------- |
| `npm install`     | Install dependencies                               |
| `npm run dev`     | Start the Vite development server                  |
| `npm run check`   | Run TypeScript checks                              |
| `npm run format`  | Format project files with Prettier                 |
| `npm run lint`    | ESLint                                             |
| `npm test`        | Unit tests (Vitest)                                |
| `npm run models:check` | Check the building models and Draco decoder are present |
| `npm run qa:stepN` | Browser QA suite for step N (Playwright, `e2e/`)  |
| `npm run build`   | Build the frontend and compatibility server bundle |
| `npm run preview` | Preview the production frontend build              |

The project is installed with npm (`npm ci`), using the repository’s `package-lock.json`. Do not substitute the router, CSS framework, icon library, or component system without an explicit architecture decision.

ESLint is configured in `eslint.config.js` for JavaScript, TypeScript, React Hooks, and React Refresh checks. Run `npm run lint` for a quality scan or `npm run lint:fix` for safe automatic fixes. The current prototype intentionally reports broad unused-import and prototype-type findings as warnings rather than failing the command; those warnings should be reduced as modules are refined.
