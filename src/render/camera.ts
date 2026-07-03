import { Container, type Application } from 'pixi.js'

/** Pixels per tile at zoom 1. The sim never sees this constant. */
export const TILE = 32

const MIN_ZOOM = 0.15
const MAX_ZOOM = 3.5

export interface Camera {
  world: Container
  /** Screen px → world position in tile units (fractional). */
  screenToWorld(sx: number, sy: number): { x: number; y: number }
  worldToScreen(wx: number, wy: number): { x: number; y: number }
  zoomAt(sx: number, sy: number, factor: number): void
  panBy(dxPx: number, dyPx: number): void
  centerOn(wx: number, wy: number, zoom?: number): void
  getZoom(): number
}

export function createCamera(app: Application): Camera {
  const world = new Container()
  app.stage.addChild(world)

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

  return {
    world,
    screenToWorld(sx, sy) {
      return {
        x: (sx - world.position.x) / world.scale.x / TILE,
        y: (sy - world.position.y) / world.scale.y / TILE,
      }
    },
    worldToScreen(wx, wy) {
      return {
        x: wx * TILE * world.scale.x + world.position.x,
        y: wy * TILE * world.scale.y + world.position.y,
      }
    },
    zoomAt(sx, sy, factor) {
      const oldScale = world.scale.x
      const newScale = clampZoom(oldScale * factor)
      if (newScale === oldScale) return
      // Keep the world point under the cursor fixed while zooming.
      world.position.x = sx - ((sx - world.position.x) / oldScale) * newScale
      world.position.y = sy - ((sy - world.position.y) / oldScale) * newScale
      world.scale.set(newScale)
    },
    panBy(dxPx, dyPx) {
      world.position.x += dxPx
      world.position.y += dyPx
    },
    centerOn(wx, wy, zoom) {
      if (zoom !== undefined) world.scale.set(clampZoom(zoom))
      world.position.x = app.screen.width / 2 - wx * TILE * world.scale.x
      world.position.y = app.screen.height / 2 - wy * TILE * world.scale.y
    },
    getZoom: () => world.scale.x,
  }
}
