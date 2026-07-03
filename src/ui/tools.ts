import {
  buildStation,
  checkStationPlacement,
  findStationNear,
  removeStation,
  stationCatchment,
} from '../game/actions'
import type { GameState } from '../game/types'
import { INDUSTRY_DEFS } from '../content/industries'
import { inBounds } from '../map/terrain'
import { buildRail, bulldozeEdge, checkRailPlacement, findEdgeNear } from '../rail/buildTrack'
import type { PointerHandlers } from './input'
import { setHint, ui } from './uiState'

/**
 * Snap a world point to a tile for placement: prefer an existing node
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

function stationHandlers(state: GameState): PointerHandlers {
  return {
    onMove(wx, wy) {
      const tile = snapTile(state, wx, wy)
      ui.hoverTile = inBounds(state.map, tile.x, tile.y) ? tile : null
      if (!ui.hoverTile) return
      const check = checkStationPlacement(state, ui.hoverTile.x, ui.hoverTile.y)
      if (!check.ok) {
        setHint(check.reason ?? 'Cannot place station here')
        return
      }
      const { city, industry } = stationCatchment(state, ui.hoverTile.x, ui.hoverTile.y)
      const links = [
        ...(city ? [city.name] : []),
        ...(industry ? [INDUSTRY_DEFS[industry.kind].name] : []),
      ]
      setHint(
        `Station: $${check.cost.toLocaleString('en-US')}` +
          (links.length ? ` — links ${links.join(' + ')}` : ' — nothing in range'),
      )
    },
    onClick(wx, wy) {
      const tile = snapTile(state, wx, wy)
      const result = buildStation(state, tile.x, tile.y)
      if (!result.ok) setHint(result.reason ?? 'Cannot place station here', 1800)
    },
  }
}

function bulldozeHandlers(state: GameState): PointerHandlers {
  return {
    onMove(wx, wy) {
      const station = findStationNear(state, wx, wy)
      if (station) {
        ui.hoverEdgeId = null
        setHint(`Demolish ${station.name} (refunds half)`)
        return
      }
      ui.hoverEdgeId = findEdgeNear(state, wx, wy)?.id ?? null
      setHint(ui.hoverEdgeId ? 'Click to demolish track (refunds half)' : '')
    },
    onClick(wx, wy) {
      const station = findStationNear(state, wx, wy)
      if (station) {
        removeStation(state, station.id)
        return
      }
      const edge = findEdgeNear(state, wx, wy)
      if (edge) {
        bulldozeEdge(state, edge.id)
        ui.hoverEdgeId = null
      }
    },
  }
}

function routeHandlers(state: GameState): PointerHandlers {
  const draftHint = () => {
    const draft = ui.routeDraft ?? []
    const names = draft.map((id) => state.stations[id]?.name ?? '?').join(' → ')
    setHint(
      draft.length === 0
        ? 'Click stations in order to build the route'
        : `${names} — click more stations, Enter to create, right-click to undo`,
    )
  }
  return {
    onMove() {
      draftHint()
    },
    onClick(wx, wy) {
      const station = findStationNear(state, wx, wy, 1.2)
      if (!station) return
      ui.routeDraft ??= []
      if (ui.routeDraft[ui.routeDraft.length - 1] === station.id) return
      ui.routeDraft.push(station.id)
      draftHint()
    },
    onRightClick() {
      ui.routeDraft?.pop()
      draftHint()
    },
  }
}

function selectHandlers(state: GameState): PointerHandlers {
  return {
    onClick(wx, wy) {
      const station = findStationNear(state, wx, wy)
      if (station) {
        ui.selection = { kind: 'station', id: station.id }
        // Path debug: pick two stations to preview the route between them.
        if (ui.pathDebug.length === 1 && ui.pathDebug[0] !== station.id) {
          ui.pathDebug = [ui.pathDebug[0]!, station.id]
        } else {
          ui.pathDebug = [station.id]
          setHint('Click another station to preview the rail path')
        }
        return
      }
      ui.selection = null
      ui.pathDebug = []
      setHint('')
    },
  }
}

export function makeHandlers(state: GameState): PointerHandlers {
  switch (ui.tool) {
    case 'rail':
      return railHandlers(state)
    case 'station':
      return stationHandlers(state)
    case 'route':
      return routeHandlers(state)
    case 'bulldoze':
      return bulldozeHandlers(state)
    default:
      return selectHandlers(state)
  }
}
