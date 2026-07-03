import type { GameState } from '../game/types'

export interface HudActions {
  onSave(): void
  onLoad(): void
  onNew(): void
  setSpeed(speed: number): void
}

export interface Hud {
  update(state: GameState, fps: number, speed: number): void
}

const SPEEDS = [
  { value: 0, label: '⏸' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 4, label: '4×' },
]

export function setupHud(actions: HudActions): Hud {
  const hudEl = document.querySelector('#hud')!

  const mkButton = (label: string, onClick: () => void, title = '') => {
    const btn = document.createElement('button')
    btn.textContent = label
    if (title) btn.title = title
    btn.addEventListener('click', onClick)
    hudEl.appendChild(btn)
    return btn
  }

  mkButton('New', actions.onNew, 'Start a new game')
  mkButton('Load', actions.onLoad, 'Load the manual save')
  mkButton('Save', actions.onSave, 'Save to the manual slot')

  const speedButtons = SPEEDS.map((s) =>
    mkButton(s.label, () => actions.setSpeed(s.value), `Game speed ${s.label}`),
  )

  const moneyEl = document.createElement('span')
  moneyEl.className = 'badge money'
  hudEl.appendChild(moneyEl)

  const debugEl = document.querySelector('#debug')!
  let lastMoney = NaN
  let lastSpeed = -1

  return {
    update(state, fps, speed) {
      if (state.money !== lastMoney) {
        lastMoney = state.money
        moneyEl.textContent = `$${Math.floor(state.money).toLocaleString('en-US')}`
      }
      if (speed !== lastSpeed) {
        lastSpeed = speed
        SPEEDS.forEach((s, i) => speedButtons[i]!.classList.toggle('active', s.value === speed))
      }
      debugEl.textContent = `tick ${state.tick} · ${fps.toFixed(0)} fps · ×${speed}`
    },
  }
}
