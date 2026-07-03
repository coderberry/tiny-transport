import { Application, Container } from 'pixi.js'
import './style.css'
import { startLoop, TICK_DT } from './core/loop'
import { simulationTick } from './game/simulation'
import type { GameState } from './game/types'
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
import { createSaveStore } from './storage/saveStore'
import { deserialize, serialize } from './storage/serialize'
import { setupHud } from './ui/hud'
import { setupInput } from './ui/input'
import { setupInspector } from './ui/inspector'
import { setupRoutePanel } from './ui/routePanel'
import { setupToolbar } from './ui/toolbar'
import { makeHandlers } from './ui/tools'
import { setHint, ui } from './ui/uiState'

/** Autosave cadence in ticks (10 ticks = 1 game second). */
const AUTOSAVE_EVERY_TICKS = 600

function seedFromUrl(): number | null {
  const raw = new URLSearchParams(location.search).get('seed')
  const n = raw === null ? NaN : Number(raw)
  return Number.isFinite(n) ? n : null
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

  const store = createSaveStore()

  // ?seed= forces a fresh world; otherwise resume the autosave if present.
  const urlSeed = seedFromUrl()
  const autosave = urlSeed === null ? store.load('auto') : null
  const resumed = autosave ? deserialize(autosave) : null
  const state: GameState = resumed ?? newGame(urlSeed ?? 42)

  const camera = createCamera(app)

  // Z-order per the plan: terrain → places → rails → stations → trains → selection → fx.
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

  const fitZoom = () =>
    Math.min(
      app.screen.width / (state.map.width * 32),
      app.screen.height / (state.map.height * 32),
    ) * 0.98

  const renderStaticWorld = () => {
    renderTerrain(layers.terrain, state)
    renderPlaces(layers.places, state)
    camera.centerOn(state.map.width / 2, state.map.height / 2, fitZoom())
  }
  renderStaticWorld()

  /** Swap in a loaded/new world without disturbing closures over `state`. */
  const applyState = (loaded: GameState) => {
    Object.assign(state, loaded)
    state.railVersion++ // force rails/stations layers to rebuild
    layers.fx.removeChildren()
    ui.selection = null
    ui.selectedRouteId = null
    ui.pathDebug = []
    ui.railAnchor = null
    ui.routeDraft = null
    renderStaticWorld()
  }

  setupInput(app, camera, () => makeHandlers(state))
  setupToolbar()
  setupRoutePanel(state)
  setupInspector(state)

  const hud = setupHud({
    onSave: () => {
      setHint(store.save('manual', serialize(state)) ? 'Game saved' : 'Save failed', 1800)
    },
    onLoad: () => {
      const raw = store.load('manual')
      const loaded = raw ? deserialize(raw) : null
      if (loaded) {
        applyState(loaded)
        setHint('Game loaded', 1800)
      } else {
        setHint('No manual save found', 1800)
      }
    },
    onNew: () => {
      const suggestion = String(Math.floor(Math.random() * 1_000_000))
      const input = window.prompt('New game — map seed:', suggestion)
      if (input === null) return
      const seed = Number(input)
      applyState(newGame(Number.isFinite(seed) ? seed : 42))
      history.replaceState(null, '', location.pathname) // refresh resumes autosave
      store.save('auto', serialize(state))
      setHint(`New game (seed ${state.seed})`, 1800)
    },
    setSpeed: (s) => loop.setSpeed(s),
  })

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
      applyState,
      actions: { buildRail, checkRailPlacement, buildStation, createRoute, buyTrain },
    }
  }

  const loop = startLoop({
    tick: () => {
      const events = simulationTick(state, TICK_DT)
      for (const e of events) spawnFloatingText(layers.fx, e.x, e.y, e.text)
      if (state.tick % AUTOSAVE_EVERY_TICKS === 0) store.save('auto', serialize(state))
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
