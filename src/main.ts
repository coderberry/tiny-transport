import { Application, Container } from 'pixi.js'
import './style.css'
import { startLoop, TICK_DT } from './core/loop'
import { simulationTick } from './game/simulation'
import { newGame } from './map/generateMap'
import { createCamera } from './render/camera'
import { spawnFloatingText, updateFloatingText } from './render/floatingText'
import { updateLabelScale } from './render/labels'
import { renderPlaces } from './render/renderPlaces'
import { renderRails } from './render/renderRails'
import { renderSelection } from './render/renderSelection'
import { renderStations } from './render/renderStations'
import { renderTerrain } from './render/renderTerrain'
import { renderTrains } from './render/renderTrains'
import { setupHud } from './ui/hud'
import { setupInput } from './ui/input'
import { setupInspector } from './ui/inspector'
import { setupRoutePanel } from './ui/routePanel'
import { setupToolbar } from './ui/toolbar'
import { makeHandlers } from './ui/tools'

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
    fx: new Container(),
  }
  camera.world.addChild(
    layers.terrain,
    layers.places,
    layers.rails,
    layers.stations,
    layers.trains,
    layers.selection,
    layers.fx,
  )

  renderTerrain(layers.terrain, state)
  renderPlaces(layers.places, state)

  const fitZoom =
    Math.min(
      app.screen.width / (state.map.width * 32),
      app.screen.height / (state.map.height * 32),
    ) * 0.98
  camera.centerOn(state.map.width / 2, state.map.height / 2, fitZoom)

  setupInput(app, camera, () => makeHandlers(state))
  setupToolbar()
  setupRoutePanel(state)
  setupInspector(state)

  if (import.meta.env.DEV) {
    // Debug handle for the console and automated browser checks.
    const [{ buildRail, checkRailPlacement }, { buildStation }, { createRoute, buyTrain }] =
      await Promise.all([
        import('./rail/buildTrack'),
        import('./game/actions'),
        import('./trains/routeLogic'),
      ])
    ;(window as unknown as Record<string, unknown>).__game = {
      state,
      camera,
      actions: { buildRail, checkRailPlacement, buildStation, createRoute, buyTrain },
    }
  }

  const hud = setupHud()

  const loop = startLoop({
    tick: () => {
      const events = simulationTick(state, TICK_DT)
      for (const e of events) spawnFloatingText(layers.fx, e.x, e.y, e.text)
    },
    render: (alpha, fps) => {
      renderRails(layers.rails, state)
      renderStations(layers.stations, state)
      renderTrains(layers.trains, state, alpha)
      renderSelection(layers.selection, state)
      updateFloatingText()
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
