# tiny-transport — spec evaluation & build plan

## Context

Build a Transport Fever 2–style train logistics game as a single-player browser app in `/Users/eberry/Code/github.com/berrydev-ai/tiny-transport` (currently an empty, non-git directory; Node 26 / npm 11 available). The user supplied a detailed spec proposing TypeScript + Vite + PixiJS with a custom fixed-tick simulation, and asked for an evaluation plus a plan, using my judgment.

**Verdict on the spec: fundamentally sound — adopt it.** The stack choice, graph-not-physics modeling, sim/render separation, MVP discipline ("features to avoid" list), and development order are all correct. The plan below follows it with a set of targeted corrections where the spec is inconsistent, underspecified, or over-engineered for an MVP.

## Changes from the spec (my judgment calls)

| # | Spec says | Plan does instead | Why |
|---|-----------|-------------------|-----|
| 1 | "2D/isometric" | **Plain top-down 2D** | Isometric taxes every system (picking, placement, z-sorting) for pure cosmetics. State stays screen-agnostic, so isometric remains a render-only upgrade later. |
| 2 | `TrackSegment` in one section, `RailNode`/`RailEdge` in another | **One unified rail graph**: `RailNode {id, x, y}` + `RailEdge {id, a, b, length}` | The spec defines the rail model twice, inconsistently. |
| 3 | `Train.pathSegmentIds: string[]` | **Directed path**: `{edgeId, reversed}[]` + cumulative lengths | Bare edge IDs are ambiguous — edges are traversed in both directions. |
| 4 | Free-form rail placement (implied) | **Grid-snapped nodes, straight edges in 8 directions**, connections only at nodes | Rail-building UX is the riskiest system. Snapping avoids the mid-edge-split/junction rabbit hole while keeping the same graph model. |
| 5 | Claims determinism, provides no mechanism | **Seeded RNG (mulberry32) for everything random** | Real determinism for map gen, saves, and tests. |
| 6 | No mention of testing | **Vitest + unit tests on the pure sim + a headless 1000-tick integration test** | The sim is plain TS — cheap to test, and the headless "coal gets delivered, money goes up" test guards the core loop permanently. |
| 7 | React/Svelte "if desired" | **Vanilla TS + HTML/CSS overlay** | The UI is a toolbar and three panels. Zero framework dependency; revisit only if UI grows. |
| 8 | Dexie/IndexedDB for saves | **localStorage JSON behind a small `SaveStore` interface** | Saves are well under 1 MB. Dexie becomes a drop-in swap later if multi-slot saves demand it. |
| 9 | `updateCityGrowth` in the tick loop | **Stubbed out of MVP** | Growth appears in the spec's tick function but not in its own MVP scope. Cut. |
| 10 | Per-stop cargo rules (`load`/`unload`/`auto`) | **"auto" only in MVP** (load what's available, unload what's demanded) | Rule UI is post-MVP; the type stays in the model so rules slot in later. |
| 11 | `npm create vite@latest train-transport-game` (creates a subdir) | **Manual scaffold in-place**, project name `tiny-transport` | The project directory already exists; deterministic hand-rolled scaffold (~6 files) beats an interactive generator. |

Everything else — MVP scope, layered rendering, folder layout, dev order, the "avoid" list (no signals, no acceleration physics, no passengers, no complex chains, no multiplayer) — adopted as written.

## Versions (checked today)

pixi.js **8.19** (v8 API: `await app.init()`, chained Graphics like `.rect().fill()`), vite **8.1**, vitest **4.1**, typescript **6.0**. Vite 8 / TS 6 are newer than the spec assumed; config surface is stable but I'll verify against current docs during scaffold if anything errors.

## Architecture (locked before code)

