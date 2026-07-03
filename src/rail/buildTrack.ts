import { BULLDOZE_REFUND, RAIL_COST_PER_TILE, TERRAIN_COST_MULT } from '../game/economy'
import type { GameState, RailEdge } from '../game/types'
import { inBounds, terrainAt } from '../map/terrain'
import { addEdge, getOrCreateNodeAt, removeEdge, removeNodeIfIsolated } from './graph'

export interface PlacementCheck {
  ok: boolean
  reason?: string
  cost: number
}

/** Steps of the discrete line a→b (valid only for 8-direction segments). */
function tilesAlong(ax: number, ay: number, bx: number, by: number): { x: number; y: number }[] {
  const dx = Math.sign(bx - ax)
  const dy = Math.sign(by - ay)
  const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay))
  const tiles: { x: number; y: number }[] = []
  for (let i = 0; i <= n; i++) tiles.push({ x: ax + i * dx, y: ay + i * dy })
  return tiles
}

export function railCost(state: GameState, ax: number, ay: number, bx: number, by: number): number {
  const stepLength = ax !== bx && ay !== by ? Math.SQRT2 : 1
  const tiles = tilesAlong(ax, ay, bx, by)
  let cost = 0
  // Charge per tile crossed, weighted by terrain; endpoints count half each.
  tiles.forEach((t, i) => {
    const mult = TERRAIN_COST_MULT[terrainAt(state.map, t.x, t.y)]
    const weight = i === 0 || i === tiles.length - 1 ? 0.5 : 1
    cost += mult * weight * stepLength * RAIL_COST_PER_TILE
  })
  return Math.round(cost)
}

export function checkRailPlacement(
  state: GameState,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): PlacementCheck {
  if (ax === bx && ay === by) return { ok: false, reason: 'Zero length', cost: 0 }
  if (!inBounds(state.map, ax, ay) || !inBounds(state.map, bx, by))
    return { ok: false, reason: 'Out of bounds', cost: 0 }
  const dx = bx - ax
  const dy = by - ay
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy))
    return { ok: false, reason: 'Track must run straight or at 45°', cost: 0 }
  for (const t of tilesAlong(ax, ay, bx, by)) {
    if (terrainAt(state.map, t.x, t.y) === 'water')
      return { ok: false, reason: "Can't build over water", cost: 0 }
  }
  const cost = railCost(state, ax, ay, bx, by)
  if (state.money < cost) return { ok: false, reason: 'Not enough money', cost }
  return { ok: true, cost }
}

/** Validate and, if valid, mutate: create nodes/edge and charge the player. */
export function buildRail(
  state: GameState,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): PlacementCheck {
  const check = checkRailPlacement(state, ax, ay, bx, by)
  if (!check.ok) return check
  const a = getOrCreateNodeAt(state, ax, ay)
  const b = getOrCreateNodeAt(state, bx, by)
  const before = Object.keys(state.railEdges).length
  addEdge(state, a.id, b.id)
  if (Object.keys(state.railEdges).length === before)
    return { ok: false, reason: 'Track already exists', cost: 0 }
  state.money -= check.cost
  return check
}

/** Refund half the build cost and clean up now-isolated endpoints. */
export function bulldozeEdge(state: GameState, edgeId: string): void {
  const edge = state.railEdges[edgeId]
  if (!edge) return
  const a = state.railNodes[edge.a]
  const b = state.railNodes[edge.b]
  if (a && b) state.money += Math.round(railCost(state, a.x, a.y, b.x, b.y) * BULLDOZE_REFUND)
  removeEdge(state, edgeId)
}

/** Distance from point p to segment ab, all in tile-center coordinates. */
function pointSegmentDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const vx = bx - ax
  const vy = by - ay
  const lengthSq = vx * vx + vy * vy
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / lengthSq))
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy))
}

/** Edge whose line passes closest to the world point, within maxDist tiles. */
export function findEdgeNear(
  state: GameState,
  wx: number,
  wy: number,
  maxDist = 0.45,
): RailEdge | undefined {
  let best: RailEdge | undefined
  let bestDist = maxDist
  for (const edge of Object.values(state.railEdges)) {
    const a = state.railNodes[edge.a]
    const b = state.railNodes[edge.b]
    if (!a || !b) continue
    const d = pointSegmentDist(wx, wy, a.x + 0.5, a.y + 0.5, b.x + 0.5, b.y + 0.5)
    if (d < bestDist) {
      bestDist = d
      best = edge
    }
  }
  return best
}

/** Convenience for tests/tools: remove an isolated leftover node by position. */
export { removeNodeIfIsolated }
