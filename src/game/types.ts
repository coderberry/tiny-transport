/**
 * All simulation state is plain JSON-serializable data: no class instances,
 * no renderer references. Positions are in tile units (1 tile = 1 world unit);
 * the renderer alone converts to pixels.
 */

export const TERRAINS = ['grass', 'forest', 'water', 'hill', 'mountain'] as const
export type Terrain = (typeof TERRAINS)[number]

export const CARGO_TYPES = ['coal', 'grain', 'wood', 'goods'] as const
export type CargoType = (typeof CARGO_TYPES)[number]

export type IndustryKind = 'coal_mine' | 'farm' | 'forest_camp' | 'sawmill'

export type CargoAmounts = Partial<Record<CargoType, number>>

export interface GameMap {
  width: number
  height: number
  /** Row-major indices into TERRAINS, length = width * height. */
  terrain: number[]
}

export interface City {
  id: string
  name: string
  x: number
  y: number
  population: number
  demands: CargoType[]
}

export interface Industry {
  id: string
  kind: IndustryKind
  x: number
  y: number
  inventory: CargoAmounts
  /** Fractional production accumulator (units). */
  progress: number
}

/** Rail nodes sit on tile centers; edges are straight lines between nodes. */
export interface RailNode {
  id: string
  x: number
  y: number
}

export interface RailEdge {
  id: string
  a: string
  b: string
  /** Euclidean length in tiles, derived at build time. */
  length: number
}

export interface Station {
  id: string
  name: string
  /** The rail node this station occupies. */
  nodeId: string
  cityId?: string
  industryId?: string
  storage: CargoAmounts
}

export interface Route {
  id: string
  name: string
  stationIds: string[]
  totalEarned: number
}

/** One directed step along the rail graph: an edge plus travel direction. */
export interface PathStep {
  edgeId: string
  reversed: boolean
}

export type TrainStatus = 'moving' | 'loading' | 'noPath' | 'waiting'

export interface Train {
  id: string
  routeId: string
  /** Index into route.stationIds of the stop we're heading to (or dwelling at). */
  stopIndex: number
  /** Current leg through the rail graph; null when parked. */
  path: PathStep[] | null
  pathLength: number
  /** Distance traveled along the current path, in tiles. */
  distance: number
  x: number
  y: number
  prevX: number
  prevY: number
  /** Radians; renderer rotates the sprite to match. */
  heading: number
  /** Tiles per second. */
  speed: number
  capacity: number
  cargo: CargoAmounts
  /** Where each cargo type was loaded — payment scales with haul distance. */
  cargoOrigin: Partial<Record<CargoType, { x: number; y: number }>>
  status: TrainStatus
  dwellRemaining: number
  /** Seconds until a parked train retries pathfinding. */
  repathCooldown: number
  totalEarned: number
}

export interface GameState {
  seed: number
  tick: number
  money: number
  map: GameMap
  cities: Record<string, City>
  industries: Record<string, Industry>
  railNodes: Record<string, RailNode>
  railEdges: Record<string, RailEdge>
  stations: Record<string, Station>
  routes: Record<string, Route>
  trains: Record<string, Train>
  nextId: number
  /** Bumped on every rail graph mutation; renderer and trains watch it. */
  railVersion: number
}
