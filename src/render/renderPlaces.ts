import { Container, Graphics } from 'pixi.js'
import { CARGO } from '../content/cargo'
import { INDUSTRY_DEFS } from '../content/industries'
import type { GameState } from '../game/types'
import { TILE } from './camera'
import { clearLabelPool, makeLabel } from './labels'

/** Cities and industries are static per game; drawn once. */
export function renderPlaces(layer: Container, state: GameState): void {
  layer.removeChildren()
  clearLabelPool('places')
  const g = new Graphics()
  layer.addChild(g)

  for (const city of Object.values(state.cities)) {
    const cx = (city.x + 0.5) * TILE
    const cy = (city.y + 0.5) * TILE
    const r = TILE * (0.7 + Math.min(city.population / 2600, 1) * 0.5)
    // Halo of "buildings": a soft disc + inner blocks.
    g.circle(cx, cy, r).fill({ color: 0xd8cfb4, alpha: 0.9 })
    g.circle(cx, cy, r).stroke({ color: 0x6b5f43, width: 2 })
    const bs = TILE * 0.22
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 + city.x * 0.7
      const bx = cx + Math.cos(ang) * r * 0.45 - bs / 2
      const by = cy + Math.sin(ang) * r * 0.45 - bs / 2
      g.rect(bx, by, bs, bs).fill(0x8a7b57)
    }
    layer.addChild(makeLabel('places', city.name, cx, cy + r + 2, 14))
  }

  for (const ind of Object.values(state.industries)) {
    const def = INDUSTRY_DEFS[ind.kind]
    const cx = (ind.x + 0.5) * TILE
    const cy = (ind.y + 0.5) * TILE
    const s = TILE * 0.9
    g.roundRect(cx - s / 2, cy - s / 2, s, s, 4).fill(def.color)
    g.roundRect(cx - s / 2, cy - s / 2, s, s, 4).stroke({ color: 0x222222, width: 2 })
    if (def.produces) {
      g.circle(cx, cy, s * 0.22).fill(CARGO[def.produces].color)
      g.circle(cx, cy, s * 0.22).stroke({ color: 0xffffff, width: 1.5 })
    }
    layer.addChild(makeLabel('places', def.name, cx, cy + s / 2 + 2, 11))
  }
}
