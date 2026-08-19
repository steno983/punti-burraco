import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  STORAGE_KEY,
  STORAGE_ERROR_MESSAGE,
  onStorageError,
  loadState,
  saveState,
  upsertGame,
  upsertPlayer,
  getGame,
  deleteGame,
} from '../../src/storage/repository'
import type { Game } from '../../src/engine/types'

function makeGame(id: string): Game {
  return {
    id,
    mode: 2,
    options: { semipulitoEnabled: true },
    targetScore: 2005,
    players: [
      { playerId: 'p1', name: 'Ann', seat: 0 },
      { playerId: 'p2', name: 'Bob', seat: 1 },
    ],
    teams: [],
    hands: [],
    status: 'in_progress',
    winnerIds: [],
    createdAt: '2026-08-19T10:00:00.000Z',
    updatedAt: '2026-08-19T10:00:00.000Z',
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('loadState', () => {
  it('restituisce uno stato vuoto se non c è nulla salvato', () => {
    expect(loadState()).toEqual({ schemaVersion: 1, players: [], games: [] })
  })

  it('non esplode se i dati salvati sono corrotti', () => {
    localStorage.setItem(STORAGE_KEY, '{non è json')
    expect(loadState()).toEqual({ schemaVersion: 1, players: [], games: [] })
  })

  it('ignora uno stato con versione di schema sconosciuta', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99, players: [], games: [] }))
    expect(loadState()).toEqual({ schemaVersion: 1, players: [], games: [] })
  })
})

describe('saveState e loadState', () => {
  it('conserva le partite fra un salvataggio e la rilettura', () => {
    saveState({ schemaVersion: 1, players: [], games: [makeGame('g1')] })
    const state = loadState()
    expect(state.games).toHaveLength(1)
    expect(state.games[0].id).toBe('g1')
  })
})

describe('saveState quando il dispositivo rifiuta di salvare', () => {
  it('non solleva, riferisce il fallimento e avvisa chi è in ascolto', () => {
    const messages: string[] = []
    const stop = onStorageError((message) => messages.push(message))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    let saved: boolean | null = null
    expect(() => {
      saved = saveState({ schemaVersion: 1, players: [], games: [makeGame('g1')] })
    }).not.toThrow()
    expect(saved).toBe(false)
    expect(messages).toEqual([STORAGE_ERROR_MESSAGE])

    vi.restoreAllMocks()
    stop()
  })

  it('smette di avvisare chi si è disiscritto', () => {
    const messages: string[] = []
    onStorageError((message) => messages.push(message))()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    saveState({ schemaVersion: 1, players: [], games: [] })
    expect(messages).toEqual([])

    vi.restoreAllMocks()
  })
})

describe('upsertGame', () => {
  it('aggiunge una partita nuova', () => {
    const state = upsertGame(makeGame('g1'))
    expect(state.games.map((g) => g.id)).toEqual(['g1'])
    expect(loadState().games).toHaveLength(1)
  })

  it('sostituisce una partita esistente senza duplicarla', () => {
    upsertGame(makeGame('g1'))
    const updated = { ...makeGame('g1'), status: 'completed' as const }
    const state = upsertGame(updated)
    expect(state.games).toHaveLength(1)
    expect(state.games[0].status).toBe('completed')
  })
})

describe('upsertPlayer', () => {
  it('crea un giocatore nuovo', () => {
    const { player } = upsertPlayer('Ann', () => 'p1', () => '2026-08-19T10:00:00.000Z')
    expect(player).toEqual({ id: 'p1', name: 'Ann', createdAt: '2026-08-19T10:00:00.000Z' })
    expect(loadState().players).toHaveLength(1)
  })

  it('riusa il giocatore esistente ignorando maiuscole e spazi', () => {
    upsertPlayer('Ann', () => 'p1', () => '2026-08-19T10:00:00.000Z')
    const { player, state } = upsertPlayer('  ann ', () => 'p2', () => '2026-08-19T11:00:00.000Z')
    expect(player.id).toBe('p1')
    expect(state.players).toHaveLength(1)
  })
})

describe('getGame e deleteGame', () => {
  it('recupera una partita per identificativo', () => {
    upsertGame(makeGame('g1'))
    expect(getGame('g1')?.id).toBe('g1')
    expect(getGame('assente')).toBeNull()
  })

  it('elimina una partita', () => {
    upsertGame(makeGame('g1'))
    const state = deleteGame('g1')
    expect(state.games).toEqual([])
  })
})
