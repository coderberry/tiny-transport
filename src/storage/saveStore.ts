/**
 * Save persistence behind a minimal interface. localStorage is plenty for
 * MVP-sized saves (<1 MB); swapping in IndexedDB/Dexie later only touches
 * this file.
 */
export interface SaveStore {
  save(slot: string, data: string): boolean
  load(slot: string): string | null
  remove(slot: string): void
}

/** Subset of the DOM Storage interface we rely on (testable with a fake). */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const PREFIX = 'tiny-transport.save.'

export function createSaveStore(backend?: StorageLike): SaveStore {
  const storage = backend ?? window.localStorage
  return {
    save(slot, data) {
      try {
        storage.setItem(PREFIX + slot, data)
        return true
      } catch {
        return false // quota exceeded or storage disabled
      }
    },
    load(slot) {
      try {
        return storage.getItem(PREFIX + slot)
      } catch {
        return null
      }
    },
    remove(slot) {
      try {
        storage.removeItem(PREFIX + slot)
      } catch {
        // ignore
      }
    },
  }
}
