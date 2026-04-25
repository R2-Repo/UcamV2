# Cursor Agent Migration Notes

This file captures project context discussed with Cursor agents so future work can quickly understand the app, the legacy codebase, the current React rebuild, and the intended direction.

## App identity and purpose

- This is a front-end-only UDOT / Utah traffic camera web app hosted through GitHub.
- The app helps users browse Utah traffic cameras through a fast, clean gallery and map experience.
- The top product goal is a modern, fun, fast app that looks simple while still offering many useful features.
- Performance, simplicity, and maintainable code are important project values.

## Codebase structure

- The active app is a React + Vite + TypeScript app in `src`.
- The old plain HTML/CSS/JavaScript app is preserved in `legacy`.
- The root React app should not depend directly on `legacy`.
- Legacy code should be used as reference material when rebuilding missing features.

## Current React app

- Loads processed static data from `public/data`.
- Uses camera summaries, camera details, and curated route data.
- Uses Zustand for filter, view, and camera selection state.
- Supports gallery view, full MapLibre map view, camera detail modals, filters, search, and shareable URL state.
- Current filters include search, region, county, city, maintenance station, and curated route.
- Camera thumbnails refresh with cache-busting tokens and viewport-aware behavior.
- Camera detail modals include larger imagery, previous/next navigation, route metadata, mini maps, Google Maps embeds, and Street View embeds.
- The full map currently includes experiments/scaffolding for camera clusters, popup thumbnails, 2D/3D terrain mode, quick actions, path measurement, analytics, and optional ArcGIS layers.

## Legacy app context

- Important legacy files include:
  - `legacy/index.html`
  - `legacy/js/main.js`
  - `legacy/js/filters.js`
  - `legacy/js/maps.js`
  - `legacy/js/modal.js`
  - `legacy/js/customRoute.js`
  - `legacy/js/geolocation.js`
- The legacy app used Leaflet, Bootstrap, plain JavaScript modules, and global `window` state.
- Legacy features are reference material, not production dependencies for the React app.

## Major refactor change

- The project moved from plain HTML/JavaScript + Leaflet to React/Vite/TypeScript + MapLibre.
- Besides the React refactor, the largest technical change is replacing Leaflet map behavior with MapLibre.

## Current map architecture understanding

- The desired direction is a shared MapLibre map engine/foundation with feature-specific modules built on top.
- The current app is not fully there yet.
- Current reality:
  - `src/features/map/mapStyle.ts` provides shared MapLibre style/configuration.
  - `src/features/map/MapView.tsx` is the large full-map implementation.
  - `src/features/modal/ModalMapCanvas.tsx` separately creates its own MapLibre instance.
- A better future architecture would extract shared map lifecycle, style, source/layer helpers, resize handling, controls, and camera layer logic into reusable pieces.
- Then full map, modal maps, gallery overview maps, route builder maps, measurement tools, ArcGIS overlays, and analytics can be built as modules or variants on top.

## Full MapLibre map status

- The full MapLibre map is early-stage and roughly 25% complete compared with the intended final experience.
- Many widgets/tools are intentionally incomplete scaffolding.
- Future work should improve UX, modularity, performance, feature completeness, and mobile behavior.

## Known missing or future features

### Custom route builder

- The legacy app had a custom route builder.
- The React app needs a new MapLibre-based version.
- It should support building custom camera route/gallery selections.
- It should support shareable and savable URL parameters.

### Gallery mini overview map card

- A future gallery card should act like a camera card but display a mini overview map.
- It should visualize the currently active filtered camera set.
- It should likely use the future shared MapLibre foundation.

### Mobile-specific experience

- The React refactor has mostly focused on desktop so far.
- Mobile should not be treated as only a smaller desktop layout.
- The mobile app experience should become highly optimized and may use different UI patterns/components from desktop.
- Important mobile areas include gallery browsing, camera modal/carousel behavior, filters, full map controls, route builder, and shareable views.

## Performance and efficiency observations

- The gallery currently renders every filtered camera directly. With about 2,000 cameras this can work, but virtualization is the biggest likely gallery speed improvement.
- `@tanstack/react-virtual` is already installed but not currently used in the gallery.
- Each gallery camera card owns viewport tracking and refresh behavior. This is thoughtfully scoped, but virtualization would reduce the number of mounted cards and observers.
- The full map popup layout currently updates from MapLibre render events. This may become expensive as map features grow; consider throttling or updating on more specific map events/state changes.
- Camera analytics are currently computed when filtered cameras change, even if the analytics panel is closed. Lazy-computing analytics when the panel opens would reduce unnecessary work.
- Filter option derivation repeats filtering several times. This is acceptable for the current dataset but could be optimized if data grows or search typing becomes sluggish.

## Product goals and expectations

- Keep the app fast and efficient.
- Keep the UI clean, simple, and easy to understand.
- Offer powerful features without making the app feel complicated.
- Keep the app front-end-only.
- Keep code maintainable and understandable as the app grows.
- Use the legacy app as a feature reference, but rebuild features in a React/MapLibre-friendly way.
- Prioritize shared foundations and modular feature layers before adding too much one-off behavior.

## Suggested future development direction

- Treat the React app as the source of truth.
- Use `legacy` as a reference for missing behavior.
- Extract reusable foundations for:
  - MapLibre map lifecycle and shared map behavior.
  - camera data helpers.
  - route and filter helpers.
  - URL/share-state helpers.
  - desktop and mobile UI patterns.
- Rebuild missing features in a modular way.
- Keep performance and simplicity central while adding new functionality.
