import { nextId } from '../core/ids'
import { mulberry32, randInt } from '../core/rng'
import { CITY_NAMES } from '../content/cityNames'
import { INDUSTRY_DEFS } from '../content/industries'
import { createEmptyState } from '../game/state'
import type { CargoType, GameState, IndustryKind } from '../game/types'
import { generateTerrain, terrainAt } from './terrain'

const MAP_WIDTH = 128
const MAP_HEIGHT = 96
const CITY_MIN_DIST = 16
const CITY_EDGE_MARGIN = 5
const INDUSTRY_MIN_DIST_CITY = 5
const INDUSTRY_MIN_DIST_INDUSTRY = 6

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by)
}

export function newGame(seed: number): GameState {
  const state = createEmptyState(seed)
  state.map = generateTerrain(seed, MAP_WIDTH, MAP_HEIGHT)
  const rng = mulberry32(seed ^ 0x9e3779b9)
  placeCities(state, rng)
  placeIndustries(state, rng)
  return state
}

function placeCities(state: GameState, rng: () => number): void {
  const { map } = state
  const target = randInt(rng, 6, 8)
  const names = [...CITY_NAMES]
  // Deterministic Fisher-Yates shuffle for name variety across seeds.
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = names[i]!
    names[j] = names[j]!
    ;[names[i], names[j]] = [names[j]!, a]
  }

  const placed: { x: number; y: number }[] = []
  // Relax the spacing constraint if a seed makes placement too hard.
  for (const minDist of [CITY_MIN_DIST, 11, 8]) {
    let attempts = 0
    while (placed.length < target && attempts < 4000) {
      attempts++
      const x = randInt(rng, CITY_EDGE_MARGIN, map.width - 1 - CITY_EDGE_MARGIN)
      const y = randInt(rng, CITY_EDGE_MARGIN, map.height - 1 - CITY_EDGE_MARGIN)
      if (terrainAt(map, x, y) !== 'grass') continue
      if (placed.some((c) => dist(c.x, c.y, x, y) < minDist)) continue
      placed.push({ x, y })
      const population = randInt(rng, 400, 2600)
      const demands: CargoType[] = population > 1500 ? ['coal', 'grain', 'goods'] : ['coal', 'grain']
      const id = nextId(state, 'city')
      state.cities[id] = {
        id,
        name: names[placed.length - 1] ?? `City ${placed.length}`,
        x,
        y,
        population,
        demands,
      }
    }
    if (placed.length >= target) break
  }
}

function placeIndustries(state: GameState, rng: () => number): void {
  const { map } = state
  const cities = Object.values(state.cities)
  const placed: { x: number; y: number }[] = []

  for (const [kind, def] of Object.entries(INDUSTRY_DEFS) as [
    IndustryKind,
    (typeof INDUSTRY_DEFS)[IndustryKind],
  ][]) {
    const target = randInt(rng, def.count[0], def.count[1])
    let count = 0
    let attempts = 0
    while (count < target && attempts < 4000) {
      attempts++
      const x = randInt(rng, 2, map.width - 3)
      const y = randInt(rng, 2, map.height - 3)
      if (!def.terrain.includes(terrainAt(map, x, y))) continue
      if (cities.some((c) => dist(c.x, c.y, x, y) < INDUSTRY_MIN_DIST_CITY)) continue
      if (placed.some((p) => dist(p.x, p.y, x, y) < INDUSTRY_MIN_DIST_INDUSTRY)) continue
      placed.push({ x, y })
      count++
      const id = nextId(state, 'ind')
      state.industries[id] = { id, kind, x, y, inventory: {}, progress: 0 }
    }
  }
}
