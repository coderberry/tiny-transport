import type { GameState, PathStep } from '../game/types'
import { buildAdjacency } from './graph'

export interface PathResult {
  steps: PathStep[]
  /** Total length in tiles. */
  length: number
}

/**
 * A* over the rail graph with a euclidean heuristic (admissible: edge cost
 * IS euclidean distance). Linear extract-min is plenty at MVP graph sizes.
 */
export function findPath(
  state: GameState,
  fromNodeId: string,
  toNodeId: string,
): PathResult | null {
  const startNode = state.railNodes[fromNodeId]
  const goalNode = state.railNodes[toNodeId]
  if (!startNode || !goalNode) return null
  if (fromNodeId === toNodeId) return { steps: [], length: 0 }

  const h = (id: string) => {
    const n = state.railNodes[id]
    return n ? Math.hypot(n.x - goalNode.x, n.y - goalNode.y) : Infinity
  }

  const adj = buildAdjacency(state)
  const gScore = new Map<string, number>([[fromNodeId, 0]])
  const fScore = new Map<string, number>([[fromNodeId, h(fromNodeId)]])
  const cameFrom = new Map<string, { nodeId: string; edgeId: string }>()
  const open = new Set<string>([fromNodeId])
  const closed = new Set<string>()

  while (open.size > 0) {
    let current: string | undefined
    let best = Infinity
    for (const id of open) {
      const f = fScore.get(id) ?? Infinity
      if (f < best) {
        best = f
        current = id
      }
    }
    if (current === undefined) break
    if (current === toNodeId) return reconstruct(state, cameFrom, fromNodeId, toNodeId)

    open.delete(current)
    closed.add(current)

    for (const { edge, nodeId: neighbor } of adj.get(current) ?? []) {
      if (closed.has(neighbor)) continue
      const tentative = (gScore.get(current) ?? Infinity) + edge.length
      if (tentative < (gScore.get(neighbor) ?? Infinity)) {
        gScore.set(neighbor, tentative)
        fScore.set(neighbor, tentative + h(neighbor))
        cameFrom.set(neighbor, { nodeId: current, edgeId: edge.id })
        open.add(neighbor)
      }
    }
  }
  return null
}

function reconstruct(
  state: GameState,
  cameFrom: Map<string, { nodeId: string; edgeId: string }>,
  from: string,
  to: string,
): PathResult {
  const steps: PathStep[] = []
  let length = 0
  let cursor = to
  while (cursor !== from) {
    const prev = cameFrom.get(cursor)
    if (!prev) throw new Error('reconstruct: broken cameFrom chain')
    const edge = state.railEdges[prev.edgeId]
    if (!edge) throw new Error('reconstruct: missing edge')
    // Traveling prev.nodeId → cursor: forward means edge.a is the origin.
    steps.push({ edgeId: edge.id, reversed: edge.a !== prev.nodeId })
    length += edge.length
    cursor = prev.nodeId
  }
  steps.reverse()
  return { steps, length }
}

/**
 * Expand a step list into the node ids visited, starting at startNodeId.
 * Also validates continuity — used by tests and train movement.
 */
export function nodeSequence(state: GameState, startNodeId: string, steps: PathStep[]): string[] {
  const seq = [startNodeId]
  let cursor = startNodeId
  for (const step of steps) {
    const edge = state.railEdges[step.edgeId]
    if (!edge) throw new Error(`nodeSequence: missing edge ${step.edgeId}`)
    const [fromId, toId] = step.reversed ? [edge.b, edge.a] : [edge.a, edge.b]
    if (fromId !== cursor)
      throw new Error(`nodeSequence: discontinuous path at ${step.edgeId} (${fromId} != ${cursor})`)
    seq.push(toId)
    cursor = toId
  }
  return seq
}
