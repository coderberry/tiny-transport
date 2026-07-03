import { describe, expect, it } from 'vitest'
import { TERRAINS } from '../game/types'
import { INDUSTRY_DEFS } from '../content/industries'
import { newGame } from './generateMap'
import { terrainAt } from './terrain'

const SEEDS = [1, 42, 777, 123456]

describe('newGame', () => {
  it('is fully deterministic for a given seed', () => {
    const a = newGame(123)
    const b = newGame(123)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('differs across seeds', () => {
    expect(JSON.stringify(newGame(1))).not.toBe(JSON.stringify(newGame(2)))
  })

  it('survives a JSON round-trip unchanged (serializable state discipline)', () => {
    const state = newGame(42)
    const roundTripped = JSON.parse(JSON.stringify(state))
    expect(roundTripped).toEqual(state)
  })

  it.each(SEEDS)('seed %i: terrain has water, grass and mountains', (seed) => {
    const { map } = newGame(seed)
    const present = new Set(map.terrain.map((t) => TERRAINS[t]))
    expect(present.has('water')).toBe(true)
    expect(present.has('grass')).toBe(true)
    expect(present.has('mountain')).toBe(true)
    expect(map.terrain).toHaveLength(map.width * map.height)
  })

  it.each(SEEDS)('seed %i: places 5–8 cities on grass with spacing', (seed) => {
    const state = newGame(seed)
    const cities = Object.values(state.cities)
    expect(cities.length).toBeGreaterThanOrEqual(5)
    expect(cities.length).toBeLessThanOrEqual(8)
    for (const city of cities) {
      expect(terrainAt(state.map, city.x, city.y)).toBe('grass')
      expect(city.demands.length).toBeGreaterThan(0)
    }
    for (const a of cities) {
      for (const b of cities) {
        if (a.id === b.id) continue
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(8)
      }
    }
  })

  it.each(SEEDS)('seed %i: industries sit on terrain their kind allows', (seed) => {
    const state = newGame(seed)
    const industries = Object.values(state.industries)
    expect(industries.length).toBeGreaterThanOrEqual(4)
    for (const ind of industries) {
      const def = INDUSTRY_DEFS[ind.kind]
      expect(def.terrain).toContain(terrainAt(state.map, ind.x, ind.y))
    }
    // The starter chain must exist: at least one coal mine to haul from.
    expect(industries.some((i) => i.kind === 'coal_mine')).toBe(true)
  })
})
