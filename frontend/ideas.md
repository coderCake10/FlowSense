# FlowSense Frontend Design Brainstorm

## Three Initial Directions

### Theme Name: Civic Signal

Very Brief Intro: A calm operations interface inspired by civic wayfinding systems, university signage, and technical field notebooks. AUF navy carries authority while warm gold marks active decisions and successful movement.
Probability: 0.06

### Theme Name: Blueprint Atelier

Very Brief Intro: A refined architectural workspace that treats campus mapping as a living blueprint, combining pale drafting surfaces, measured labels, and restrained blue ink. It communicates precision, craft, and spatial intelligence.
Probability: 0.03

### Theme Name: Field Console

Very Brief Intro: A dark, high contrast operations console for monitoring hardware, signals, and live events. It emphasizes urgency and telemetry, but uses restrained amber accents rather than decorative neon.
Probability: 0.08

## Selected Direction: Civic Signal

### Design Movement

The interface follows contemporary civic wayfinding and Swiss information design, softened with editorial university administration cues. It uses a persistent rail, strong typographic hierarchy, measured alignment, and purposeful color coding so that the interface feels dependable rather than ornamental.

### Core Principles

1. The interface must make the next operational decision obvious without making every element visually loud.
2. Spatial work should feel like a workspace, with a persistent context rail and flexible canvas rather than a stack of centered cards.
3. AUF identity should be recognizable through navy, warm gold, and a compact Great Dane wayfinding mark, while the rest of the palette stays quiet and functional.
4. Every status color must have a textual label, an icon, and a clear semantic meaning so the system is understandable without color perception.

### Color Philosophy

Deep AUF navy establishes trust and institutional continuity. Warm signal gold is reserved for active tools, primary actions, selected routes, and system attention so it remains ownable and meaningful. Soft parchment and cool slate surfaces separate workspace layers without making the dashboard feel sterile. Green, amber, and red are used only for operational states and are paired with labels. There will be no purple gradient and no decorative neon glow.

### Layout Paradigm

The admin experience uses a fixed compact navigation rail, a restrained top command bar, and a flexible main workspace. Map Annotation uses a three zone composition with tool rail, visual canvas, and contextual configuration panel. Hardware and Asset Management use dense but breathable tables with controls embedded in headers and actions persistently visible. Dashboard uses asymmetrical overview blocks rather than a uniform card grid. Kiosk and PWA surfaces use large wayfinding areas, but keep content anchored to an edge so the experience does not become a generic centered landing page.

### Signature Elements

1. A gold route line motif appears in breadcrumbs, selected paths, progress states, and QR handoff cues.
2. Small coordinate style labels and building codes provide a technical campus vocabulary without overwhelming the user.
3. A compact Great Dane wayfinding mark appears in the application shell, favicon, authentication screen, and kiosk handoff moments.

### Interaction Philosophy

Interactions should feel like operating a dependable campus instrument. Hover states are quiet, selected states are unmistakable, and destructive actions require a clear confirmation. Contextual configuration changes with the active tool or selected node instead of presenting every possible control at once. Persistent actions remain visible when they are operationally important, especially Register, Manage, Fix, Save, and Reopen Confirmation.

### Animation

Use short, directional transitions under 250 milliseconds. Workspace panels should slide or fade from the edge they belong to. Selected map nodes should receive a restrained pulse or ring, never a glow. Tables should reveal status updates with a small opacity and translate transition. Modals should enter from 95 percent scale with opacity rather than from zero scale. Route lines may draw progressively during a route calculation, but the final route must remain static and readable. Respect reduced motion preferences and keep keyboard initiated actions immediate.

### Typography System

Use Space Grotesk for page titles, section headings, metrics, and compact navigation labels. Use IBM Plex Sans for body copy, tables, forms, and helper text. Page titles use a strong 30 to 38 pixel scale, section headings use 18 to 22 pixels, table headers use 11 to 12 pixel uppercase labels with letter spacing, and body text uses 13 to 15 pixels. Avoid Inter and avoid using display typography for long paragraphs.

### Brand Essence

FlowSense is a spatial operations system for AUF personnel and visitors that turns campus maps, live hardware signals, and destination queues into understandable movement. It is precise, reassuring, and quietly intelligent.

### Brand Voice

