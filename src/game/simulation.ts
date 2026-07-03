import { moveTrains } from '../trains/trainMovement'
import type { GameState } from './types'

/**
 * One fixed-timestep step of the world. Order matters and is part of the
 * game's semantics: produce → move → (load/unload happens on arrival).
 */
export function simulationTick(state: GameState, dt: number): void {
  state.tick++
  moveTrains(state, dt)
}
