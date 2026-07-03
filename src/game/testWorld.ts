import { createEmptyState } from './state'
import { TERRAINS, type GameState, type Terrain } from './types'

/**
 * Flat all-grass world for tests, with optional terrain overrides.
 * Test-only helper — never imported by game code.
 */
export function makeTestState(
  width = 20,
  height = 20,
  overrides: { x: number; y: number; terrain: Terrain }[] = [],
): GameState {
  const state = createEmptyState(1)
  state.map = {
    width,
    height,
    terrain: new Array<number>(width * height).fill(TERRAINS.indexOf('grass')),
  }
  for (const o of overrides) {
    state.map.terrain[o.y * width + o.x] = TERRAINS.indexOf(o.terrain)
  }
  return state
}
