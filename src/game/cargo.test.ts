import { describe, expect, it } from 'vitest'
import { CARGO } from '../content/cargo'
import { buildStation } from './actions'
import { cargoTotal, exchangeCargo, produceResources, routeWantsCargo } from './cargo'
import { STATION_STORAGE_CAP } from './economy'
import { makeTestState } from './testWorld'
import type { GameState, SimEvent, Train } from './types'
import { buildRail } from '../rail/buildTrack'
import { buyTrain, createRoute } from '../trains/routeLogic'

/** Mine at (2,2), coal-hungry city at (22,2), rail + stations + route. */
function coalWorld() {
  const state = makeTestState(40, 20, [{ x: 2, y: 2, terrain: 'hill' }])
  state.industries['mine'] = { id: 'mine', kind: 'coal_mine', x: 2, y: 2, inventory: {}, progress: 0 }
  state.cities['city'] = { id: 'city', name: 'Testville', x: 22, y: 2, population: 1000, demands: ['coal'] }
  buildRail(state, 2, 2, 22, 2)
  const mineStation = buildStation(state, 2, 2).stationId!
  const cityStation = buildStation(state, 22, 2).stationId!
  const routeId = createRoute(state, [mineStation, cityStation]).routeId!
  return { state, mineStation, cityStation, routeId }
}

function trainAt(state: GameState, stationId: string): Train {
  const trainId = buyTrain(state, Object.keys(state.routes)[0]!).trainId!
  const train = state.trains[trainId]!
  const station = state.stations[stationId]!
  const node = state.railNodes[station.nodeId]!
  train.x = node.x
  train.y = node.y
  train.atNodeId = node.id
  return train
}

describe('produceResources', () => {
  it('accumulates fractional progress into the linked station storage', () => {
    const { state, mineStation } = coalWorld()
    produceResources(state, 1) // coal_mine rate 0.5 → 0.5 progress, no unit yet
    expect(state.stations[mineStation]!.storage['coal'] ?? 0).toBe(0)
    produceResources(state, 1)
    expect(state.stations[mineStation]!.storage['coal']).toBe(1)
  })

  it('stalls production at the storage cap', () => {
    const { state, mineStation } = coalWorld()
    state.stations[mineStation]!.storage['coal'] = STATION_STORAGE_CAP
    produceResources(state, 100)
    expect(state.stations[mineStation]!.storage['coal']).toBe(STATION_STORAGE_CAP)
  })

  it('feeds its own inventory when no station is linked', () => {
    const state = makeTestState(20, 20, [{ x: 2, y: 2, terrain: 'hill' }])
    state.industries['mine'] = { id: 'mine', kind: 'coal_mine', x: 2, y: 2, inventory: {}, progress: 0 }
    produceResources(state, 10)
    expect(state.industries['mine']!.inventory['coal']).toBe(5)
  })
})

describe('exchangeCargo', () => {
  it('loads only cargo another stop on the route wants, up to capacity', () => {
    const { state, mineStation, routeId } = coalWorld()
    const station = state.stations[mineStation]!
    station.storage['coal'] = 50
    station.storage['wood'] = 10 // nobody on this route wants wood
    const train = trainAt(state, mineStation)
    const events: SimEvent[] = []
    exchangeCargo(state, train, station, events)
    expect(train.cargo['coal']).toBe(train.capacity)
    expect(train.cargo['wood']).toBeUndefined()
    expect(station.storage['coal']).toBe(50 - train.capacity)
    expect(cargoTotal(train.cargo)).toBe(train.capacity)
    expect(train.cargoOrigin['coal']).toEqual({ x: 2, y: 2 })
    expect(routeWantsCargo(state, state.routes[routeId]!, mineStation, 'coal')).toBe(true)
  })

  it('sells demanded cargo at the city for rate × haul distance', () => {
    const { state, cityStation, routeId } = coalWorld()
    const train = trainAt(state, cityStation)
    train.cargo['coal'] = 20
    train.cargoOrigin['coal'] = { x: 2, y: 2 }
    const moneyBefore = state.money
    const events: SimEvent[] = []
    exchangeCargo(state, train, state.stations[cityStation]!, events)
    const expected = Math.round(20 * CARGO.coal.rate * 20) // 20 tiles hauled
    expect(state.money).toBe(moneyBefore + expected)
    expect(train.cargo['coal']).toBeUndefined()
    expect(state.routes[routeId]!.totalEarned).toBe(expected)
    expect(events).toHaveLength(1)
    expect(events[0]!.text).toContain('+$')
  })

  it('does not pay for cargo the city has no demand for', () => {
    const { state, cityStation } = coalWorld()
    const train = trainAt(state, cityStation)
    train.cargo['wood'] = 10
    train.cargoOrigin['wood'] = { x: 2, y: 2 }
    const moneyBefore = state.money
    exchangeCargo(state, train, state.stations[cityStation]!, [])
    expect(state.money).toBe(moneyBefore)
    expect(train.cargo['wood']).toBe(10) // stays aboard
  })
})
