# Signal Garden

A botanical art instrument built with **Datastar 1.0.4**, static SVG, CSS, and a tiny Node.js SSE endpoint.

## Run

```sh
npm run dev
# http://localhost:4317
npm test
```

Node 22+; no application dependencies or install step. Datastar is vendored under `public/vendor`, with its upstream license.

## Explore

- **Iris / Ember / Tide:** immediate palette changes.
- **Density:** reveal 80–800 persistent petals.
- **Expansion:** scale the botanical field.
- **Perspective:** rotate the composition locally.
- **Discover another seed:** change the phyllotactic angle.
- **Let it grow:** receive 64 server-sent growth updates over approximately five seconds. All other controls remain interactive.
- **Live readout:** observe frame count, elapsed server time, growth status, and seed.

## Architecture

`index.template.html` owns the page and declarative Datastar behavior. `build.js` generates the fixed SVG geometry into `public/index.html`. The generated file is not a second source of truth. `public/style.css` owns the artwork and responsive layout. `api/grow.js` streams only `datastar-patch-signals` events and stops on disconnection. `server.js` serves the same files and endpoint locally. Vercel serves the static assets and Node function.

All controls use `data-bind`, `data-style`, `data-class`, or `data-text`; none requires a network round trip. CSS variables control color, angle, rotation, and scale. A single reactive CSS rule controls visible petal count. No virtual DOM, client component framework, per-petal subscription, or continuous animation loop.

The first prototype replaced the SVG on every slider request (after a 180 ms debounce) and every growth tick. That path was removed: 800 SVG groups now mount once, and the complete 64-event growth stream is under 12 KB, enforced by an integration test. This is a transfer-size guarantee, not a claimed frame-rate benchmark. Initial geometry is larger than a canvas renderer; the experiment intentionally keeps the artwork as inspectable, accessible SVG.

## Verification

`npm test` checks actual HTTP SSE responses: compact signal-only payloads, malformed input, no reflection of untrusted input, and complete incremental delivery. Desktop Safari was used for visual review. Responsive CSS adapts at 1000px and 700px; reduced-motion preferences disable transitions and petal entrance animation.

## Deploy

```sh
npx vercel --prod
```

`vercel.json` runs the build, publishes `public`, and bounds the growth function to 30 seconds. Streams are finite and store no user data. The repository contains no secrets.

References: [Datastar guide](https://data-star.dev/guide/getting_started), [SSE protocol](https://data-star.dev/reference/sse_events).
