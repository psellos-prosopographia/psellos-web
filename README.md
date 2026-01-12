# Psellos Web

Psellos Web is a static, read-only web application for exploring compiled prosopographical data produced by `psellos-builder`. The site focuses on presenting entities, relationships, and narratives derived from builder outputs, without embedding or editing source data.

## Purpose

- Provide a lightweight, static UI for browsing compiled prosopographical artifacts.
- Keep the application read-only and decoupled from raw datasets.
- Emphasize integration points for future visualizations (encyclopedia, relationship graph, narrative layers).

## Data flow from psellos-builder

1. `psellos-builder` compiles raw sources into publishable JSON artifacts.
2. Those build artifacts are copied into `public/data/` as static assets.
3. The Vite build emits a static site that fetches the JSON at runtime via `fetch()`.

The app does **not** read or transform raw data directly. It only consumes builder output.

## Separation from canon and schema

- **Canon**: The canonical source data remains entirely within `psellos-builder` (or its upstream sources).
- **Schema**: The data contracts are defined by the builder and imported here as *assumptions*.
- **Web**: This repo only visualizes compiled JSON and should not define or enforce canonical schemas.

Where contracts are assumed, TODOs call out the expected builder artifacts so the two systems can be aligned.

## Development

```bash
npm install
npm run dev
```

### Static asset pipeline

- Vite serves `public/` as static assets.
- JSON artifacts from `psellos-builder` should be placed under `public/data/`.
- The data loader fetches these artifacts at runtime.
