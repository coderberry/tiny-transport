import { describe, expect, it } from 'vitest'
import { buildRail } from '../rail/buildTrack'
import { buyTrain, createRoute } from '../trains/routeLogic'
import { buildStation } from './actions'
import { simulationTick } from './simulation'
import { makeTestState } from './testWorld'
import type { GameState } from './types'

/**
 * THE integration test from the plan: a scripted mine→city world runs 1,000
 * ticks headless; coal must be delivered and money must go up.
 */
function buildCoalWorld(): GameState {
  const state = makeTestState(40, 20, [{ x: 2, y: 2, terrain: 'hill' }])
  state.industries['mine'] = {
    id: 'mine',
    kind: 'coal_mine',
    x: 2,
    y: 2,
    inventory: {},
    progress: 0,
  }
  state.cities['city'] = {
    id: 'city',
    name: 'Testville',
    x: 22,
    y: 2,
    population: 1200,
    demands: ['coal'],
  }
  buildRail(state, 2, 2, 22, 2)
  const mineStation = buildStation(state, 2, 2).stationId!
  const cityStation = buildStation(state, 22, 2).stationId!
  const routeId = createRoute(state, [mineStation, cityStation]).routeId!
  buyTrain(state, routeId)
  return state
}

describe('1,000-tick coal delivery integration', () => {
  it('delivers coal and earns money', () => {
    const state = buildCoalWorld()
    const moneyAfterConstruction = state.money
    let deliveries = 0
    for (let i = 0; i < 1000; i++) {
      const events = simulationTick(state, 0.1)
      deliveries += events.filter((e) => e.text.startsWith('+$')).length
    }
    expect(deliveries).toBeGreaterThanOrEqual(2)
    expect(state.money).toBeGreaterThan(moneyAfterConstruction)
    const route = Object.values(state.routes)[0]!
    expect(route.totalEarned).toBeGreaterThan(0)
    const train = Object.values(state.trains)[0]!
    expect(train.totalEarned).toBe(route.totalEarned)
    expect(state.tick).toBe(1000)
  })

  it('idle trains drain money through running costs', () => {
    const state = makeTestState(30, 30)
    buildRail(state, 0, 0, 10, 0)
    const a = buildStation(state, 0, 0).stationId!
    const b = buildStation(state, 10, 0).stationId!
    const routeId = createRoute(state, [a, b]).routeId!
    buyTrain(state, routeId)
    // Nothing to haul on this route: pure upkeep.
    const before = state.money
    for (let i = 0; i < 300; i++) simulationTick(state, 0.1) // 30 s
    expect(state.money).toBeLessThan(before)
    expect(before - state.money).toBeCloseTo(60, 0) // $2/s × 30 s
  })

  it('is deterministic: identical worlds tick to identical states', () => {
    const a = buildCoalWorld()
    const b = buildCoalWorld()
    for (let i = 0; i < 500; i++) {
      simulationTick(a, 0.1)
      simulationTick(b, 0.1)
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('keeps the full mid-game state JSON round-trippable', () => {
    const state = buildCoalWorld()
    for (let i = 0; i < 137; i++) simulationTick(state, 0.1)
    const roundTripped = JSON.parse(JSON.stringify(state))
    expect(roundTripped).toEqual(state)
  })
})