Headlines should be direct and operational. CTAs should describe the action and its consequence. Microcopy should reduce uncertainty without sounding robotic. Avoid generic filler such as “Welcome to our website” or “Get started today.”

Example lines:

> Find the clearest route across campus.

> Register the device before it enters the live fleet.

### Wordmark and Logo

The logo is a bold, compact Great Dane head silhouette integrated with a single flowing wayfinding line that curves from the ear toward the snout. The mark is symbolic and text free, designed to work at favicon scale while retaining a strong AUF association. The wordmark uses a custom geometric lockup with a slight forward cut in the final letter to suggest movement.

### Signature Brand Color

FlowSense Signal Gold: #F4C542. It is warm enough to feel human and academic, but bright enough to function as a clear operational signal against AUF navy and parchment surfaces.

## Implementation Reminder

Every CSS, component, and page file should begin with a short comment that reminds the implementer of the Civic Signal direction, AUF navy and FlowSense Signal Gold, compact persistent navigation, breathable workspace layouts, Space Grotesk plus IBM Plex Sans, and restrained motion. When choosing between two valid UI options, ask: “Does this choice reinforce or dilute Civic Signal?”

## Scope for the First Frontend Build

The first frontend delivery will establish the authenticated Admin Dashboard shell and representative operational pages based on the wireframes and API design: Dashboard, Map Annotation, Asset Management, Hardware Management, User Management, Analytics, Settings, Help, authentication states, and the public Kiosk and Mobile PWA route entry points. API integration will be structured around a typed client layer with mockable adapters so real Django endpoints can be connected without changing the interface components.

No backend or server files will be changed. The frontend will remain within React, TypeScript, TailwindCSS, shadcn/ui, Wouter, Zustand, TanStack Query, React Three Fiber, Three.js, and the API surface supplied by the user.

## Style Decisions

The first build prioritizes the administrative workspace because it is the densest part of the wireframes and establishes the reusable visual language for the kiosk and PWA. Existing wireframe notes take precedence over decorative preferences. The Map Annotation workspace will keep all contextual controls dynamic and will not show persistent per-node action clutter. The Hardware registry will use inline header filters and will distinguish Register from Manage states. The mobile handoff will use destination instruction cards, arrival confirmation, cancel and reopen states, and a disabled reopen control when the user is out of sensor range.

## API Integration Notes

The frontend API client will use `/api/v1` as the base path, support an environment supplied API origin, and keep authentication credentials in a client side session abstraction. The first implementation will use strongly typed request and response boundaries derived from `00APIDesign.md`, with clear loading, empty, error, and unauthorized states. Where an endpoint response shape is not yet specified, the UI will use typed adapter fixtures rather than silently inventing backend behavior.

## Data Vocabulary

The shared frontend vocabulary is: area, floor, room, entrance, stairs, elevator, outdoor walkway, navigation node, edge, floor transition, asset, model, building, device, kiosk, sensor, observation, heartbeat, navigation session, QR session, destination queue, alert, activity event, administrator, super administrator, and system setting.

## File Style Header Template

Use a file specific reminder such as:

`/* Civic Signal: compact AUF navy shell, FlowSense Signal Gold for active operational states, Space Grotesk headings, IBM Plex Sans body, breathable workspace composition, restrained motion. */`

This reminder should be adapted to the role of each file while preserving the same design direction.

## Acceptance Checks

The first delivery should make the following flows inspectable in the browser: passwordless authentication screen states, successful redirect to Dashboard, sidebar navigation, dashboard status cards, hardware registry with Register and Manage states, map annotation with dynamic contextual configuration, asset validation summary, analytics overview, Help link, kiosk destination selection, QR handoff preview, mobile destination cards, BLE arrival confirmation, canceled confirmation reopening, and disabled out of range state.

The application should compile without TypeScript errors, keep routes reachable, present clear placeholder states where backend response contracts are pending, and avoid implying that fixture data is real production data.

## Backend Boundary

The frontend may define types, API client functions, query hooks, adapter fixtures, and UI states for the supplied endpoint contracts. It must not modify Django code, database schemas, MQTT services, Docker services, server routes, or backend configuration.

## Next Step

Implement the application shell and representative routes after generating and storing the FlowSense visual assets. Build the navigation and reusable primitives first, then connect the API client and page-specific data states.
