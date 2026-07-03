import { TRAIN_COST } from '../game/economy'
import type { GameState } from '../game/types'
import {
  buyTrain,
  createRoute,
  deleteRoute,
  routeBroken,
  trainsOnRoute,
} from '../trains/routeLogic'
import { setHint, setTool, ui } from './uiState'

/**
 * Bottom-left panel: list routes, draft new ones (via the route tool),
 * and buy trains. Rebuilt from state on a timer — cheap at this scale.
 */
export function setupRoutePanel(state: GameState): void {
  const panel = document.querySelector('#route-panel')!
  panel.classList.remove('hidden')

  const render = () => {
    const routes = Object.values(state.routes)
    const drafting = ui.tool === 'route'
    let html = `<h3>Routes</h3>`

    if (drafting) {
      const names = (ui.routeDraft ?? [])
        .map((id) => state.stations[id]?.name ?? '?')
        .join(' → ')
      html += `<div class="row"><span>${names || 'Click stations on the map…'}</span></div>
        <div class="actions">
          <button data-action="finish" ${(ui.routeDraft?.length ?? 0) < 2 ? 'disabled' : ''}>Create route</button>
          <button data-action="cancel">Cancel</button>
        </div>
        <div class="divider"></div>`
    } else {
      html += `<div class="actions"><button data-action="new">+ New route</button></div>
        <div class="divider"></div>`
    }

    if (routes.length === 0 && !drafting) {
      html += `<div class="row"><span class="k">No routes yet — build two stations, then create one.</span></div>`
    }
    for (const route of routes) {
      const stops = route.stationIds.map((id) => state.stations[id]?.name ?? '?').join(' → ')
      const trains = trainsOnRoute(state, route.id)
      const stuck = trains.filter((t) => t.status === 'noPath' || t.status === 'waiting').length
      const broken = routeBroken(state, route)
      const warnings =
        (broken ? `<div class="row"><span class="warn">⚠ No rail path between stops</span></div>` : '') +
        (!broken && stuck > 0
          ? `<div class="row"><span class="warn">⚠ ${stuck} train${stuck > 1 ? 's' : ''} stuck</span></div>`
          : '')
      const selected = ui.selectedRouteId === route.id ? ' selected' : ''
      html += `<div class="route-item${selected}" data-route-select="${route.id}">
        <div class="row"><strong>${route.name}</strong><span>$${Math.round(route.totalEarned).toLocaleString('en-US')} earned</span></div>
        <div class="row"><span class="k">${stops}</span></div>
        ${warnings}
        <div class="actions">
          <button data-action="train" data-route="${route.id}">+ Train ($${TRAIN_COST.toLocaleString('en-US')})</button>
          <span class="badge">${trains.length} 🚂</span>
          <button data-action="delete" data-route="${route.id}">Delete</button>
        </div>
      </div>`
    }
    if (panel.innerHTML !== html) panel.innerHTML = html
  }

  panel.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null
    if (!target) {
      // Plain click on a route row toggles its map highlight.
      const item = (e.target as HTMLElement).closest('[data-route-select]') as HTMLElement | null
      const id = item?.dataset['routeSelect']
      if (id) {
        ui.selectedRouteId = ui.selectedRouteId === id ? null : id
        render()
      }
      return
    }
    const action = target.dataset['action']
    const routeId = target.dataset['route']
    if (action === 'new') {
      setTool('route')
      setHint('Click stations in order to build the route')
    } else if (action === 'cancel') {
      setTool('select')
    } else if (action === 'finish') {
      const result = createRoute(state, ui.routeDraft ?? [])
      if (result.ok) {
        setTool('select')
        setHint('Route created — add a train to run it', 2500)
      } else {
        setHint(result.reason ?? 'Cannot create route', 2000)
      }
    } else if (action === 'train' && routeId) {
      const result = buyTrain(state, routeId)
      if (!result.ok) setHint(result.reason ?? 'Cannot buy train', 2000)
    } else if (action === 'delete' && routeId) {
      deleteRoute(state, routeId)
      if (ui.selectedRouteId === routeId) ui.selectedRouteId = null
    }
    render()
  })

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && ui.tool === 'route' && (ui.routeDraft?.length ?? 0) >= 2) {
      const result = createRoute(state, ui.routeDraft ?? [])
      if (result.ok) setTool('select')
    }
  })

  render()
  setInterval(render, 400)
}
