import type { GameState } from './types'

export const STARTING_MONEY = 100_000

export function createEmptyState(seed: number): GameState {
  return {
    seed,
    tick: 0,
    money: STARTING_MONEY,
    map: { width: 0, height: 0, terrain: [] },
    cities: {},
    industries: {},
    railNodes: {},
    railEdges: {},
    stations: {},
    routes: {},
    trains: {},
    nextId: 1,
    railVersion: 0,
  }
}
