import { CARGO } from '../content/cargo'
import { INDUSTRY_DEFS, INDUSTRY_INVENTORY_CAP } from '../content/industries'
import { STATION_STORAGE_CAP } from './economy'
import type {
  CargoAmounts,
  CargoType,
  GameState,
  Route,
  SimEvent,
  Station,
  Train,
} from './types'

export function cargoTotal(amounts: CargoAmounts): number {
  let sum = 0
  for (const v of Object.values(amounts)) sum += v ?? 0
  return sum
}

function sortedCargoKeys(amounts: CargoAmounts): CargoType[] {
  return (Object.keys(amounts) as CargoType[]).filter((k) => (amounts[k] ?? 0) > 0).sort()
}

/** The station (if any) whose catchment serves this industry. */
function stationForIndustry(state: GameState, industryId: string): Station | undefined {
  return Object.values(state.stations).find((s) => s.industryId === industryId)
}

/**
 * Industries accumulate fractional progress and emit whole units into their
 * linked station's storage — or their own inventory while unconnected.
 * Production stalls when the destination is full.
 */
export function produceResources(state: GameState, dt: number): void {
  for (const industry of Object.values(state.industries)) {
    const def = INDUSTRY_DEFS[industry.kind]
    if (!def.produces) continue
    const station = stationForIndustry(state, industry.id)
    const target: CargoAmounts = station ? station.storage : industry.inventory
    const cap = station ? STATION_STORAGE_CAP : INDUSTRY_INVENTORY_CAP
    if ((target[def.produces] ?? 0) >= cap) continue // stalled

    industry.progress += def.rate * dt
    const whole = Math.floor(industry.progress)
    if (whole <= 0) continue
    industry.progress -= whole
    target[def.produces] = Math.min(cap, (target[def.produces] ?? 0) + whole)

    // A newly linked station drains any inventory built up while unconnected.
    if (station && (industry.inventory[def.produces] ?? 0) > 0) {
      const room = STATION_STORAGE_CAP - (station.storage[def.produces] ?? 0)
      const moved = Math.min(room, industry.inventory[def.produces] ?? 0)
      if (moved > 0) {
        station.storage[def.produces] = (station.storage[def.produces] ?? 0) + moved
        industry.inventory[def.produces] = (industry.inventory[def.produces] ?? 0) - moved
      }
    }
  }
}

/** Does any *other* stop on the route want this cargo (sell or consume)? */
export function routeWantsCargo(
  state: GameState,
  route: Route,
  excludeStationId: string,
  cargo: CargoType,
): boolean {
  for (const stationId of route.stationIds) {
    if (stationId === excludeStationId) continue
    const station = state.stations[stationId]
    if (!station) continue
    const city = station.cityId ? state.cities[station.cityId] : undefined
    if (city?.demands.includes(cargo)) return true
    const industry = station.industryId ? state.industries[station.industryId] : undefined
    if (industry && INDUSTRY_DEFS[industry.kind].consumes === cargo) return true
  }
  return false
}

/**
 * Runs once when a train arrives at a stop: sell/hand over what the stop
 * wants, then load whatever the rest of the route can use.
 */
export function exchangeCargo(
  state: GameState,
  train: Train,
  station: Station,
  events: SimEvent[],
): void {
  const route = state.routes[train.routeId]
  const node = state.railNodes[station.nodeId]
  const city = station.cityId ? state.cities[station.cityId] : undefined
  const industry = station.industryId ? state.industries[station.industryId] : undefined
  const consumes = industry ? INDUSTRY_DEFS[industry.kind].consumes : undefined

  // --- Unload ---
  for (const cargo of sortedCargoKeys(train.cargo)) {
    const amount = train.cargo[cargo] ?? 0
    if (amount <= 0) continue

    if (city?.demands.includes(cargo)) {
      const origin = train.cargoOrigin[cargo]
      const haul = origin && node ? Math.hypot(origin.x - node.x, origin.y - node.y) : 10
      const revenue = Math.round(amount * CARGO[cargo].rate * haul)
      state.money += revenue
      train.totalEarned += revenue
      if (route) route.totalEarned += revenue
      delete train.cargo[cargo]
      delete train.cargoOrigin[cargo]
      if (node) events.push({ x: node.x, y: node.y, text: `+$${revenue.toLocaleString('en-US')}` })
      continue
    }

    if (consumes === cargo && industry) {
      // Feedstock for a processing industry (no payment — the goods pay later).
      const room = INDUSTRY_INVENTORY_CAP - (industry.inventory[cargo] ?? 0)
      const moved = Math.min(room, amount)
      if (moved > 0) {
        industry.inventory[cargo] = (industry.inventory[cargo] ?? 0) + moved
        train.cargo[cargo] = amount - moved
        if ((train.cargo[cargo] ?? 0) <= 0) {
          delete train.cargo[cargo]
          delete train.cargoOrigin[cargo]
        }
      }
    }
  }

  // --- Load ---
  if (!route || !node) return
  for (const cargo of sortedCargoKeys(station.storage)) {
    if (!routeWantsCargo(state, route, station.id, cargo)) continue
    const free = train.capacity - cargoTotal(train.cargo)
    if (free <= 0) break
    const take = Math.min(free, station.storage[cargo] ?? 0)
    if (take <= 0) continue
    station.storage[cargo] = (station.storage[cargo] ?? 0) - take
    if ((station.storage[cargo] ?? 0) <= 0) delete station.storage[cargo]
    train.cargo[cargo] = (train.cargo[cargo] ?? 0) + take
    train.cargoOrigin[cargo] = { x: node.x, y: node.y }
  }
}
