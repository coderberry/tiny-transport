export type Tool = 'select' | 'rail' | 'station' | 'bulldoze' | 'route'

export type Selection =
  | { kind: 'station'; id: string }
  | { kind: 'train'; id: string }
  | { kind: 'city'; id: string }
  | { kind: 'industry'; id: string }

/** Transient interaction state — never serialized, never read by the sim. */
export interface UiState {
  tool: Tool
  /** First endpoint of the rail segment being placed (tile ints). */
  railAnchor: { x: number; y: number } | null
  /** Snapped tile under the cursor. */
  hoverTile: { x: number; y: number } | null
  hoverEdgeId: string | null
  selection: Selection | null
  /** Station ids collected while drafting a route (route tool). */
  routeDraft: string[] | null
  /** Two station ids picked in select mode for the path debug view. */
  pathDebug: string[]
}

export const ui: UiState = {
  tool: 'select',
  railAnchor: null,
  hoverTile: null,
  hoverEdgeId: null,
  selection: null,
  routeDraft: null,
  pathDebug: [],
}

const toolListeners: ((tool: Tool) => void)[] = []

export function onToolChange(fn: (tool: Tool) => void): void {
  toolListeners.push(fn)
}

export function setTool(tool: Tool): void {
  ui.tool = tool
  ui.railAnchor = null
  ui.hoverTile = null
  ui.hoverEdgeId = null
  ui.routeDraft = tool === 'route' ? [] : null
  setHint('')
  for (const fn of toolListeners) fn(tool)
}

let hintEl: Element | null = null
let hintTimer: ReturnType<typeof setTimeout> | null = null

/** Bottom-center helper text; pass ttlMs to flash a transient message. */
export function setHint(text: string, ttlMs?: number): void {
  hintEl ??= document.querySelector('#hint')
  if (!hintEl) return
  if (hintTimer) {
    clearTimeout(hintTimer)
    hintTimer = null
  }
  hintEl.textContent = text
  hintEl.classList.toggle('hidden', text === '')
  if (ttlMs && text) {
    hintTimer = setTimeout(() => {
      hintEl?.classList.add('hidden')
    }, ttlMs)
  }
}
