import { describe, expect, it } from 'vitest'
import { buildStation } from '../game/actions'
import { simulationTick } from '../game/simulation'
import { makeTestState } from '../game/testWorld'
import type { GameState } from '../game/types'
import { buildRail } from '../rail/buildTrack'
import { buyTrain, createRoute } from '../trains/routeLogic'
import { createSaveStore, type StorageLike } from './saveStore'
import { deserialize, serialize } from './serialize'

function midGameState(): GameState {
  const state = makeTestState(40, 20, [{ x: 2, y: 2, terrain: 'hill' }])
  state.industries['mine'] = { id: 'mine', kind: 'coal_mine', x: 2, y: 2, inventory: {}, progress: 0 }
  state.cities['city'] = { id: 'city', name: 'Testville', x: 22, y: 2, population: 1200, demands: ['coal'] }
  buildRail(state, 2, 2, 22, 2)
  const s1 = buildStation(state, 2, 2).stationId!
  const s2 = buildStation(state, 22, 2).stationId!
  buyTrain(state, createRoute(state, [s1, s2]).routeId!)
  for (let i = 0; i < 150; i++) simulationTick(state, 0.1) // train mid-journey
  return state
}

describe('serialize / deserialize', () => {
  it('round-trips a mid-game state exactly', () => {
    const state = midGameState()
    const loaded = deserialize(serialize(state))
    expect(loaded).toEqual(state)
  })

  it('a loaded game continues identically to the original (mid-journey train survives)', () => {
    const original = midGameState()
    const loaded = deserialize(serialize(original))!
    const train = Object.values(loaded.trains)[0]!
    expect(train.status).toBe('moving') // genuinely mid-journey
    for (let i = 0; i < 200; i++) {
      simulationTick(original, 0.1)
      simulationTick(loaded, 0.1)
    }
    expect(JSON.stringify(loaded)).toBe(JSON.stringify(original))
  })

  it('rejects garbage, tampering, and version mismatches', () => {
    expect(deserialize('not json {')).toBeNull()
    expect(deserialize('{"v":99,"state":{}}')).toBeNull()
    expect(deserialize('{"v":1,"state":{"money":"lots"}}')).toBeNull()
    expect(deserialize(JSON.stringify({ v: 1, state: null }))).toBeNull()
  })
})

describe('saveStore', () => {
  function fakeStorage(): StorageLike & { data: Map<string, string> } {
    const data = new Map<string, string>()
    return {
      data,
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    }
  }

  it('saves, loads and removes slots', () => {
    const backend = fakeStorage()
    const store = createSaveStore(backend)
    expect(store.save('manual', 'payload')).toBe(true)
    expect(store.load('manual')).toBe('payload')
    expect(store.load('auto')).toBeNull()
    store.remove('manual')
    expect(store.load('manual')).toBeNull()
  })

  it('reports quota failures instead of throwing', () => {
    const store = createSaveStore({
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {},
    })
    expect(store.save('manual', 'x')).toBe(false)
  })
})
