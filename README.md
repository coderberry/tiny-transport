# tiny-transport

A small Transport Fever–style train logistics game in the browser. Build rails
between cities and industries, run trains, haul cargo, earn money.

TypeScript + Vite + PixiJS, with a custom fixed-tick simulation over a rail
graph. No physics engine, no game framework — the game is a graph simulation.

## Run

```sh
npm install
npm run dev        # dev server on http://localhost:5173
npm test           # simulation unit + integration tests
npm run typecheck  # tsc --noEmit
npm run build      # production build in dist/
```

## Deploy

Cloudflare Pages settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root

Direct upload: `npx wrangler pages deploy dist --project-name=tiny-transport`

Local Pages preview:

```sh
npm run pages:dev
```

## How to play

1. **Rail (2)** — click to anchor, click again to place straight/45° track;
   keep clicking to chain segments. Right-click cancels. Water is unbuildable;
   rough terrain costs more.
2. **Station (3)** — place on or near your track. A station within range of a
   city or industry links to it automatically (shown while previewing).
3. **Routes (4)** or the route panel's **+ New route** — click stations in
   order, then **Create route** (or press Enter).
4. **+ Train ($1,500)** on a route — the train shuttles the stops, loading
   whatever the route can sell: cities buy their demanded cargo, processing
   industries buy feedstock (wood → sawmill → goods).
5. Payment scales with haul distance. Trains cost $2/s upkeep, so idle trains
   bleed money — the route panel tracks each line's lifetime earnings.

**Select (1)** inspects anything (and previews rail paths between two
stations); **Bulldoze (5)** demolishes for a half refund. `?seed=123` in the
URL starts a specific map; the game autosaves every minute.

## Design

See [PLAN.md](PLAN.md) for the design, architecture decisions, and milestone
roadmap. The simulation is fully deterministic (seeded RNG, fixed 10 Hz tick)
and renderer-independent — `npm test` runs it headless, including a
1,000-tick delivery integration test.
