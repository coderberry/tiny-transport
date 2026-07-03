import { exchangeCargo } from '../game/cargo'
import { TRAIN_DWELL_SECONDS } from '../game/economy'
import type { GameState, PathStep, SimEvent, Train } from '../game/types'
import { findPath, type PathResult } from '../rail/pathfinding'

const REPATH_INTERVAL = 2 // seconds between retries when parked

export interface PathPoint {
  x: number
  y: number
  heading: number
}

/** Position and heading after traveling `distance` tiles along the steps. */
export function pointAlongPath(
  state: GameState,
  steps: PathStep[],
  distance: number,
): PathPoint | null {
  if (steps.length === 0) return null
  let remaining = Math.max(0, distance)
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!
    const edge = state.railEdges[step.edgeId]
    if (!edge) return null
    const from = state.railNodes[step.reversed ? edge.b : edge.a]
    const to = state.railNodes[step.reversed ? edge.a : edge.b]
    if (!from || !to) return null
    if (remaining <= edge.length || i === steps.length - 1) {
      const t = edge.length === 0 ? 1 : Math.min(1, remaining / edge.length)
      return {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        heading: Math.atan2(to.y - from.y, to.x - from.x),
      }
    }
    remaining -= edge.length
  }
  return null
}

function pathValid(state: GameState, steps: PathStep[]): boolean {
  return steps.every((s) => {
    const edge = state.railEdges[s.edgeId]
    return edge !== undefined && state.railNodes[edge.a] && state.railNodes[edge.b]
  })
}

function nearestNodeId(state: GameState, x: number, y: number): string | null {
  let best: string | null = null
  let bestDist = Infinity
  for (const node of Object.values(state.railNodes)) {
    const d = Math.hypot(node.x - x, node.y - y)
    if (d < bestDist) {
      bestDist = d
      best = node.id
    }
  }
  return best
}

/** Furthest node the train has already passed on its (possibly broken) path. */
function lastPassedNodeId(state: GameState, train: Train): string | null {
  let remaining = train.distance
  let last: string | null = null
  for (const step of train.path ?? []) {
    const edge = state.railEdges[step.edgeId]
    if (!edge) break
    const fromId = step.reversed ? edge.b : edge.a
    const toId = step.reversed ? edge.a : edge.b
    if (!state.railNodes[fromId]) break
    last = fromId
    if (remaining <= edge.length) {
      if (remaining >= edge.length - 1e-6 && state.railNodes[toId]) last = toId
      break
    }
    remaining -= edge.length
    if (!state.railNodes[toId]) break
    last = toId
  }
  return last
}

/** Track under the train vanished: snap back to a safe node and retry soon. */
function parkTrain(state: GameState, train: Train): void {
  const nodeId = lastPassedNodeId(state, train) ?? nearestNodeId(state, train.x, train.y)
  if (nodeId) {
    const node = state.railNodes[nodeId]!
    train.x = node.x
    train.y = node.y
    train.prevX = node.x
    train.prevY = node.y
    train.atNodeId = nodeId
  } else {
    train.atNodeId = null
  }
  train.path = null
  train.pathLength = 0
  train.distance = 0
  train.status = 'noPath'
  train.repathCooldown = 0.5
}

function startMoving(train: Train, path: PathResult): void {
  train.path = path.steps
  train.pathLength = path.length
  train.distance = 0
  train.status = 'moving'
  train.atNodeId = null
}

function stationCount(state: GameState, train: Train): number {
  return state.routes[train.routeId]?.stationIds.length ?? 0
}

/** Dwell finished: head for the NEXT stop on the route. */
function tryDepart(state: GameState, train: Train): void {
  const route = state.routes[train.routeId]
  if (!route || route.stationIds.length < 2) {
    train.status = 'waiting'
    train.repathCooldown = REPATH_INTERVAL
    return
  }
  const n = route.stationIds.length
  train.stopIndex = train.stopIndex % n
  const nextIndex = (train.stopIndex + 1) % n
  const target = state.stations[route.stationIds[nextIndex]!]
  const fromNodeId = train.atNodeId ?? nearestNodeId(state, train.x, train.y)
  if (!target || !fromNodeId) {
    train.status = 'waiting'
    train.repathCooldown = REPATH_INTERVAL
    return
  }
  const path = findPath(state, fromNodeId, target.nodeId)
  if (!path) {
    train.status = 'noPath'
    train.repathCooldown = REPATH_INTERVAL
    return
  }
  train.stopIndex = nextIndex
  startMoving(train, path)
}

/** Parked without a path: keep aiming for the CURRENT target stop. */
function tryResume(state: GameState, train: Train): void {
  const route = state.routes[train.routeId]
  if (!route || route.stationIds.length < 2) {
    train.status = 'waiting'
    train.repathCooldown = REPATH_INTERVAL
    return
  }
  train.stopIndex = train.stopIndex % route.stationIds.length
  const target = state.stations[route.stationIds[train.stopIndex]!]
  const fromNodeId = train.atNodeId ?? nearestNodeId(state, train.x, train.y)
  if (!target || !fromNodeId) {
    train.repathCooldown = REPATH_INTERVAL
    return
  }
  train.atNodeId = fromNodeId
  const path = findPath(state, fromNodeId, target.nodeId)
  if (!path) {
    train.repathCooldown = REPATH_INTERVAL
    return
  }
  startMoving(train, path)
}

/** Arrived at the target stop: snap to its node, exchange cargo, dwell. */
function arrive(state: GameState, train: Train, events: SimEvent[]): void {
  const route = state.routes[train.routeId]
  const stationId = route?.stationIds[train.stopIndex % Math.max(stationCount(state, train), 1)]
  const station = stationId ? state.stations[stationId] : undefined
  const node = station ? state.railNodes[station.nodeId] : undefined
  if (node) {
    train.x = node.x
    train.y = node.y
    train.atNodeId = node.id
  }
  train.path = null
  train.pathLength = 0
  train.distance = 0
  train.status = 'loading'
  train.dwellRemaining = TRAIN_DWELL_SECONDS
  if (station) exchangeCargo(state, train, station, events)
}

export function moveTrains(state: GameState, dt: number, events: SimEvent[] = []): void {
  for (const train of Object.values(state.trains)) {
    train.prevX = train.x
    train.prevY = train.y

    switch (train.status) {
      case 'moving': {
        if (!train.path || !pathValid(state, train.path)) {
          parkTrain(state, train)
          break
        }
        train.distance += train.speed * dt
        if (train.distance >= train.pathLength) {
          arrive(state, train, events)
        } else {
          const p = pointAlongPath(state, train.path, train.distance)
          if (p) {
            train.x = p.x
            train.y = p.y
            train.heading = p.heading
          }
        }
        break
      }
      case 'loading': {
        train.dwellRemaining -= dt
        if (train.dwellRemaining <= 0) tryDepart(state, train)
        break
      }
      case 'noPath': {
        train.repathCooldown -= dt
        if (train.repathCooldown <= 0) tryResume(state, train)
        break
      }
      case 'waiting': {
        train.repathCooldown -= dt
        if (train.repathCooldown <= 0) tryDepart(state, train)
        break
      }
    }
  }
}
