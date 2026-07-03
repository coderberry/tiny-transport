import { Container, Graphics } from 'pixi.js'
import type { GameState } from '../game/types'
import { checkRailPlacement } from '../rail/buildTrack'
import { ui } from '../ui/uiState'
import { TILE } from './camera'

const OK = 0x7dff9c
const BAD = 0xff6b5e

const gfx = new WeakMap<Container, Graphics>()

function graphicsFor(layer: Container): Graphics {
  let g = gfx.get(layer)
  if (!g) {
    g = new Graphics()
    layer.addChild(g)
    gfx.set(layer, g)
  }
  return g
}

/** Transient overlay (previews, highlights) — redrawn every frame. */
export function renderSelection(layer: Container, state: GameState): void {
  const g = graphicsFor(layer)
  g.clear()

  if (ui.tool === 'rail') {
    if (ui.hoverTile) {
      g.rect(ui.hoverTile.x * TILE, ui.hoverTile.y * TILE, TILE, TILE).stroke({
        color: 0xffffff,
        width: 1.5,
        alpha: 0.7,
      })
    }
    if (ui.railAnchor) {
      const ax = (ui.railAnchor.x + 0.5) * TILE
      const ay = (ui.railAnchor.y + 0.5) * TILE
      g.circle(ax, ay, TILE * 0.18).fill({ color: OK, alpha: 0.9 })
      if (ui.hoverTile) {
        const check = checkRailPlacement(
          state,
          ui.railAnchor.x,
          ui.railAnchor.y,
          ui.hoverTile.x,
          ui.hoverTile.y,
        )
        g.moveTo(ax, ay)
          .lineTo((ui.hoverTile.x + 0.5) * TILE, (ui.hoverTile.y + 0.5) * TILE)
          .stroke({ color: check.ok ? OK : BAD, width: TILE * 0.15, alpha: 0.8, cap: 'round' })
      }
    }
  }

  if (ui.tool === 'bulldoze' && ui.hoverEdgeId) {
    const edge = state.railEdges[ui.hoverEdgeId]
    const a = edge && state.railNodes[edge.a]
    const b = edge && state.railNodes[edge.b]
    if (a && b) {
      g.moveTo((a.x + 0.5) * TILE, (a.y + 0.5) * TILE)
        .lineTo((b.x + 0.5) * TILE, (b.y + 0.5) * TILE)
        .stroke({ color: BAD, width: TILE * 0.4, alpha: 0.55, cap: 'round' })
    }
  }
}
