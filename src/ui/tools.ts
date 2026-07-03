import type { GameState } from '../game/types'
import { inBounds } from '../map/terrain'
import { buildRail, checkRailPlacement, findEdgeNear, bulldozeEdge } from '../rail/buildTrack'
import { getNodeAt } from '../rail/graph'
import type { PointerHandlers } from './input'
import { setHint, ui } from './uiState'

/**
 * Snap a world point to a tile for rail placement: prefer an existing node
 * within magnet range, else the tile under the cursor.
 */
export function snapTile(state: GameState, wx: number, wy: number): { x: number; y: number } {
  let best: { x: number; y: number } | null = null
  let bestDist = 0.65
  for (const node of Object.values(state.railNodes)) {
    const d = Math.hypot(node.x + 0.5 - wx, node.y + 0.5 - wy)
    if (d < bestDist) {
      bestDist = d
      best = { x: node.x, y: node.y }
    }
  }
  return best ?? { x: Math.floor(wx), y: Math.floor(wy) }
}

/**
 * Project a target tile onto the nearest valid 8-direction ray from the
 * anchor, so previews are always straight/45° and building rarely rejects.
 */
export function alignToOctant(
  anchor: { x: number; y: number },
  target: { x: number; y: number },
): { x: number; y: number } {
  const vx = target.x - anchor.x
  const vy = target.y - anchor.y
  if (vx === 0 && vy === 0) return target
  const candidates = [
    { x: anchor.x + vx, y: anchor.y }, // horizontal
    { x: anchor.x, y: anchor.y + vy }, // vertical
    (() => {
      // diagonal with matched magnitude
      const m = Math.round((Math.abs(vx) + Math.abs(vy)) / 2)
      return { x: anchor.x + Math.sign(vx || 1) * m, y: anchor.y + Math.sign(vy || 1) * m }
    })(),
  ]
  let best = candidates[0]!
  let bestDist = Infinity
  for (const c of candidates) {
    const d = Math.hypot(c.x - target.x, c.y - target.y)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  return best
}

function railHandlers(state: GameState): PointerHandlers {
  return {
    onMove(wx, wy) {
      const raw = snapTile(state, wx, wy)
      const tile = ui.railAnchor ? alignToOctant(ui.railAnchor, raw) : raw
      ui.hoverTile = inBounds(state.map, tile.x, tile.y) ? tile : null
      if (ui.railAnchor && ui.hoverTile) {
        const { x: ax, y: ay } = ui.railAnchor
        const check = checkRailPlacement(state, ax, ay, ui.hoverTile.x, ui.hoverTile.y)
        setHint(
          check.ok
            ? `Build track: $${check.cost.toLocaleString('en-US')} — click to place, right-click to cancel`
            : `${check.reason}`,
        )
      } else {
        setHint('Click to start a track segment')
      }
    },
    onClick(wx, wy) {
      const raw = snapTile(state, wx, wy)
      if (!ui.railAnchor) {
        if (!inBounds(state.map, raw.x, raw.y)) return
        ui.railAnchor = raw
        return
      }
      const tile = alignToOctant(ui.railAnchor, raw)
      if (tile.x === ui.railAnchor.x && tile.y === ui.railAnchor.y) {
        ui.railAnchor = null
        return
      }
      const result = buildRail(state, ui.railAnchor.x, ui.railAnchor.y, tile.x, tile.y)
      if (result.ok) {
        ui.railAnchor = tile // chain the next segment from here
      } else {
        setHint(result.reason ?? 'Cannot build here', 1800)
      }
    },
    onRightClick() {
      ui.railAnchor = null
      setHint('')
    },
  }
}

function bulldozeHandlers(state: GameState): PointerHandlers {
  return {
    onMove(wx, wy) {
      ui.hoverEdgeId = findEdgeNear(state, wx, wy)?.id ?? null
      setHint(ui.hoverEdgeId ? 'Click to demolish (refunds half)' : '')
    },
    onClick(wx, wy) {
      const edge = findEdgeNear(state, wx, wy)
      if (edge) {
        bulldozeEdge(state, edge.id)
        ui.hoverEdgeId = null
      }
    },
  }
}

function selectHandlers(_state: GameState): PointerHandlers {
  return {}
}

export function makeHandlers(state: GameState): PointerHandlers {
  switch (ui.tool) {
    case 'rail':
      return railHandlers(state)
    case 'bulldoze':
      return bulldozeHandlers(state)
    default:
      return selectHandlers(state)
  }
}

/** Exposed for tools that need it later (station placement snaps too). */
export { getNodeAt }
