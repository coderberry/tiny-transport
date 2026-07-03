import type { CargoType } from '../game/types'

export interface CargoDef {
  name: string
  color: number
  /** Delivery payment in $ per unit per tile of haul distance. */
  rate: number
}

export const CARGO: Record<CargoType, CargoDef> = {
  coal: { name: 'Coal', color: 0x3a3a42, rate: 3 },
  grain: { name: 'Grain', color: 0xd9b13b, rate: 2.5 },
  wood: { name: 'Wood', color: 0x8a5a2b, rate: 2.5 },
  goods: { name: 'Goods', color: 0x7ec8e3, rate: 5 },
}
