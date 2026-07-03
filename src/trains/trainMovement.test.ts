import { describe, expect, it } from 'vitest'
import { buildStation } from '../game/actions'
import { makeTestState } from '../game/testWorld'
import type { GameState, Train } from '../game/types'
import { buildRail, bulldozeEdge } from '../rail/buildTrack'
import { getNodeAt } from '../rail/graph'
import { findPath } from '../rail/pathfinding'
import { buyTrain, createRoute } from './routeLogic'
import { moveTrains, pointAlongPath } from './trainMovement'

const DT = 0.1

function run(state: GameState, ticks: number): void {
  for (let i = 0; i < ticks; i++) moveTrains(state, DT)
}

/** Straight test line (0,0)→(10,0) with a station at each end and a route. */
function lineWorld() {
  const state = makeTestState(30, 30)
  buildRail(state, 0, 0, 10, 0)
  const a = buildStation(state, 0, 0).stationId!
  const b = buildStation(state, 10, 0).stationId!
  const routeId = createRoute(state, [a, b]).routeId!
  return { state, a, b, routeId }
}

function theTrain(state: GameState): Train {
  const train = Object.values(state.trains)[0]
  if (!train) throw new Error('no train')
  return train
}

describe('pointAlongPath', () => {
  it('interpolates across multiple edges, including reversed ones', () => {
    const state = makeTestState(30, 30)
    buildRail(state, 0, 0, 5, 0)
    buildRail(state, 5, 5, 5, 0) // built "backwards" so traversal is reversed
    const path = findPath(state, getNodeAt(state, 0, 0)!.id, getNodeAt(state, 5, 5)!.id)!
    expect(path.length).toBeCloseTo(10)

    const p2 = pointAlongPath(state, path.steps, 2)!
    expect(p2.x).toBeCloseTo(2)
    expect(p2.y).toBeCloseTo(0)

    const p7 = pointAlongPath(state, path.steps, 7)!
    expect(p7.x).toBeCloseTo(5)
    expect(p7.y).toBeCloseTo(2)
    expect(p7.heading).toBeCloseTo(Math.PI / 2)

    // Past the end clamps to the goal.
    const pEnd = pointAlongPath(state, path.steps, 99)!
    expect(pEnd.x).toBeCloseTo(5)
    expect(pEnd.y).toBeCloseTo(5)
  })
})

describe('train lifecycle', () => {
  it('spawns at the first stop, departs, travels, arrives, and returns', () => {
    const { state } = lineWorld()
    expect(buyTrain(state, Object.keys(state.routes)[0]!).ok).toBe(true)
    const train = theTrain(state)
    expect(train.x).toBe(0)
    expect(train.status).toBe('loading')

    run(state, 12) // spawn dwell is 1s
    expect(train.status).toBe('moving')
    expect(train.stopIndex).toBe(1)

    const xEarly = train.x
    run(state, 5)
    expect(train.x).toBeGreaterThan(xEarly) // monotonically advancing

    run(state, 25) // 10 tiles at 6 t/s ≈ 1.7s total travel
    expect(train.status).toBe('loading')
    expect(train.x).toBe(10) // snapped to station B

    run(state, 20) // finish the 3s dwell, start the homeward leg
    expect(train.status).toBe('moving')
    expect(train.stopIndex).toBe(0)
    run(state, 5)
    expect(train.x).toBeLessThan(10)
  })

  it('needs a route with two stops and enough money', () => {
    const state = makeTestState()
    buildRail(state, 0, 0, 5, 0)
    const only = buildStation(state, 0, 0).stationId!
    expect(createRoute(state, [only]).ok).toBe(false)
    const { state: s2, routeId } = lineWorld()
    s2.money = 100
    expect(buyTrain(s2, routeId).ok).toBe(false)
  })

  it('parks with noPath when its track is bulldozed mid-journey, then resumes', () => {
    const { state } = lineWorld()
    buyTrain(state, Object.keys(state.routes)[0]!)
    const train = theTrain(state)
    run(state, 16) // moving, somewhere mid-line
    expect(train.status).toBe('moving')

    const edgeId = Object.keys(state.railEdges)[0]!
    bulldozeEdge(state, edgeId)
    run(state, 1)
    expect(train.status).toBe('noPath')
    expect(Number.isInteger(train.x)).toBe(true) // snapped to a surviving node

    // Rebuild the line: train re-paths within its cooldown window.
    buildRail(state, 0, 0, 10, 0)
    run(state, 60)
    expect(['moving', 'loading']).toContain(train.status)
  })

  it('waits when its route loses a stop, and no route means waiting too', () => {
    const { state, b } = lineWorld()
    buyTrain(state, Object.keys(state.routes)[0]!)
    const train = theTrain(state)
    const route = state.routes[train.routeId]!
    route.stationIds = route.stationIds.filter((id) => id !== b)
    run(state, 60)
    expect(train.status).toBe('waiting')
  })
})
