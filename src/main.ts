import { Application, Container } from 'pixi.js'
import './style.css'
import { startLoop } from './core/loop'
import { newGame } from './map/generateMap'
import { createCamera } from './render/camera'
import { renderPlaces, updateLabelScale } from './render/renderPlaces'
import { renderTerrain } from './render/renderTerrain'
import { setupHud } from './ui/hud'
import { setupInput } from './ui/input'

function seedFromUrl(): number {
  const raw = new URLSearchParams(location.search).get('seed')
  const n = raw === null ? NaN : Number(raw)
  return Number.isFinite(n) ? n : 42
}

async function boot() {
  const app = new Application()
  await app.init({
    resizeTo: window,
    background: 0x101a16,
    antialias: true,
    autoStart: false, // we render from our own loop
  })
  document.querySelector('#app')!.appendChild(app.canvas)

  const state = newGame(seedFromUrl())
  const camera = createCamera(app)

  // Z-order per the plan: terrain → places → rails → stations → trains → selection.
  const layers = {
    terrain: new Container(),
    places: new Container(),
    rails: new Container(),
    stations: new Container(),
    trains: new Container(),
    selection: new Container(),
  }
  camera.world.addChild(
    layers.terrain,
    layers.places,
    layers.rails,
    layers.stations,
    layers.trains,
    layers.selection,
  )

  renderTerrain(layers.terrain, state)
  renderPlaces(layers.places, state)

  const fitZoom =
    Math.min(
      app.screen.width / (state.map.width * 32),
      app.screen.height / (state.map.height * 32),
    ) * 0.98
  camera.centerOn(state.map.width / 2, state.map.height / 2, fitZoom)

  setupInput(app, camera, () => ({}))

  const hud = setupHud()

  const loop = startLoop({
    tick: () => {
      state.tick++
    },
    render: (_alpha, fps) => {
      updateLabelScale(camera.getZoom())
      app.render()
      hud.update(state, fps, loop.getSpeed())
    },
  })
}

boot().catch((err) => {
  console.error('boot failed', err)
  document.body.textContent = `Failed to start: ${err}`
})
