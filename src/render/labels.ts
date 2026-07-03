import { Text } from 'pixi.js'

/**
 * World-space text labels, grouped by owner so each renderer can rebuild its
 * own set. All labels counter-scale against zoom to stay readable.
 */
const pools = new Map<string, Text[]>()

export function clearLabelPool(pool: string): void {
  pools.set(pool, [])
}

export function makeLabel(pool: string, text: string, x: number, y: number, size = 13): Text {
  const label = new Text({
    text,
    style: {
      fontFamily: 'Avenir Next, system-ui, sans-serif',
      fontSize: size,
      fill: 0xffffff,
      stroke: { color: 0x10201a, width: 3 },
    },
  })
  label.anchor.set(0.5, 0)
  label.position.set(x, y)
  let list = pools.get(pool)
  if (!list) {
    list = []
    pools.set(pool, list)
  }
  list.push(label)
  return label
}

export function updateLabelScale(zoom: number): void {
  const s = zoom < 1 ? Math.min(1 / zoom, 2.2) : 1
  for (const list of pools.values()) {
    for (const label of list) label.scale.set(s)
  }
}
