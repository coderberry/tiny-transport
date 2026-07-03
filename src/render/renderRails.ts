import { Container, Graphics } from 'pixi.js'
import type { GameState } from '../game/types'
import { TILE } from './camera'

const BALLAST = 0x6b5a48
const RAIL = 0xcfd4d9
const NODE = 0x8a8f96

const renderedVersion = new WeakMap<Container, number>()

/** Redraws the rail layer only when the graph version changes. */
export function renderRails(layer: Container, state: GameState): void {
  if (renderedVersion.get(layer) === state.railVersion) return
  renderedVersion.set(layer, state.railVersion)

  layer.removeChildren()
  const g = new Graphics()
  layer.addChild(g)

  // Ballast underlay first so crossings merge visually.
  for (const edge of Object.values(state.railEdges)) {
    const a = state.railNodes[edge.a]
    const b = state.railNodes[edge.b]
    if (!a || !b) continue
    g.moveTo((a.x + 0.5) * TILE, (a.y + 0.5) * TILE)
    g.lineTo((b.x + 0.5) * TILE, (b.y + 0.5) * TILE)
  }
  g.stroke({ color: BALLAST, width: TILE * 0.32, cap: 'round' })

  // Twin steel rails offset perpendicular to each edge.
  for (const edge of Object.values(state.railEdges)) {
    const a = state.railNodes[edge.a]
    const b = state.railNodes[edge.b]
    if (!a || !b) continue
    const ax = (a.x + 0.5) * TILE
    const ay = (a.y + 0.5) * TILE
    const bx = (b.x + 0.5) * TILE
    const by = (b.y + 0.5) * TILE
    const len = Math.hypot(bx - ax, by - ay) || 1
    const px = (-(by - ay) / len) * TILE * 0.09
    const py = ((bx - ax) / len) * TILE * 0.09
    g.moveTo(ax + px, ay + py).lineTo(bx + px, by + py)
    g.moveTo(ax - px, ay - py).lineTo(bx - px, by - py)
  }
  g.stroke({ color: RAIL, width: TILE * 0.06, cap: 'round' })

  // Small caps on junction nodes.
  for (const node of Object.values(state.railNodes)) {
    g.circle((node.x + 0.5) * TILE, (node.y + 0.5) * TILE, TILE * 0.12).fill(NODE)
  }
}
