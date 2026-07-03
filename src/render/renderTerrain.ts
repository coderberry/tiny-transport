import { Container, Graphics } from 'pixi.js'
import { hash2 } from '../core/rng'
import type { GameState, Terrain } from '../game/types'
import { terrainAt } from '../map/terrain'
import { TILE } from './camera'

const TERRAIN_COLORS: Record<Terrain, number> = {
  grass: 0x63a35c,
  forest: 0x3f7a49,
  water: 0x3a6ea5,
  hill: 0x8d9668,
  mountain: 0x9aa0a8,
}

/** Multiply a 24-bit color's channels by f (clamped). */
function shade(color: number, f: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * f))
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * f))
  const b = Math.min(255, Math.round((color & 0xff) * f))
  return (r << 16) | (g << 8) | b
}

/**
 * Terrain is static per game: draw every tile once into a single Graphics,
 * then cache the whole container as a texture so panning/zooming is free.
 */
export function renderTerrain(layer: Container, state: GameState): void {
  layer.removeChildren()
  const g = new Graphics()
  const { map } = state
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const terrain = terrainAt(map, x, y)
      // Subtle per-tile brightness variation so large areas read as textured.
      const f = 0.93 + hash2(state.seed ^ 0x51ed, x, y) * 0.14
      g.rect(x * TILE, y * TILE, TILE, TILE).fill(shade(TERRAIN_COLORS[terrain], f))
    }
  }
  layer.addChild(g)
  layer.cacheAsTexture(true)
}
