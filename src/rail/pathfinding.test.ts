import { describe, expect, it } from 'vitest'
import { makeTestState } from '../game/testWorld'
import { buildRail } from './buildTrack'
import { getNodeAt } from './graph'
import { findPath, nodeSequence } from './pathfinding'

function nodeId(state: ReturnType<typeof makeTestState>, x: number, y: number): string {
  const node = getNodeAt(state, x, y)
  if (!node) throw new Error(`no node at ${x},${y}`)
  return node.id
}

describe('findPath', () => {
  it('finds a straight path with correct length and direction', () => {
    const state = makeTestState()
    buildRail(state, 0, 0, 5, 0)
    buildRail(state, 5, 0, 10, 0)
    const path = findPath(state, nodeId(state, 0, 0), nodeId(state, 10, 0))
    expect(path).not.toBeNull()
    expect(path!.length).toBeCloseTo(10)
    expect(path!.steps).toHaveLength(2)
    const seq = nodeSequence(state, nodeId(state, 0, 0), path!.steps)
    expect(seq).toEqual([nodeId(state, 0, 0), nodeId(state, 5, 0), nodeId(state, 10, 0)])
  })

  it('handles edges traversed against their stored direction', () => {
    const state = makeTestState()
    // Build right-to-left so edge.a is the *far* node.
    buildRail(state, 10, 0, 5, 0)
    buildRail(state, 5, 0, 0, 0)
    const path = findPath(state, nodeId(state, 0, 0), nodeId(state, 10, 0))
    expect(path).not.toBeNull()
    expect(path!.steps.every((s) => s.reversed)).toBe(true)
    const seq = nodeSequence(state, nodeId(state, 0, 0), path!.steps)
    expect(seq[seq.length - 1]).toBe(nodeId(state, 10, 0))
  })

  it('prefers the shorter of two routes', () => {
    const state = makeTestState(30, 30)
    // Direct: (0,0)→(10,0). Detour: (0,0)→(0,10)→(10,10)→(10,0).
    buildRail(state, 0, 0, 10, 0)
    buildRail(state, 0, 0, 0, 10)
    buildRail(state, 0, 10, 10, 10)
    buildRail(state, 10, 10, 10, 0)
    const path = findPath(state, nodeId(state, 0, 0), nodeId(state, 10, 0))
    expect(path!.length).toBeCloseTo(10)
    expect(path!.steps).toHaveLength(1)
  })

  it('routes around gaps via diagonals', () => {
    const state = makeTestState(30, 30)
    buildRail(state, 0, 0, 5, 5)
    buildRail(state, 5, 5, 10, 0)
    const path = findPath(state, nodeId(state, 0, 0), nodeId(state, 10, 0))
    expect(path!.length).toBeCloseTo(2 * Math.hypot(5, 5))
  })

  it('returns null when unreachable', () => {
    const state = makeTestState()
    buildRail(state, 0, 0, 5, 0)
    buildRail(state, 0, 5, 5, 5) // disconnected line
    expect(findPath(state, nodeId(state, 0, 0), nodeId(state, 5, 5))).toBeNull()
  })

  it('returns an empty path for identical endpoints', () => {
    const state = makeTestState()
    buildRail(state, 0, 0, 5, 0)
    const path = findPath(state, nodeId(state, 0, 0), nodeId(state, 0, 0))
    expect(path).toEqual({ steps: [], length: 0 })
  })
})
