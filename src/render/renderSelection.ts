import { Container, Graphics } from 'pixi.js'
import { checkStationPlacement, stationCatchment } from '../game/actions'
import { STATION_CATCHMENT_RADIUS } from '../game/economy'
import type { GameState } from '../game/types'
import { checkRailPlacement } from '../rail/buildTrack'
import { findPath, nodeSequence, type PathResult } from '../rail/pathfinding'
import { setHint, ui } from '../ui/uiState'
import { TILE } from './camera'

const OK = 0x7dff9c
const BAD = 0xff6b5e
const PATH = 0xffd76a

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

// The debug path is recomputed only when the graph or the picked pair change.
let pathCacheKey = ''
let pathCache: PathResult | null = null

function debugPath(state: GameState, aStation: string, bStation: string): PathResult | null {
  const key = `${state.railVersion}:${aStation}:${bStation}`
  if (key !== pathCacheKey) {
    pathCacheKey = key
    const a = state.stations[aStation]
    const b = state.stations[bStation]
    pathCache = a && b ? findPath(state, a.nodeId, b.nodeId) : null
  }
  return pathCache
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

  if (ui.tool === 'station' && ui.hoverTile) {
    const cx = (ui.hoverTile.x + 0.5) * TILE
    const cy = (ui.hoverTile.y + 0.5) * TILE
    const check = checkStationPlacement(state, ui.hoverTile.x, ui.hoverTile.y)
    const color = check.ok ? OK : BAD
    g.circle(cx, cy, STATION_CATCHMENT_RADIUS * TILE).stroke({
      color,
      width: 1.5,
      alpha: 0.6,
    })
    g.circle(cx, cy, STATION_CATCHMENT_RADIUS * TILE).fill({ color, alpha: 0.07 })
    g.roundRect(cx - TILE * 0.55, cy - TILE * 0.36, TILE * 1.1, TILE * 0.72, 4).stroke({
      color,
      width: 2,
      alpha: 0.9,
    })
    const { city, industry } = stationCatchment(state, ui.hoverTile.x, ui.hoverTile.y)
    for (const target of [city, industry]) {
      if (!target) continue
      g.moveTo(cx, cy)
        .lineTo((target.x + 0.5) * TILE, (target.y + 0.5) * TILE)
        .stroke({ color: 0xffffff, width: 1.5, alpha: 0.5 })
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

  // Route draft: dashed hops between the picked stations, in order.
  if (ui.tool === 'route' && ui.routeDraft && ui.routeDraft.length > 0) {
    let prev: { x: number; y: number } | null = null
    ui.routeDraft.forEach((stationId, i) => {
      const station = state.stations[stationId]
      const node = station && state.railNodes[station.nodeId]
      if (!node) return
      const px = (node.x + 0.5) * TILE
      const py = (node.y + 0.5) * TILE
      g.circle(px, py, TILE * 0.28).stroke({ color: PATH, width: 3 })
      if (i === 0) g.circle(px, py, TILE * 0.12).fill(PATH)
      if (prev) {
        g.moveTo(prev.x, prev.y).lineTo(px, py).stroke({
          color: PATH,
          width: 2,
          alpha: 0.6,
        })
      }
      prev = { x: px, y: py }
    })
  }

  // Path debug: two stations picked with the select tool.
  if (ui.tool === 'select' && ui.pathDebug.length === 2) {
    const [aId, bId] = ui.pathDebug as [string, string]
    const result = debugPath(state, aId, bId)
    const aStation = state.stations[aId]
    if (result && aStation) {
      const seq = nodeSequence(state, aStation.nodeId, result.steps)
      let started = false
      for (const nodeId of seq) {
        const node = state.railNodes[nodeId]
        if (!node) continue
        const px = (node.x + 0.5) * TILE
        const py = (node.y + 0.5) * TILE
        if (!started) {
          g.moveTo(px, py)
          started = true
        } else {
          g.lineTo(px, py)
        }
      }
      g.stroke({ color: PATH, width: TILE * 0.2, alpha: 0.85, cap: 'round', join: 'round' })
      setHint(`Path: ${result.length.toFixed(1)} tiles`)
    } else {
      setHint('No rail path between those stations')
    }
  }
}
