# FlowSense Frontend Technology Stack

## Approved frontend stack

FlowSense is a static frontend application built with **React 19**, **TypeScript**, and **Vite 7**. Client-side routing uses **Wouter**, matching the current application implementation.

The visual system uses **Tailwind CSS 4** with CSS-variable design tokens in `client/src/index.css`. Reusable interface primitives come from the local **shadcn/ui** component set, which is implemented with **Radix UI** packages. Icons use **lucide-react**. Notifications use **sonner**.

Local UI state uses React hooks and **Zustand** where shared state is required. **TanStack Query** is available for server-state integration when the Django API is connected. The current API boundary is intentionally mockable and lives in `client/src/lib/api.ts`.

The 3D preview uses **Three.js** through **React Three Fiber**. Map Annotation currently uses a bounded, low-resource preview and an opt-in 3D mode. Any future scene must keep rendering bounded and dispose subscriptions, geometries, materials, and controls correctly.

The frontend uses **React Hook Form** and **Zod** where structured forms and validation are needed. **Recharts** is available for dashboard and analytics visualizations. The project includes a PWA manifest for the mobile handoff experience.

## Route and module structure

| Responsibility                                           | Location                                   |
| -------------------------------------------------------- | ------------------------------------------ |
| Top-level route composition and lazy loading             | `client/src/App.tsx`                       |
| Admin shell, branding, profile, sign-out, and navigation | `client/src/components/FlowSenseShell.tsx` |
| Admin workspace pages                                    | `client/src/pages/workspaces/`             |
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
| `pnpm install`     | Install dependencies                               |
| `pnpm run dev`     | Start the Vite development server                  |
| `pnpm run check`   | Run TypeScript checks                              |
| `pnpm run format`  | Format project files with Prettier                 |
| `pnpm run build`   | Build the frontend and compatibility server bundle |
| `pnpm run preview` | Preview the production frontend build              |

The project should be installed with the repository’s `pnpm-lock.yaml` and the declared package manager version. Do not substitute the router, CSS framework, icon library, or component system without an explicit architecture decision.

ESLint is configured in `eslint.config.js` for JavaScript, TypeScript, React Hooks, and React Refresh checks. Run `pnpm run lint` for a quality scan or `pnpm run lint:fix` for safe automatic fixes. The current prototype intentionally reports broad unused-import and prototype-type findings as warnings rather than failing the command; those warnings should be reduced as modules are refined.

The managed workspace currently remains at its existing filesystem path so the development preview metadata continues to work. For a local clone outside the managed workspace, the folder may be renamed to `Frontend` in File Explorer or with `Rename-Item`, without changing the application architecture.
