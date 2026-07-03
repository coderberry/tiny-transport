import { Container, Graphics } from 'pixi.js'
import type { GameState } from '../game/types'
import { TILE } from './camera'

const BODY = 0x8c2f28
const CAB = 0x5e1f1a
const WARN = 0xffb02e

interface TrainSprite {
  root: Container
  body: Graphics
  badge: Graphics
}

const spriteMaps = new WeakMap<Container, Map<string, TrainSprite>>()

function buildSprite(layer: Container): TrainSprite {
  const root = new Container()
  const body = new Graphics()
  body
    .roundRect(-TILE * 0.48, -TILE * 0.21, TILE * 0.96, TILE * 0.42, 4)
    .fill(BODY)
    .roundRect(-TILE * 0.48, -TILE * 0.21, TILE * 0.96, TILE * 0.42, 4)
    .stroke({ color: 0x2b1512, width: 1.5 })
    .roundRect(TILE * 0.08, -TILE * 0.16, TILE * 0.3, TILE * 0.32, 3)
    .fill(CAB)
    .circle(TILE * 0.42, 0, TILE * 0.05)
    .fill(0xffe9a8)
  const badge = new Graphics()
  badge.circle(0, 0, TILE * 0.16).fill(WARN)
  badge.circle(0, 0, TILE * 0.16).stroke({ color: 0x3a2a00, width: 2 })
  badge.rect(-TILE * 0.025, -TILE * 0.09, TILE * 0.05, TILE * 0.1).fill(0x3a2a00)
  badge.circle(0, TILE * 0.07, TILE * 0.028).fill(0x3a2a00)
  badge.position.set(0, -TILE * 0.5)
  badge.visible = false
  root.addChild(body, badge)
  layer.addChild(root)
  return { root, body, badge }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Trains re-render every frame, interpolated between the last two ticks. */
export function renderTrains(layer: Container, state: GameState, alpha: number): void {
  let sprites = spriteMaps.get(layer)
  if (!sprites) {
    sprites = new Map()
    spriteMaps.set(layer, sprites)
  }

  const seen = new Set<string>()
  for (const train of Object.values(state.trains)) {
    seen.add(train.id)
    let sprite = sprites.get(train.id)
    if (!sprite) {
      sprite = buildSprite(layer)
      sprites.set(train.id, sprite)
    }
    const x = lerp(train.prevX, train.x, alpha)
    const y = lerp(train.prevY, train.y, alpha)
    sprite.root.position.set((x + 0.5) * TILE, (y + 0.5) * TILE)
    sprite.body.rotation = train.heading
    sprite.badge.visible = train.status === 'noPath' || train.status === 'waiting'
  }

  for (const [id, sprite] of sprites) {
    if (!seen.has(id)) {
      layer.removeChild(sprite.root)
      sprite.root.destroy({ children: true })
      sprites.delete(id)
    }
  }
}
