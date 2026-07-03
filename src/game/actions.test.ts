import { describe, expect, it } from 'vitest'
import { getNodeAt } from '../rail/graph'
import { buildRail } from '../rail/buildTrack'
import {
  buildStation,
  checkStationPlacement,
  findStationNear,
  removeStation,
  stationCatchment,
} from './actions'
import { STATION_COST } from './economy'
import { makeTestState } from './testWorld'

function withCityAndMine() {
  const state = makeTestState(30, 30, [{ x: 20, y: 20, terrain: 'hill' }])
  state.cities['city1'] = {
    id: 'city1',
    name: 'Testville',
    x: 5,
    y: 5,
    population: 1000,
    demands: ['coal'],
  }
  state.industries['ind1'] = {
    id: 'ind1',
    kind: 'coal_mine',
    x: 20,
    y: 20,
    inventory: {},
    progress: 0,
  }
  return state
}

describe('station placement', () => {
  it('rejects water, lack of funds, and crowding', () => {
    const state = makeTestState(20, 20, [{ x: 3, y: 3, terrain: 'water' }])
    expect(checkStationPlacement(state, 3, 3).ok).toBe(false)
    buildStation(state, 10, 10)
    expect(checkStationPlacement(state, 11, 10).ok).toBe(false) // too close
    state.money = 10
    expect(checkStationPlacement(state, 0, 0).ok).toBe(false)
  })

  it('links the nearest city and industry within the catchment radius', () => {
    const state = withCityAndMine()
    const nearCity = stationCatchment(state, 6, 6)
    expect(nearCity.city?.id).toBe('city1')
    expect(nearCity.industry).toBeUndefined()
    const nearMine = stationCatchment(state, 19, 19)
    expect(nearMine.industry?.id).toBe('ind1')
    expect(nearMine.city).toBeUndefined()
    const nowhere = stationCatchment(state, 12, 12)
    expect(nowhere.city).toBeUndefined()
    expect(nowhere.industry).toBeUndefined()
  })

  it('builds a station on a rail node, charging money and naming it', () => {
    const state = withCityAndMine()
    buildRail(state, 6, 6, 10, 6)
    const before = state.money
    const result = buildStation(state, 6, 6)
    expect(result.ok).toBe(true)
    expect(state.money).toBe(before - STATION_COST)
    const station = state.stations[result.stationId!]!
    expect(station.name).toBe('Testville Station')
    expect(station.cityId).toBe('city1')
    // Station reuses the existing rail node.
    expect(station.nodeId).toBe(getNodeAt(state, 6, 6)!.id)
  })

  it('gives duplicate names a numeric suffix', () => {
    const state = withCityAndMine()
    const first = buildStation(state, 5, 7)
    const second = buildStation(state, 8, 4)
    expect(state.stations[first.stationId!]!.name).toBe('Testville Station')
    expect(state.stations[second.stationId!]!.name).toBe('Testville Station 2')
  })

  it('removal refunds half, strips routes, and frees isolated nodes', () => {
    const state = withCityAndMine()
    const result = buildStation(state, 6, 6)
    const stationId = result.stationId!
    const nodeId = state.stations[stationId]!.nodeId
    state.routes['r1'] = { id: 'r1', name: 'Line 1', stationIds: [stationId], totalEarned: 0 }
    const before = state.money
    removeStation(state, stationId)
    expect(state.money).toBe(before + STATION_COST / 2)
    expect(state.stations[stationId]).toBeUndefined()
    expect(state.routes['r1']!.stationIds).toHaveLength(0)
    expect(state.railNodes[nodeId]).toBeUndefined() // no track → node freed
  })

  it('findStationNear respects the search radius', () => {
    const state = withCityAndMine()
    const result = buildStation(state, 6, 6)
    expect(findStationNear(state, 6.5, 6.5)?.id).toBe(result.stationId)
    expect(findStationNear(state, 9, 9)).toBeUndefined()
  })
})
