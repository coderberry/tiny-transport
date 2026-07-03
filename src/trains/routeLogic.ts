import { nextId } from '../core/ids'
import { BULLDOZE_REFUND, TRAIN_CAPACITY, TRAIN_COST, TRAIN_SPEED } from '../game/economy'
import type { GameState, Train } from '../game/types'

export interface RouteActionResult {
  ok: boolean
  reason?: string
  routeId?: string
  trainId?: string
}

export function createRoute(state: GameState, stationIds: string[]): RouteActionResult {
  const valid = stationIds.filter((id) => state.stations[id])
  if (valid.length < 2) return { ok: false, reason: 'A route needs at least two stations' }
  const id = nextId(state, 'r')
  state.routes[id] = {
    id,
    name: `Line ${Object.keys(state.routes).length + 1}`,
    stationIds: valid,
    totalEarned: 0,
  }
  return { ok: true, routeId: id }
}

export function trainsOnRoute(state: GameState, routeId: string): Train[] {
  return Object.values(state.trains).filter((t) => t.routeId === routeId)
}

/** Deleting a route sells its trains (half refund each). */
export function deleteRoute(state: GameState, routeId: string): void {
  if (!state.routes[routeId]) return
  for (const train of trainsOnRoute(state, routeId)) sellTrain(state, train.id)
  delete state.routes[routeId]
}

export function buyTrain(state: GameState, routeId: string): RouteActionResult {
  const route = state.routes[routeId]
  if (!route) return { ok: false, reason: 'No such route' }
  if (route.stationIds.length < 2) return { ok: false, reason: 'Route needs two stops first' }
  if (state.money < TRAIN_COST) return { ok: false, reason: 'Not enough money' }
  const firstStation = state.stations[route.stationIds[0]!]
  const node = firstStation ? state.railNodes[firstStation.nodeId] : undefined
  if (!node) return { ok: false, reason: 'Route start station is missing' }

  const id = nextId(state, 't')
  state.trains[id] = {
    id,
    routeId,
    stopIndex: 0,
    atNodeId: node.id,
    path: null,
    pathLength: 0,
    distance: 0,
    x: node.x,
    y: node.y,
    prevX: node.x,
    prevY: node.y,
    heading: 0,
    speed: TRAIN_SPEED,
    capacity: TRAIN_CAPACITY,
    cargo: {},
    cargoOrigin: {},
    status: 'loading',
    dwellRemaining: 1, // brief spawn pause, then off to stop 2
    repathCooldown: 0,
    totalEarned: 0,
  }
  state.money -= TRAIN_COST
  return { ok: true, trainId: id }
}

export function sellTrain(state: GameState, trainId: string): void {
  if (!state.trains[trainId]) return
  delete state.trains[trainId]
  state.money += Math.round(TRAIN_COST * BULLDOZE_REFUND)
}
