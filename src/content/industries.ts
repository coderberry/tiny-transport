import type { CargoType, IndustryKind, Terrain } from '../game/types'

export interface IndustryDef {
  name: string
  color: number
  produces?: CargoType
  consumes?: CargoType
  /** Units per second (of the produced cargo). */
  rate: number
  /** Terrain the industry can be placed on by the map generator. */
  terrain: Terrain[]
  /** How many the generator places per map: [min, max]. */
  count: [number, number]
}

export const INDUSTRY_DEFS: Record<IndustryKind, IndustryDef> = {
  coal_mine: {
    name: 'Coal Mine',
    color: 0x5a5a64,
    produces: 'coal',
    rate: 0.5,
    terrain: ['hill', 'mountain'],
    count: [3, 4],
  },
  farm: {
    name: 'Farm',
    color: 0xdcc25a,
    produces: 'grain',
    rate: 0.4,
    terrain: ['grass'],
    count: [2, 3],
  },
  forest_camp: {
    name: 'Forest Camp',
    color: 0x9a6a35,
    produces: 'wood',
    rate: 0.4,
    terrain: ['forest'],
    count: [2, 3],
  },
  sawmill: {
    name: 'Sawmill',
    color: 0xc9a227,
    consumes: 'wood',
    produces: 'goods',
    rate: 0.5,
    terrain: ['grass'],
    count: [1, 2],
  },
}

/** Storage cap for industry-internal inventory (production stalls beyond it). */
export const INDUSTRY_INVENTORY_CAP = 30
