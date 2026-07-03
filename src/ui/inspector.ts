import { CARGO } from '../content/cargo'
import { INDUSTRY_DEFS } from '../content/industries'
import { cargoTotal } from '../game/cargo'
import { BULLDOZE_REFUND, TRAIN_COST } from '../game/economy'
import type { CargoAmounts, GameState } from '../game/types'
import { sellTrain, trainStatusText } from '../trains/routeLogic'
import { ui } from './uiState'

function row(k: string, v: string, cls = ''): string {
  return `<div class="row"><span class="k">${k}</span><span class="${cls}">${v}</span></div>`
}

function cargoRows(amounts: CargoAmounts, emptyText: string): string {
  const entries = Object.entries(amounts).filter(([, v]) => (v ?? 0) > 0)
  if (entries.length === 0) return row('Cargo', emptyText)
  return entries
    .map(([c, v]) => row(CARGO[c as keyof typeof CARGO].name, `${Math.floor(v ?? 0)}`))
    .join('')
}

function header(title: string): string {
  return `<div class="row"><h3>${title}</h3><button class="small" data-action="close">✕</button></div>`
}

export function setupInspector(state: GameState): void {
  const panel = document.querySelector('#inspector')!

  const render = () => {
    const sel = ui.selection
    if (!sel) {
      panel.classList.add('hidden')
      return
    }
    let html = ''

    if (sel.kind === 'station') {
      const station = state.stations[sel.id]
      if (!station) {
        ui.selection = null
        return
      }
      const city = station.cityId ? state.cities[station.cityId] : undefined
      const industry = station.industryId ? state.industries[station.industryId] : undefined
      const servingRoutes = Object.values(state.routes).filter((r) =>
        r.stationIds.includes(station.id),
      )
      html = header(station.name)
      if (city) html += row('Serves city', city.name)
      if (industry) html += row('Serves industry', INDUSTRY_DEFS[industry.kind].name)
      if (!city && !industry) html += row('Serves', '<span class="warn">nothing in range</span>')
      html += `<div class="divider"></div>` + cargoRows(station.storage, 'empty')
      html += `<div class="divider"></div>`
      html += row(
        'Routes',
        servingRoutes.length ? servingRoutes.map((r) => r.name).join(', ') : 'none',
      )
    } else if (sel.kind === 'train') {
      const train = state.trains[sel.id]
      if (!train) {
        ui.selection = null
        return
      }
      const route = state.routes[train.routeId]
      const stuck = train.status === 'noPath' || train.status === 'waiting'
      html = header('Train')
      html += row('Route', route?.name ?? '—')
      html += row('Status', trainStatusText(state, train), stuck ? 'warn' : '')
      html += row('Load', `${Math.floor(cargoTotal(train.cargo))} / ${train.capacity}`)
      html += cargoRows(train.cargo, 'empty')
      html += `<div class="divider"></div>`
      html += row('Lifetime earnings', `$${Math.round(train.totalEarned).toLocaleString('en-US')}`)
      const refund = Math.round(TRAIN_COST * BULLDOZE_REFUND)
      html += `<div class="actions"><button data-action="sell" data-id="${train.id}">Sell train (+$${refund.toLocaleString('en-US')})</button></div>`
    } else if (sel.kind === 'city') {
      const city = state.cities[sel.id]
      if (!city) {
        ui.selection = null
        return
      }
      const stations = Object.values(state.stations).filter((s) => s.cityId === city.id)
      html = header(city.name)
      html += row('Population', city.population.toLocaleString('en-US'))
      html += row('Demands', city.demands.map((c) => CARGO[c].name).join(', '))
      html += row(
        'Stations',
        stations.length ? stations.map((s) => s.name).join(', ') : '<span class="warn">none</span>',
      )
    } else {
      const industry = state.industries[sel.id]
      if (!industry) {
        ui.selection = null
        return
      }
      const def = INDUSTRY_DEFS[industry.kind]
      const station = Object.values(state.stations).find((s) => s.industryId === industry.id)
      html = header(def.name)
      if (def.produces)
        html += row('Produces', `${CARGO[def.produces].name} (${(def.rate * 60).toFixed(0)}/min)`)
      if (def.consumes) html += row('Consumes', CARGO[def.consumes].name)
      html += row('Station', station ? station.name : '<span class="warn">not connected</span>')
      const stock = cargoRows(industry.inventory, 'empty')
      html += `<div class="divider"></div>` + stock
    }

    panel.classList.remove('hidden')
    if (panel.innerHTML !== html) panel.innerHTML = html
  }

  panel.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null
    if (!target) return
    if (target.dataset['action'] === 'close') ui.selection = null
    if (target.dataset['action'] === 'sell' && target.dataset['id']) {
      sellTrain(state, target.dataset['id'])
      ui.selection = null
    }
    render()
  })

  render()
  setInterval(render, 300)
}
