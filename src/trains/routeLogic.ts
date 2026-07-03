import { nextId } from '../core/ids'
import { exchangeCargo } from '../game/cargo'
import { BULLDOZE_REFUND, TRAIN_CAPACITY, TRAIN_COST, TRAIN_SPEED } from '../game/economy'
import type { GameState, Route, Train } from '../game/types'
import { findPath } from '../rail/pathfinding'

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
  if (!firstStation || !node) return { ok: false, reason: 'Route start station is missing' }

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
  // Pick up whatever is already waiting at the spawn station.
  exchangeCargo(state, state.trains[id]!, firstStation, [])
  return { ok: true, trainId: id }
}

export function sellTrain(state: GameState, trainId: string): void {
  if (!state.trains[trainId]) return
  delete state.trains[trainId]
  state.money += Math.round(TRAIN_COST * BULLDOZE_REFUND)
}

export function findTrainNear(
  state: GameState,
  wx: number,
  wy: number,
  maxDist = 0.7,
): Train | undefined {
  let best: Train | undefined
  let bestDist = maxDist
  for (const train of Object.values(state.trains)) {
    const d = Math.hypot(train.x + 0.5 - wx, train.y + 0.5 - wy)
    if (d < bestDist) {
      bestDist = d
      best = train
    }
  }
  return best
}

/** Human-readable train status, shared by inspector and warnings. */
export function trainStatusText(state: GameState, train: Train): string {
  const route = state.routes[train.routeId]
  const n = route?.stationIds.length ?? 0
  const targetId = n > 0 ? route!.stationIds[train.stopIndex % n] : undefined
  const name = targetId ? (state.stations[targetId]?.name ?? '?') : '?'
  switch (train.status) {
    case 'moving':
      return `En route to ${name}`
    case 'loading':
      return `Loading at ${name}`
    case 'noPath':
      return `No path to ${name}`
    case 'waiting':
      return 'Waiting — route unusable'
  }
}

// Broken-route checks run A* per hop; cache per graph version.
const brokenCache = new Map<string, boolean>()

/** True when any consecutive hop of the route has no rail path. */
export function routeBroken(state: GameState, route: Route): boolean {
  const key = `${state.railVersion}:${route.id}:${route.stationIds.join(',')}`
  const cached = brokenCache.get(key)
  if (cached !== undefined) return cached
  if (brokenCache.size > 300) brokenCache.clear()

  let broken = route.stationIds.length < 2
  if (!broken) {
    for (let i = 0; i < route.stationIds.length; i++) {
      const a = state.stations[route.stationIds[i]!]
      const b = state.stations[route.stationIds[(i + 1) % route.stationIds.length]!]
      if (!a || !b) {
        broken = true
        break
      }
      if (a.id === b.id) continue
      if (!findPath(state, a.nodeId, b.nodeId)) {
        broken = true
        break
      }
    }
  }
  brokenCache.set(key, broken)
  return broken
}
