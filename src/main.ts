import { Application } from 'pixi.js'
import './style.css'
import { startLoop } from './core/loop'
import { createEmptyState } from './game/state'

async function boot() {
  const app = new Application()
  await app.init({
    resizeTo: window,
    background: 0x101a16,
    antialias: true,
    autoStart: false, // we render from our own loop
  })
  document.querySelector('#app')!.appendChild(app.canvas)

  const state = createEmptyState(42)
  const debugEl = document.querySelector('#debug')!

  const loop = startLoop({
    tick: () => {
      state.tick++
    },
    render: (_alpha, fps) => {
      app.render()
      debugEl.textContent = `tick ${state.tick} · ${fps.toFixed(0)} fps · ×${loop.getSpeed()}`
    },
  })
}

boot().catch((err) => {
  console.error('boot failed', err)
  document.body.textContent = `Failed to start: ${err}`
})
