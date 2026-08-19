import { describe, it, expect } from 'vitest'
import { createGame, addHand, updateHand, deleteHand, type EngineDeps } from '../../src/engine/game'
import type { HandEntry } from '../../src/engine/types'

function makeDeps(): EngineDeps {
  let counter = 0
  return {
    newId: () => `id${++counter}`,
    now: () => '2026-08-19T12:00:00.000Z',
  }
}

function entry(entityId: string, overrides: Partial<HandEntry> = {}): HandEntry {
  return {
    entityId,
    closed: false,
    tookPot: true,
    cleanBurracos: 0,
    semiCleanBurracos: 0,
    dirtyBurracos: 0,
    tablePoints: 0,
    handPoints: 0,
    ...overrides,
  }
}

describe('createGame', () => {
  it('crea una partita a due giocatori pronta da giocare', () => {
    const game = createGame(
      {
        mode: 2,
        players: [
          { playerId: 'p1', name: 'Ann' },
          { playerId: 'p2', name: 'Bob' },
        ],
        options: { semipulitoEnabled: true },
      },
      makeDeps(),
    )
    expect(game.mode).toBe(2)
    expect(game.targetScore).toBe(2005)
    expect(game.status).toBe('in_progress')
    expect(game.hands).toEqual([])
    expect(game.players.map((p) => p.seat)).toEqual([0, 1])
  })

  it('crea le squadre nella partita a quattro giocatori', () => {
    const game = createGame(
      {
        mode: 4,
        players: [
          { playerId: 'p1', name: 'Ann' },
          { playerId: 'p2', name: 'Bob' },
          { playerId: 'p3', name: 'Cid' },
          { playerId: 'p4', name: 'Dan' },
        ],
        teams: [
          { name: 'Noi', playerIds: ['p1', 'p3'] },
          { name: 'Loro', playerIds: ['p2', 'p4'] },
        ],
        options: { semipulitoEnabled: false },
      },
      makeDeps(),
    )
    expect(game.teams).toHaveLength(2)
    expect(game.teams[0].playerIds).toEqual(['p1', 'p3'])
    expect(game.options.semipulitoEnabled).toBe(false)
  })

  it('rifiuta un numero di giocatori diverso dalla modalità', () => {
    expect(() =>
      createGame(
        { mode: 4, players: [{ playerId: 'p1', name: 'Ann' }], options: { semipulitoEnabled: true } },
        makeDeps(),
      ),
    ).toThrow(/giocatori/i)
  })
})

describe('addHand', () => {
  it('aggiunge una smazzata senza modificare la partita originale', () => {
    const deps = makeDeps()
    const game = createGame(
      {
        mode: 2,
        players: [
          { playerId: 'p1', name: 'Ann' },
          { playerId: 'p2', name: 'Bob' },
        ],
        options: { semipulitoEnabled: true },
      },
      deps,
    )
    const updated = addHand(
      game,
      {
        soloPlayerId: null,
        entries: [entry('p1', { closed: true, cleanBurracos: 1, tablePoints: 300 }), entry('p2')],
      },
      deps,
    )
    expect(game.hands).toHaveLength(0)
    expect(updated.hands).toHaveLength(1)
    expect(updated.hands[0].entries[0].closed).toBe(true)
  })

  it('conclude la partita quando si supera l obiettivo', () => {
    const deps = makeDeps()
    let game = createGame(
      {
        mode: 2,
        players: [
          { playerId: 'p1', name: 'Ann' },
          { playerId: 'p2', name: 'Bob' },
        ],
        options: { semipulitoEnabled: true },
      },
      deps,
    )
    game = addHand(
      game,
      { soloPlayerId: null, entries: [entry('p1', { tablePoints: 2005 }), entry('p2')] },
      deps,
    )
    expect(game.status).toBe('completed')
    expect(game.winnerIds).toEqual(['p1'])
  })
})

describe('updateHand e deleteHand', () => {
  it('ricalcola i totali dopo la correzione di una smazzata', () => {
    const deps = makeDeps()
    let game = createGame(
      {
        mode: 2,
        players: [
          { playerId: 'p1', name: 'Ann' },
          { playerId: 'p2', name: 'Bob' },
        ],
        options: { semipulitoEnabled: true },
      },
      deps,
    )
    game = addHand(
      game,
      { soloPlayerId: null, entries: [entry('p1', { tablePoints: 2005 }), entry('p2')] },
      deps,
    )
    expect(game.status).toBe('completed')

    game = updateHand(
      game,
      game.hands[0].id,
      { soloPlayerId: null, entries: [entry('p1', { tablePoints: 205 }), entry('p2')] },
      deps,
    )
    expect(game.status).toBe('in_progress')
    expect(game.winnerIds).toEqual([])
    expect(game.hands).toHaveLength(1)
  })

  it('elimina una smazzata', () => {
    const deps = makeDeps()
    let game = createGame(
      {
        mode: 2,
        players: [
          { playerId: 'p1', name: 'Ann' },
          { playerId: 'p2', name: 'Bob' },
        ],
        options: { semipulitoEnabled: true },
      },
      deps,
    )
    game = addHand(game, { soloPlayerId: null, entries: [entry('p1'), entry('p2')] }, deps)
    const handId = game.hands[0].id
    game = deleteHand(game, handId, deps)
    expect(game.hands).toHaveLength(0)
  })

  it('segnala l errore se la smazzata da modificare non esiste', () => {
    const deps = makeDeps()
    const game = createGame(
      {
        mode: 2,
        players: [
          { playerId: 'p1', name: 'Ann' },
          { playerId: 'p2', name: 'Bob' },
        ],
        options: { semipulitoEnabled: true },
      },
      deps,
    )
    expect(() =>
      updateHand(game, 'inesistente', { soloPlayerId: null, entries: [] }, deps),
    ).toThrow(/smazzata/i)
  })
})
