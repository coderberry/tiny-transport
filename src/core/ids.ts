export interface HasNextId {
  nextId: number
}

/** Deterministic sequential ids: n1, e2, st3, … */
export function nextId(state: HasNextId, prefix: string): string {
  return `${prefix}${state.nextId++}`
}
