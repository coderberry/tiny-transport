import type { GameState } from '../game/types'

export interface Hud {
  update(state: GameState, fps: number, speed: number): void
}

export function setupHud(): Hud {
  const hudEl = document.querySelector('#hud')!
  const moneyEl = document.createElement('span')
  moneyEl.className = 'badge money'
  hudEl.appendChild(moneyEl)

  const debugEl = document.querySelector('#debug')!
  let lastMoney = NaN

  return {
    update(state, fps, speed) {
      if (state.money !== lastMoney) {
        lastMoney = state.money
        moneyEl.textContent = `$${Math.floor(state.money).toLocaleString('en-US')}`
      }
      debugEl.textContent = `tick ${state.tick} · ${fps.toFixed(0)} fps · ×${speed}`
    },
  }
}
