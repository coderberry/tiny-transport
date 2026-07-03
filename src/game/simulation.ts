import { moveTrains } from '../trains/trainMovement'
import { produceResources } from './cargo'
import { TRAIN_RUNNING_COST_PER_SEC } from './economy'
import type { GameState, SimEvent } from './types'

/**
 * One fixed-timestep step of the world. Order matters and is part of the
 * game's semantics: produce → move (cargo exchanges happen on arrival) →
 * upkeep. Returns transient events for the renderer (floating text etc.).
 */
export function simulationTick(state: GameState, dt: number): SimEvent[] {
  state.tick++
  const events: SimEvent[] = []
  produceResources(state, dt)
  moveTrains(state, dt, events)
  state.money -= Object.keys(state.trains).length * TRAIN_RUNNING_COST_PER_SEC * dt
  return events
}
