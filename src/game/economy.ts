import type { Terrain } from './types'

export const RAIL_COST_PER_TILE = 20
export const STATION_COST = 400
export const TRAIN_COST = 1500
export const BULLDOZE_REFUND = 0.5

export const TRAIN_SPEED = 6 // tiles per second
export const TRAIN_CAPACITY = 30
export const TRAIN_DWELL_SECONDS = 3
/** Upkeep per train per second — added in M8 so idle trains cost money. */
export const TRAIN_RUNNING_COST_PER_SEC = 0

export const STATION_STORAGE_CAP = 60
export const STATION_CATCHMENT_RADIUS = 3.5 // tiles

/** Building through rough terrain costs more. Water is unbuildable. */
export const TERRAIN_COST_MULT: Record<Terrain, number> = {
  grass: 1,
  forest: 1.4,
  hill: 2,
  mountain: 3.5,
  water: Infinity,
}
