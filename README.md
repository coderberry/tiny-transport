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

See [PLAN.md](PLAN.md) for the design, architecture decisions, and milestone
roadmap.
