import { hash2 } from '../core/rng'
import { TERRAINS, type GameMap, type Terrain } from '../game/types'

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Smooth value noise: bilinear hash lattice with smoothstep fade. */
export function valueNoise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const v00 = hash2(seed, x0, y0)
  const v10 = hash2(seed, x0 + 1, y0)
  const v01 = hash2(seed, x0, y0 + 1)
  const v11 = hash2(seed, x0 + 1, y0 + 1)
  return lerp(lerp(v00, v10, sx), lerp(v01, v11, sx), sy)
}

/** Fractal brownian motion over value noise. */
export function fbm(seed: number, x: number, y: number, octaves = 4): number {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(seed + i * 1013, x * freq, y * freq)
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}

/** Stretch values to fill [0, 1] so terrain thresholds hold on every seed. */
function normalize(values: number[]): number[] {
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const span = max - min || 1
  return values.map((v) => (v - min) / span)
}

export function generateTerrain(seed: number, width: number, height: number): GameMap {
  const elevation: number[] = []
  const moisture: number[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      elevation.push(fbm(seed, x * 0.045, y * 0.045))
      moisture.push(fbm(seed + 7777, x * 0.09, y * 0.09, 3))
    }
  }
  const e = normalize(elevation)
  const m = normalize(moisture)

  const terrain = e.map((elev, i) => {
    let t: Terrain
    if (elev < 0.3) t = 'water'
    else if (elev > 0.82) t = 'mountain'
    else if (elev > 0.66) t = 'hill'
    else if ((m[i] ?? 0) > 0.62) t = 'forest'
    else t = 'grass'
    return TERRAINS.indexOf(t)
  })

  return { width, height, terrain }
}

export function inBounds(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height
}

export function terrainAt(map: GameMap, x: number, y: number): Terrain {
  if (!inBounds(map, x, y)) return 'water'
  const idx = map.terrain[y * map.width + x]
  return TERRAINS[idx ?? 2] ?? 'water'
}

export function isBuildable(map: GameMap, x: number, y: number): boolean {
  return inBounds(map, x, y) && terrainAt(map, x, y) !== 'water'
}
