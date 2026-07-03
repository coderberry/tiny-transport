import { INDUSTRY_DEFS } from '../content/industries'
import { nextId } from '../core/ids'
import { getOrCreateNodeAt, removeNodeIfIsolated } from '../rail/graph'
import {
  BULLDOZE_REFUND,
  STATION_CATCHMENT_RADIUS,
  STATION_COST,
} from './economy'
import { inBounds, terrainAt } from '../map/terrain'
import type { City, GameState, Industry, Station } from './types'

const STATION_MIN_DIST = 3

export interface ActionCheck {
  ok: boolean
  reason?: string
  cost: number
}

export function checkStationPlacement(state: GameState, x: number, y: number): ActionCheck {
  if (!inBounds(state.map, x, y)) return { ok: false, reason: 'Out of bounds', cost: 0 }
  if (terrainAt(state.map, x, y) === 'water')
    return { ok: false, reason: "Can't build on water", cost: 0 }
  for (const station of Object.values(state.stations)) {
    const node = state.railNodes[station.nodeId]
    if (node && Math.hypot(node.x - x, node.y - y) < STATION_MIN_DIST)
      return { ok: false, reason: 'Too close to another station', cost: STATION_COST }
  }
  if (state.money < STATION_COST)
    return { ok: false, reason: 'Not enough money', cost: STATION_COST }
  return { ok: true, cost: STATION_COST }
}

/** Nearest city and industry inside the catchment radius, if any. */
export function stationCatchment(
  state: GameState,
  x: number,
  y: number,
): { city?: City; industry?: Industry } {
  let city: City | undefined
  let cityDist = STATION_CATCHMENT_RADIUS
  for (const c of Object.values(state.cities)) {
    const d = Math.hypot(c.x - x, c.y - y)
    if (d <= cityDist) {
      cityDist = d
      city = c
    }
  }
  let industry: Industry | undefined
  let indDist = STATION_CATCHMENT_RADIUS
  for (const i of Object.values(state.industries)) {
    const d = Math.hypot(i.x - x, i.y - y)
    if (d <= indDist) {
      indDist = d
      industry = i
    }
  }
  return { city, industry }
}

function uniqueStationName(state: GameState, base: string): string {
  const names = new Set(Object.values(state.stations).map((s) => s.name))
  if (!names.has(base)) return base
  let n = 2
  while (names.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}

export function buildStation(
  state: GameState,
  x: number,
  y: number,
): ActionCheck & { stationId?: string } {
  const check = checkStationPlacement(state, x, y)
  if (!check.ok) return check
  const node = getOrCreateNodeAt(state, x, y)
  const { city, industry } = stationCatchment(state, x, y)
  const base = city
    ? `${city.name} Station`
    : industry
      ? `${INDUSTRY_DEFS[industry.kind].name} Depot`
      : 'Waypoint Halt'
  const id = nextId(state, 'st')
  state.stations[id] = {
    id,
    name: uniqueStationName(state, base),
    nodeId: node.id,
    ...(city ? { cityId: city.id } : {}),
    ...(industry ? { industryId: industry.id } : {}),
    storage: {},
  }
  state.money -= STATION_COST
  state.railVersion++
  return { ...check, stationId: id }
}

/** Remove a station, refund half, strip it from routes, free its node. */
export function removeStation(state: GameState, stationId: string): void {
  const station = state.stations[stationId]
  if (!station) return
  delete state.stations[stationId]
  state.money += Math.round(STATION_COST * BULLDOZE_REFUND)
  for (const route of Object.values(state.routes)) {
    route.stationIds = route.stationIds.filter((id) => id !== stationId)
  }
  state.railVersion++
  removeNodeIfIsolated(state, station.nodeId)
}

export function findCityNear(state: GameState, wx: number, wy: number): City | undefined {
  for (const city of Object.values(state.cities)) {
    const r = 0.7 + Math.min(city.population / 2600, 1) * 0.5 // matches render radius
    if (Math.hypot(city.x + 0.5 - wx, city.y + 0.5 - wy) <= r) return city
  }
  return undefined
}

export function findIndustryNear(state: GameState, wx: number, wy: number): Industry | undefined {
  for (const industry of Object.values(state.industries)) {
    if (Math.hypot(industry.x + 0.5 - wx, industry.y + 0.5 - wy) <= 0.7) return industry
  }
  return undefined
}

export function findStationNear(
  state: GameState,
  wx: number,
  wy: number,
  maxDist = 0.9,
): Station | undefined {
  let best: Station | undefined
  let bestDist = maxDist
  for (const station of Object.values(state.stations)) {
    const node = state.railNodes[station.nodeId]
    if (!node) continue
    const d = Math.hypot(node.x + 0.5 - wx, node.y + 0.5 - wy)
    if (d < bestDist) {
      bestDist = d
      best = station
    }
  }
  return best
}
