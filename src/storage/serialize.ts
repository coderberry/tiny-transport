import type { GameState } from '../game/types'

/** Bump when GameState changes shape; deserialize refuses mismatches. */
export const SAVE_VERSION = 1

interface SaveEnvelope {
  v: number
  savedAt: number
  state: GameState
}

export function serialize(state: GameState, now = Date.now()): string {
  const envelope: SaveEnvelope = { v: SAVE_VERSION, savedAt: now, state }
  return JSON.stringify(envelope)
}

/** Returns null (never throws) on garbage, tampering, or version mismatch. */
export function deserialize(json: string): GameState | null {
  try {
    const envelope = JSON.parse(json) as Partial<SaveEnvelope>
    if (envelope.v !== SAVE_VERSION) return null
    const state = envelope.state
    if (!state || typeof state !== 'object') return null
    if (typeof state.money !== 'number' || typeof state.tick !== 'number') return null
    if (!state.map || state.map.width <= 0 || !Array.isArray(state.map.terrain)) return null
    return state
  } catch {
    return null
  }
}
