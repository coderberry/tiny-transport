import { nextId } from '../core/ids'
import type { GameState, RailEdge, RailNode } from '../game/types'

/** Nodes live on integer tile coordinates; at most one node per tile. */
export function getNodeAt(state: GameState, x: number, y: number): RailNode | undefined {
  for (const node of Object.values(state.railNodes)) {
    if (node.x === x && node.y === y) return node
  }
  return undefined
}

export function getOrCreateNodeAt(state: GameState, x: number, y: number): RailNode {
  const existing = getNodeAt(state, x, y)
  if (existing) return existing
  const id = nextId(state, 'n')
  const node: RailNode = { id, x, y }
  state.railNodes[id] = node
  state.railVersion++
  return node
}

export function findEdgeBetween(
  state: GameState,
  aId: string,
  bId: string,
): RailEdge | undefined {
  for (const edge of Object.values(state.railEdges)) {
    if ((edge.a === aId && edge.b === bId) || (edge.a === bId && edge.b === aId)) return edge
  }
  return undefined
}

export function edgeLength(a: RailNode, b: RailNode): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function addEdge(state: GameState, aId: string, bId: string): RailEdge {
  const a = state.railNodes[aId]
  const b = state.railNodes[bId]
  if (!a || !b) throw new Error(`addEdge: missing node ${aId} or ${bId}`)
  const existing = findEdgeBetween(state, aId, bId)
  if (existing) return existing
  const id = nextId(state, 'e')
  const edge: RailEdge = { id, a: aId, b: bId, length: edgeLength(a, b) }
  state.railEdges[id] = edge
  state.railVersion++
  return edge
}

export function removeEdge(state: GameState, edgeId: string): void {
  const edge = state.railEdges[edgeId]
  if (!edge) return
  delete state.railEdges[edgeId]
  state.railVersion++
  removeNodeIfIsolated(state, edge.a)
  removeNodeIfIsolated(state, edge.b)
}

export function nodeHasStation(state: GameState, nodeId: string): boolean {
  return Object.values(state.stations).some((s) => s.nodeId === nodeId)
}

export function edgesAtNode(state: GameState, nodeId: string): RailEdge[] {
  return Object.values(state.railEdges).filter((e) => e.a === nodeId || e.b === nodeId)
}

/** Removes a node with no edges and no station. Returns true if removed. */
export function removeNodeIfIsolated(state: GameState, nodeId: string): boolean {
  if (nodeHasStation(state, nodeId)) return false
  if (edgesAtNode(state, nodeId).length > 0) return false
  if (!state.railNodes[nodeId]) return false
  delete state.railNodes[nodeId]
  state.railVersion++
  return true
}

export interface Neighbor {
  edge: RailEdge
  nodeId: string
}

/** Adjacency map for pathfinding; rebuild is cheap at MVP graph sizes. */
export function buildAdjacency(state: GameState): Map<string, Neighbor[]> {
  const adj = new Map<string, Neighbor[]>()
  for (const nodeId of Object.keys(state.railNodes)) adj.set(nodeId, [])
  for (const edge of Object.values(state.railEdges)) {
    adj.get(edge.a)?.push({ edge, nodeId: edge.b })
    adj.get(edge.b)?.push({ edge, nodeId: edge.a })
  }
  return adj
}
