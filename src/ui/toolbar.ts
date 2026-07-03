import { onToolChange, setTool, ui, type Tool } from './uiState'

interface ToolButton {
  tool: Tool
  label: string
  key: string
}

const BUTTONS: ToolButton[] = [
  { tool: 'select', label: 'Select', key: '1' },
  { tool: 'rail', label: 'Rail', key: '2' },
  { tool: 'station', label: 'Station', key: '3' },
  { tool: 'route', label: 'Routes', key: '4' },
  { tool: 'bulldoze', label: 'Bulldoze', key: '5' },
]

export function setupToolbar(): void {
  const bar = document.querySelector('#toolbar')!
  const els = new Map<Tool, HTMLButtonElement>()

  for (const { tool, label, key } of BUTTONS) {
    const btn = document.createElement('button')
    btn.textContent = `${label} (${key})`
    btn.addEventListener('click', () => setTool(tool))
    bar.appendChild(btn)
    els.set(tool, btn)
  }

  const refresh = (active: Tool) => {
    for (const [tool, btn] of els) btn.classList.toggle('active', tool === active)
  }
  onToolChange(refresh)
  refresh(ui.tool)

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return
    if (e.key === 'Escape') {
      if (ui.railAnchor) {
        ui.railAnchor = null
      } else if (ui.tool !== 'select') {
        setTool('select')
      } else {
        ui.selection = null
        ui.selectedRouteId = null
        ui.pathDebug = []
      }
      return
    }
    const match = BUTTONS.find((b) => b.key === e.key)
    if (match) setTool(match.tool)
  })
}
