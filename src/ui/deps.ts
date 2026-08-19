import type { EngineDeps } from '../engine/game'

/** Dipendenze impure reali usate dall'applicazione. */
export const appDeps: EngineDeps = {
  newId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
}
