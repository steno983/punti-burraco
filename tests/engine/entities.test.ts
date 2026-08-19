import { describe, it, expect } from 'vitest'
import { resolveEntities, resolveLedgerAccounts } from '../../src/engine/entities'
import type { Game } from '../../src/engine/types'

function makeGame(mode: 2 | 3 | 4, playerNames: string[]): Game {
  return {
    id: 'g1',
    mode,
    options: { semipulitoEnabled: true },
    targetScore: 2005,
    players: playerNames.map((name, i) => ({ playerId: `p${i + 1}`, name, seat: i })),
    teams:
      mode === 4
        ? [
            { id: 't1', name: 'Squadra 1', playerIds: ['p1', 'p3'] },
            { id: 't2', name: 'Squadra 2', playerIds: ['p2', 'p4'] },
          ]
        : [],
    hands: [],
    status: 'in_progress',
    winnerIds: [],
    createdAt: '2026-08-19T10:00:00.000Z',
    updatedAt: '2026-08-19T10:00:00.000Z',
  }
}

describe('resolveEntities', () => {
  it('a 2 giocatori restituisce due entità individuali', () => {
    const entities = resolveEntities(makeGame(2, ['Ann', 'Bob']), 1, null)
    expect(entities).toHaveLength(2)
    expect(entities.map((e) => e.kind)).toEqual(['player', 'player'])
    expect(entities.map((e) => e.id)).toEqual(['p1', 'p2'])
  })

  it('a 4 giocatori restituisce due entità squadra con i rispettivi giocatori', () => {
    const entities = resolveEntities(makeGame(4, ['Ann', 'Bob', 'Cid', 'Dan']), 1, null)
    expect(entities).toHaveLength(2)
    expect(entities[0]).toMatchObject({ id: 't1', kind: 'team', playerIds: ['p1', 'p3'] })
    expect(entities[1]).toMatchObject({ id: 't2', kind: 'team', playerIds: ['p2', 'p4'] })
  })

  it('a 3 giocatori in fase 1 separa il solista dalla coppia', () => {
    const entities = resolveEntities(makeGame(3, ['Ann', 'Bob', 'Cid']), 1, 'p2')
    expect(entities).toHaveLength(2)
    expect(entities[0]).toMatchObject({ id: 'p2', kind: 'player', playerIds: ['p2'] })
    expect(entities[1]).toMatchObject({ kind: 'pair', playerIds: ['p1', 'p3'] })
    expect(entities[1].label).toBe('Ann e Cid')
  })

  it('a 3 giocatori in fase 2 restituisce tre entità individuali', () => {
    const entities = resolveEntities(makeGame(3, ['Ann', 'Bob', 'Cid']), 2, null)
    expect(entities.map((e) => e.id)).toEqual(['p1', 'p2', 'p3'])
    expect(entities.every((e) => e.kind === 'player')).toBe(true)
  })

  it('a 3 giocatori in fase 1 senza solista indicato solleva un errore', () => {
    expect(() => resolveEntities(makeGame(3, ['Ann', 'Bob', 'Cid']), 1, null)).toThrow(
      /solista/i,
    )
  })
})

describe('resolveLedgerAccounts', () => {
  it('a 4 giocatori il conto punti è di squadra', () => {
    const accounts = resolveLedgerAccounts(makeGame(4, ['Ann', 'Bob', 'Cid', 'Dan']))
    expect(accounts.map((a) => a.id)).toEqual(['t1', 't2'])
    expect(accounts[0].kind).toBe('team')
  })

  it('a 2 e 3 giocatori il conto punti è individuale', () => {
    expect(resolveLedgerAccounts(makeGame(2, ['Ann', 'Bob'])).map((a) => a.id)).toEqual(['p1', 'p2'])
    expect(resolveLedgerAccounts(makeGame(3, ['Ann', 'Bob', 'Cid'])).map((a) => a.id)).toEqual([
      'p1',
      'p2',
      'p3',
    ])
  })
})
