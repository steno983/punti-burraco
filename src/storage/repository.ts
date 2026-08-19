import type { Game, Player } from '../engine/types'

export const STORAGE_KEY = 'puntiburraco.v1'
const SCHEMA_VERSION = 1

/** Contenuto completo salvato sul dispositivo. */
export interface PersistedState {
  schemaVersion: 1
  players: Player[]
  games: Game[]
}

function emptyState(): PersistedState {
  return { schemaVersion: SCHEMA_VERSION, players: [], games: [] }
}

/** Legge lo stato salvato. Qualsiasi anomalia produce uno stato vuoto invece di un errore. */
export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    if (parsed.schemaVersion !== SCHEMA_VERSION) return emptyState()
    if (!Array.isArray(parsed.players) || !Array.isArray(parsed.games)) return emptyState()
    return { schemaVersion: SCHEMA_VERSION, players: parsed.players, games: parsed.games }
  } catch {
    return emptyState()
  }
}

export function saveState(state: PersistedState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

/** Inserisce o sostituisce una partita, restituendo lo stato aggiornato. */
export function upsertGame(game: Game): PersistedState {
  const state = loadState()
  const index = state.games.findIndex((g) => g.id === game.id)
  const games = index === -1 ? [...state.games, game] : state.games.map((g, i) => (i === index ? game : g))
  const next = { ...state, games }
  saveState(next)
  return next
}

/** Recupera o crea un giocatore in rubrica, confrontando i nomi senza distinzione di maiuscole. */
export function upsertPlayer(
  name: string,
  newId: () => string,
  now: () => string,
): { state: PersistedState; player: Player } {
  const state = loadState()
  const normalized = name.trim().toLocaleLowerCase('it')
  const existing = state.players.find((p) => p.name.trim().toLocaleLowerCase('it') === normalized)
  if (existing) return { state, player: existing }

  const player: Player = { id: newId(), name: name.trim(), createdAt: now() }
  const next = { ...state, players: [...state.players, player] }
  saveState(next)
  return { state: next, player }
}

export function getGame(id: string): Game | null {
  return loadState().games.find((g) => g.id === id) ?? null
}

export function deleteGame(id: string): PersistedState {
  const state = loadState()
  const next = { ...state, games: state.games.filter((g) => g.id !== id) }
  saveState(next)
  return next
}
