import { Text, type Container } from 'pixi.js'
import { TILE } from './camera'

interface Floater {
  text: Text
  age: number
}

const TTL = 2.6
const active: Floater[] = []
let lastUpdate = 0

/** Rising, fading "+$123" popups in world space. */
export function spawnFloatingText(layer: Container, wx: number, wy: number, str: string): void {
  const text = new Text({
    text: str,
    style: {
      fontFamily: 'Avenir Next, system-ui, sans-serif',
      fontSize: 15,
      fontWeight: '700',
      fill: 0xffd76a,
      stroke: { color: 0x10201a, width: 3 },
    },
  })
  text.anchor.set(0.5, 1)
  text.position.set((wx + 0.5) * TILE, wy * TILE)
  layer.addChild(text)
  active.push({ text, age: 0 })
}

/** Called once per rendered frame; uses wall time so speed×0 still fades. */
export function updateFloatingText(): void {
  const now = performance.now() / 1000
  const dt = lastUpdate === 0 ? 0 : Math.min(now - lastUpdate, 0.25)
  lastUpdate = now
  for (let i = active.length - 1; i >= 0; i--) {
    const f = active[i]!
    f.age += dt
    f.text.position.y -= dt * TILE * 0.7
    f.text.alpha = Math.max(0, 1 - (f.age / TTL) ** 2)
    if (f.age >= TTL) {
      f.text.parent?.removeChild(f.text)
      f.text.destroy()
      active.splice(i, 1)
    }
  }
}
