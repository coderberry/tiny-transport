import { describe, expect, it } from 'vitest'
import { RAIL_COST_PER_TILE } from '../game/economy'
import { makeTestState } from '../game/testWorld'
import { buildRail, bulldozeEdge, checkRailPlacement, findEdgeNear, railCost } from './buildTrack'

describe('checkRailPlacement', () => {
  it('accepts straight and 45° segments', () => {
    const state = makeTestState()
    expect(checkRailPlacement(state, 0, 0, 5, 0).ok).toBe(true)
    expect(checkRailPlacement(state, 0, 0, 0, 5).ok).toBe(true)
    expect(checkRailPlacement(state, 0, 0, 5, 5).ok).toBe(true)
  })

  it('rejects bent segments', () => {
    const state = makeTestState()
    const check = checkRailPlacement(state, 0, 0, 5, 2)
    expect(check.ok).toBe(false)
    expect(check.reason).toMatch(/straight/)
  })

  it('rejects segments crossing water', () => {
    const state = makeTestState(20, 20, [{ x: 2, y: 0, terrain: 'water' }])
    const check = checkRailPlacement(state, 0, 0, 5, 0)
    expect(check.ok).toBe(false)
    expect(check.reason).toMatch(/water/)
  })

  it('rejects zero-length and out-of-bounds segments', () => {
    const state = makeTestState()
    expect(checkRailPlacement(state, 3, 3, 3, 3).ok).toBe(false)
    expect(checkRailPlacement(state, 0, 0, 25, 0).ok).toBe(false)
  })

  it('rejects when the player cannot afford it', () => {
    const state = makeTestState()
    state.money = 10
    const check = checkRailPlacement(state, 0, 0, 5, 0)
    expect(check.ok).toBe(false)
    expect(check.reason).toMatch(/money/i)
  })
})

describe('railCost', () => {
  it('charges per tile on flat grass', () => {
    const state = makeTestState()
    // 5 tiles covered, endpoints half-weighted → 4 tile-equivalents.
    expect(railCost(state, 0, 0, 4, 0)).toBe(4 * RAIL_COST_PER_TILE)
  })

  it('charges more for diagonals and rough terrain', () => {
    const state = makeTestState(20, 20, [
      { x: 1, y: 0, terrain: 'mountain' },
      { x: 2, y: 0, terrain: 'mountain' },
    ])
    expect(railCost(state, 0, 0, 4, 4)).toBeGreaterThan(railCost(state, 0, 4, 4, 4))
    expect(railCost(state, 0, 0, 4, 0)).toBeGreaterThan(4 * RAIL_COST_PER_TILE)
  })
})

describe('buildRail / bulldozeEdge', () => {
  it('creates nodes and edge and charges money', () => {
    const state = makeTestState()
    const before = state.money
    const result = buildRail(state, 0, 0, 4, 0)
    expect(result.ok).toBe(true)
    expect(state.money).toBe(before - result.cost)
    expect(Object.keys(state.railNodes)).toHaveLength(2)
    expect(Object.keys(state.railEdges)).toHaveLength(1)
  })

  it('rejects duplicate track without charging', () => {
    const state = makeTestState()
    buildRail(state, 0, 0, 4, 0)
    const moneyAfterFirst = state.money
    const dup = buildRail(state, 4, 0, 0, 0)
    expect(dup.ok).toBe(false)
    expect(state.money).toBe(moneyAfterFirst)
    expect(Object.keys(state.railEdges)).toHaveLength(1)
  })

  it('bulldozing refunds half and removes orphan nodes', () => {
    const state = makeTestState()
    const result = buildRail(state, 0, 0, 4, 0)
    const afterBuild = state.money
    const edgeId = Object.keys(state.railEdges)[0]!
    bulldozeEdge(state, edgeId)
    expect(state.money).toBe(afterBuild + Math.round(result.cost * 0.5))
    expect(Object.keys(state.railEdges)).toHaveLength(0)
    expect(Object.keys(state.railNodes)).toHaveLength(0)
  })
})

describe('findEdgeNear', () => {
  it('finds the closest edge within range, and nothing beyond it', () => {
    const state = makeTestState()
    buildRail(state, 0, 0, 4, 0)
    buildRail(state, 0, 4, 4, 4)
    const near = findEdgeNear(state, 2.5, 0.6)
    expect(near).toBeDefined()
    const a = state.railNodes[near!.a]!
    expect(a.y).toBe(0) // the y=0 line, not the y=4 one
    expect(findEdgeNear(state, 2.5, 2)).toBeUndefined()
  })
})
