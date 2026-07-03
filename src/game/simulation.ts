import { moveTrains } from '../trains/trainMovement'
import { produceResources } from './cargo'
import type { GameState, SimEvent } from './types'

/**
 * One fixed-timestep step of the world. Order matters and is part of the
 * game's semantics: produce → move (cargo exchanges happen on arrival).
 * Returns transient events for the renderer (floating payment text etc.).
 */
export function simulationTick(state: GameState, dt: number): SimEvent[] {
  state.tick++
  const events: SimEvent[] = []
  produceResources(state, dt)
  moveTrains(state, dt, events)
  return events
}
