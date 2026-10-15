# Signal Garden · Living systems studio

**[Open the studio](https://signal-garden-tan.vercel.app)**

An interactive generative-art studio built with **Datastar 1.0.4**, a Canvas 2D web component, and a small Node.js SSE endpoint. No application dependencies, bundler, virtual DOM, or component framework.

## Explore

- **Four systems:** Bloom, Vortex, Ribbons, and Constellation, each with its own mathematical structure.
- **200–4,000 particles:** tune population, expansion, complexity, particle size, tempo, and pointer strength.
- **Four palettes:** Iris, Ember, Tide, and Gold.
- **Pointer forces:** attract, repel, or swirl particles. Click/tap to pin up to six forces; clear them when you want a fresh field.
- **Transport:** play/pause, zoom, a measured FPS readout, and undo/redo for up to 40 configuration states.
- **Evolution:** a finite server stream delivers 96 signal updates and four HTML stage notes over about eight seconds. It can be cancelled. Local controls remain interactive.
- **Collection:** save up to eight recipes and thumbnails in this browser's local storage. Reload, restore, or remove individual recipes.
- **Sharing:** copy a recipe URL. Only configuration travels in the URL fragment; nothing is saved to a server.
- **Export:** download the current canvas as a PNG with a small seed caption.

Saved/shared recipes include configuration, not transient pointer forces or animation time. Restoring one starts a new moment with the same settings. Browser storage is device- and origin-specific; it is not cloud sync.

## Run locally

Requires Node.js 22.

```sh
npm run dev
# http://localhost:4317
npm test
```

No installation or build step is needed. Deploy with `npx vercel --prod`. Vercel serves `public` and runs `api/grow.js` as a Node function, capped at 30 seconds.

## Controls and accessibility

All settings use labelled native form controls. On the canvas, arrow keys move the influence point, Enter pins a force, and Escape clears forces. Outside form controls, Space toggles play, 1–4 select systems, R randomizes, S saves, H toggles the guide, and Escape stops evolution and closes overlays. People who prefer reduced motion start with animation paused; they can opt into playback.

The studio adapts to desktop, tablet, and narrow mobile layouts. Canvas has an accessible interaction description; the art itself is visual rather than represented as thousands of accessibility nodes.

## Ownership

- `public/index.html`: interface and Datastar bindings (`data-bind`, `data-attr`, `data-class`, `data-show`, `data-text`, `data-indicator`, and `@get`).
- `public/field.js`: bounded recipe schema and the `living-field` custom element. Canvas owns rendering, animation time, pointer interaction, and image capture. Typed arrays hold particle positions; drawing is batched by color. Device pixel ratio is capped at two. Animation stops in a hidden tab or after settling when paused.
- `public/studio.js`: recipe history, local persistence, URL sharing, keyboard shortcuts, export, and stream cancellation. It reads and patches Datastar's state directly rather than maintaining another live configuration store.
- `api/grow.js`: finite SSE evolution, with tiny signal patches and stage-note HTML patches. It never replaces the canvas or overwrites local configuration, and exits when the client disconnects.
- `server.js`: local static-file and API server.

Datastar is self-hosted under `public/vendor` with its upstream license and source map. Fonts load from Google Fonts with system fallbacks. The original generated SVG/template build path has been removed.

## Verification

`npm test` covers normalization of untrusted recipes, URL round-tripping, malformed requests, progressive SSE delivery, all evolution phases, cancellation, and a 20 KB response-size ceiling. Syntax checks cover the client modules and API.

Manual Safari checks covered system switching, undo/redo, saving and restoring after reload, shared-link restoration, PNG export, pinned forces, pause, and controls during streamed evolution. A 390 px responsive viewport was inspected. In one desktop Safari session the in-app counter reported roughly 59–60 FPS with 2,200–2,400 particles; this is an observation, not a guarantee across devices or settings.

References: [Datastar attributes](https://data-star.dev/reference/attributes), [backend actions](https://data-star.dev/reference/actions), [SSE protocol](https://data-star.dev/reference/sse_events).
