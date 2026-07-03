import { describe, expect, it } from 'vitest'
import { makeTestState } from '../game/testWorld'
import {
  addEdge,
  buildAdjacency,
  edgesAtNode,
  findEdgeBetween,
  getNodeAt,
  getOrCreateNodeAt,
  removeEdge,
  removeNodeIfIsolated,
} from './graph'

describe('rail graph', () => {
  it('creates at most one node per tile', () => {
    const state = makeTestState()
    const a = getOrCreateNodeAt(state, 3, 3)
    const b = getOrCreateNodeAt(state, 3, 3)
    expect(a.id).toBe(b.id)
    expect(Object.keys(state.railNodes)).toHaveLength(1)
    expect(getNodeAt(state, 3, 3)?.id).toBe(a.id)
  })

  it('adds edges with euclidean length and dedupes regardless of direction', () => {
    const state = makeTestState()
    const a = getOrCreateNodeAt(state, 0, 0)
    const b = getOrCreateNodeAt(state, 3, 3)
    const e1 = addEdge(state, a.id, b.id)
    const e2 = addEdge(state, b.id, a.id)
    expect(e1.id).toBe(e2.id)
    expect(e1.length).toBeCloseTo(Math.hypot(3, 3))
    expect(findEdgeBetween(state, b.id, a.id)?.id).toBe(e1.id)
  })

  it('removing an edge cleans up isolated endpoints', () => {
    const state = makeTestState()
    const a = getOrCreateNodeAt(state, 0, 0)
    const b = getOrCreateNodeAt(state, 4, 0)
    const c = getOrCreateNodeAt(state, 8, 0)
    const ab = addEdge(state, a.id, b.id)
    addEdge(state, b.id, c.id)
    removeEdge(state, ab.id)
    expect(state.railNodes[a.id]).toBeUndefined() // isolated → removed
    expect(state.railNodes[b.id]).toBeDefined() // still connected to c
    expect(edgesAtNode(state, b.id)).toHaveLength(1)
  })

  it('does not remove nodes that host a station', () => {
    const state = makeTestState()
    const a = getOrCreateNodeAt(state, 0, 0)
    state.stations['st1'] = { id: 'st1', name: 'Test', nodeId: a.id, storage: {} }
    expect(removeNodeIfIsolated(state, a.id)).toBe(false)
    expect(state.railNodes[a.id]).toBeDefined()
  })

  it('builds a symmetric adjacency map', () => {
    const state = makeTestState()
    const a = getOrCreateNodeAt(state, 0, 0)
    const b = getOrCreateNodeAt(state, 4, 0)
    const c = getOrCreateNodeAt(state, 4, 4)
    addEdge(state, a.id, b.id)
    addEdge(state, b.id, c.id)
    const adj = buildAdjacency(state)
    expect(adj.get(a.id)?.map((n) => n.nodeId)).toEqual([b.id])
    expect(adj.get(b.id)?.map((n) => n.nodeId).sort()).toEqual([a.id, c.id].sort())
  })

  it('bumps railVersion on every mutation', () => {
    const state = makeTestState()
    const v0 = state.railVersion
    const a = getOrCreateNodeAt(state, 0, 0)
    const b = getOrCreateNodeAt(state, 2, 0)
    const e = addEdge(state, a.id, b.id)
    expect(state.railVersion).toBeGreaterThan(v0)
    const v1 = state.railVersion
    removeEdge(state, e.id)
    expect(state.railVersion).toBeGreaterThan(v1)
  })
})
