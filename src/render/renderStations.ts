import { Container, Graphics } from 'pixi.js'
import type { GameState } from '../game/types'
import { TILE } from './camera'
import { clearLabelPool, makeLabel } from './labels'

const PLATFORM = 0x2e3d4a
const BORDER = 0xdce3e8

const renderedVersion = new WeakMap<Container, number>()

/** Stations change only when infrastructure changes (railVersion). */
export function renderStations(layer: Container, state: GameState): void {
  if (renderedVersion.get(layer) === state.railVersion) return
  renderedVersion.set(layer, state.railVersion)

  layer.removeChildren()
  clearLabelPool('stations')
  const g = new Graphics()
  layer.addChild(g)

  for (const station of Object.values(state.stations)) {
    const node = state.railNodes[station.nodeId]
    if (!node) continue
    const cx = (node.x + 0.5) * TILE
    const cy = (node.y + 0.5) * TILE
    const w = TILE * 1.1
    const h = TILE * 0.72
    g.roundRect(cx - w / 2, cy - h / 2, w, h, 4).fill(PLATFORM)
    g.roundRect(cx - w / 2, cy - h / 2, w, h, 4).stroke({ color: BORDER, width: 2 })
    // Platform stripes.
    g.rect(cx - w * 0.38, cy - h * 0.16, w * 0.76, h * 0.32).fill({
      color: 0xc9b458,
      alpha: 0.9,
    })
    layer.addChild(makeLabel('stations', station.name, cx, cy + h / 2 + 2, 12))
  }
}
