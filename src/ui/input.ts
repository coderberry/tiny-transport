import type { Application } from 'pixi.js'
import type { Camera } from '../render/camera'

/**
 * Pointer contract shared by all tools: dragging always pans the camera,
 * a click (little/no movement) acts with the current tool, wheel zooms.
 */
export interface PointerHandlers {
  onClick?(wx: number, wy: number): void
  onMove?(wx: number, wy: number): void
  onRightClick?(): void
}

const DRAG_THRESHOLD_PX = 5

export function setupInput(
  app: Application,
  camera: Camera,
  getHandlers: () => PointerHandlers,
): void {
  const canvas = app.canvas
  let down: { x: number; y: number; id: number } | null = null
  let dragging = false

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 0 || e.button === 1) {
      down = { x: e.clientX, y: e.clientY, id: e.pointerId }
      dragging = false
    }
  })

  window.addEventListener('pointermove', (e) => {
    if (down && e.pointerId === down.id) {
      const dx = e.clientX - down.x
      const dy = e.clientY - down.y
      if (!dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) dragging = true
      if (dragging) {
        camera.panBy(dx, dy)
        down = { ...down, x: e.clientX, y: e.clientY }
      }
    } else {
      const w = camera.screenToWorld(e.clientX, e.clientY)
      getHandlers().onMove?.(w.x, w.y)
    }
  })

  window.addEventListener('pointerup', (e) => {
    if (!down || e.pointerId !== down.id) return
    const wasDrag = dragging
    down = null
    dragging = false
    if (!wasDrag && e.button === 0) {
      const w = camera.screenToWorld(e.clientX, e.clientY)
      getHandlers().onClick?.(w.x, w.y)
    }
  })

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      const factor = Math.exp(-e.deltaY * 0.0012)
      camera.zoomAt(e.clientX, e.clientY, factor)
    },
    { passive: false },
  )

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    getHandlers().onRightClick?.()
  })
}