- **State**: one plain-data `GameState` — tiles, cities, industries, rail nodes/edges, stations, routes, trains, money, tick counter, RNG seed/state. No class instances, no Pixi refs. Mutations only through action functions (`buildRail(state, …)`, `buyTrain(state, …)`). This is what makes save/load and headless testing trivial.
- **Loop**: fixed 10 Hz simulation tick via accumulator; game speeds ×0/×1/×2/×4 (run 0–4 ticks per frame-budget); render on rAF with train position interpolation (prev/current tick positions).
- **Tick order** (spec's, minus growth): `produceResources → moveTrains → handleStationLoading → handleDeliveries`.
- **Rendering**: Pixi v8. One world `Container` carrying pan/zoom transform, child layers in z-order: terrain (drawn once into a cached RenderTexture) → cities/industries → rails → stations → trains → selection/preview. Labels and floating "+$" as Pixi text; screen↔world conversion by hand; one stage-level pointer handler dispatching to the active tool.
- **Map**: ~128×96 tiles, 32 px/tile. Seeded value-noise/fBm terrain (hand-rolled, ~40 lines, no dependency) → water/grass/forest/hill/mountain; resources sprinkled on suitable terrain; cities placed by min-distance rejection sampling with a name list.
- **Rail graph**: nodes at tile centers; drag from node A to node B creates a straight edge (8 directions enforced), snap-to-existing-node radius, water tiles unbuildable. Stations are rail nodes with a catchment radius that auto-links the nearest city and/or industry.
- **Pathfinding**: A* over the graph, euclidean heuristic. Recompute train paths when the graph changes; trains with no valid path park with a visible "no path" status.
- **Economy MVP**: delivery payment = amount × distance × per-cargo rate; build costs for rail (per length), stations, trains. Placeholder numbers, tuned in the polish milestone.
- **Content as data**: `content/cargo.ts` and `content/industries.ts` definition tables so new cargo chains are data, not code.

### Folder structure (spec's, plus `core/` and `content/`)

```
src/
  main.ts
  core/    loop.ts  rng.ts  ids.ts
  game/    state.ts  types.ts  actions.ts  simulation.ts  economy.ts  cargo.ts
  content/ cargo.ts  industries.ts  cityNames.ts
  map/     generateMap.ts  terrain.ts
  rail/    graph.ts  pathfinding.ts  buildTrack.ts
  trains/  trainMovement.ts  routeLogic.ts
  render/  createPixiApp.ts  camera.ts  renderTerrain.ts  renderRails.ts
           renderStations.ts  renderTrains.ts  renderSelection.ts  floatingText.ts
  ui/      toolbar.ts  inspector.ts  routePanel.ts  hud.ts
  storage/ saveStore.ts  serialize.ts
```
Tests colocated as `*.test.ts` next to the module they cover.

## Milestones (each ends runnable and verified)

**M0 — Scaffold.** `git init` + .gitignore; hand-rolled Vite + vanilla-ts project in-place (package.json, strict tsconfig, index.html, vite.config.ts); deps: `pixi.js`; dev deps: `vite`, `typescript`, `vitest`; folder skeleton; fixed-tick loop running against an empty state with a debug HUD (tick count, fps, sim speed); this plan committed as `PLAN.md`.
✓ Dev server shows canvas + ticking HUD; `npx vitest run` and `tsc --noEmit` pass; initial commit.

**M1 — World.** Seeded terrain generation; city + industry placement; terrain rendered once to cached texture; city/industry markers + name labels; camera drag-pan and wheel zoom-to-cursor.
✓ Same seed ⇒ identical map (unit test); `GameState` JSON round-trip test (discipline enforced from day one); map looks right in browser preview, pan/zoom smooth.

**M2 — Rail building.** Toolbar (select / build rail / bulldoze); grid-snapped node + edge placement with drag preview and 8-direction constraint; cost preview, money deduction, insufficient-funds rejection; bulldoze refunds half; rails rendered (line + cross-ties).
✓ Graph unit tests (add/remove/degree/connectivity); build a loop of track interactively; can't build over water.

**M3 — Stations + pathfinding.** Station tool (station = rail node + catchment); auto-link nearest city/industry within radius; A* implementation; debug affordance: select two stations → path highlights.
✓ A* unit tests (shortest path, unreachable, direction handling); visual path highlight works.

**M4 — Trains + routes (minimal).** Route = ordered station list built by clicking stations; buy train onto a route; train computes leg paths, moves at fixed tick, dwells at stops, renders interpolated with correct heading; graph edits re-path or park trains with "no path" badge.
✓ Movement math unit tests (distance→position on multi-edge paths); a train visibly shuttles between two stations; deleting track under a route parks the train instead of crashing.

**M5 — Cargo + money (FIRST PLAYABLE — the spec's target).** Coal mine produces into linked station storage (capped); auto load/unload at stops; delivery payment + floating "+$" text; money HUD.
✓ **Headless integration test: scripted mine→city world runs 1,000 ticks, coal delivered, money strictly increased.** Manually: place two stations, connect rail, create route, assign train, watch coal move and money climb.

**M6 — Feedback UI.** Click-to-inspect panels (station storage, train cargo/status/speed, city demands, industry production); route panel listing stops, assigned trains, lifetime earnings per route; warnings for broken/unprofitable routes.
✓ Every entity type inspectable; route earnings visible and correct against test expectations.

**M7 — Save/load.** Versioned JSON envelope to localStorage via `SaveStore` interface; save / load / new-game(seed) UI; autosave every few sim-minutes.
✓ Round-trip test extended to full mid-game state; a train mid-journey survives reload at the same spot; autosave restores after tab refresh.

**M8 — Content & polish.** Second/third cargo chain (grain: farm→city, wood: forest→sawmill→city if cheap); per-train running costs so bad routes lose money; speed controls surfaced in HUD; hover highlights + build previews polished; light balance pass on all placeholder numbers.
✓ Two distinct profitable routes on one map; an idle train demonstrably drains money.

Deployment (Vercel/Netlify/CF Pages static build) is trivial post-M5 and off the critical path.

## Verification approach

- **Per milestone**: `tsc --noEmit` + `vitest run` green, then launch the Vite dev server with the preview tools, exercise the new feature interactively, and screenshot to confirm rendering.
- **Permanent regression net**: the pure-sim unit tests (rng, mapgen determinism, graph, A*, movement, cargo, economy) plus the M5 headless 1,000-tick delivery test.
- **State discipline**: JSON round-trip test from M1 forward, so save/load (M7) is a formality rather than a refactor.

## Risks

1. **Rail-building UX** (highest) — mitigated by grid-snap, node-only connections, no mid-edge splitting in MVP.
2. **Pixi v8 / Vite 8 / TS 6 API drift** vs. my training data — renderer kept thin; consult current docs (Context7) on any surprise.
3. **Scope creep** — the spec's own "features to avoid" list is adopted verbatim; anything on it is out of bounds for this build.
