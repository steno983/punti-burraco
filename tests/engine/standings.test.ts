import { describe, it, expect } from 'vitest'
import { replayGame, projectScores } from '../../src/engine/standings'
import type { Game, Hand, HandEntry, ScoringEntity } from '../../src/engine/types'

function baseGame(mode: 2 | 3 | 4, hands: Hand[] = []): Game {
  const names = ['Ann', 'Bob', 'Cid', 'Dan'].slice(0, mode)
  return {
    id: 'g1',
    mode,
    options: { semipulitoEnabled: true },
    targetScore: 2005,
    players: names.map((name, i) => ({ playerId: `p${i + 1}`, name, seat: i })),
    teams:
      mode === 4
        ? [
            { id: 't1', name: 'Ann e Cid', playerIds: ['p1', 'p3'] },
            { id: 't2', name: 'Bob e Dan', playerIds: ['p2', 'p4'] },
          ]
        : [],
    hands,
    status: 'in_progress',
    winnerIds: [],
    createdAt: '2026-08-19T10:00:00.000Z',
    updatedAt: '2026-08-19T10:00:00.000Z',
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

function hand(id: string, entries: HandEntry[], soloPlayerId: string | null = null): Hand {
  return { id, soloPlayerId, entries, createdAt: '2026-08-19T11:00:00.000Z' }
}

describe('projectScores', () => {
  it('divide a metà il punteggio di una coppia arrotondando verso l alto', () => {
    const entities: ScoringEntity[] = [
      { id: 'pair:p1-p3', kind: 'pair', playerIds: ['p1', 'p3'], label: 'Ann e Cid' },
    ]
    const deltas = projectScores(
      [
        {
          entityId: 'pair:p1-p3',
          tablePoints: 305,
          burracoBonus: 0,
          closingBonus: 0,
          handPenalty: 0,
          potPenalty: 0,
          total: 305,
        },
      ],
      entities,
    )
    expect(deltas).toEqual({ p1: 153, p3: 153 })
  })

  it('arrotonda verso l alto anche i punteggi negativi di coppia', () => {
    const entities: ScoringEntity[] = [
      { id: 'pair:p1-p3', kind: 'pair', playerIds: ['p1', 'p3'], label: 'Ann e Cid' },
    ]
    const deltas = projectScores(
      [
        {
          entityId: 'pair:p1-p3',
          tablePoints: 0,
          burracoBonus: 0,
          closingBonus: 0,
          handPenalty: -205,
          potPenalty: -100,
          total: -305,
        },
      ],
      entities,
    )
    expect(deltas).toEqual({ p1: -152, p3: -152 })
  })

  it('assegna il punteggio intero alle entità squadra senza dividerlo', () => {
    const entities: ScoringEntity[] = [
      { id: 't1', kind: 'team', playerIds: ['p1', 'p3'], label: 'Ann e Cid' },
    ]
    const deltas = projectScores(
      [
        {
          entityId: 't1',
          tablePoints: 305,
          burracoBonus: 0,
          closingBonus: 0,
          handPenalty: 0,
          potPenalty: 0,
          total: 305,
        },
      ],
      entities,
    )
    expect(deltas).toEqual({ t1: 305 })
  })
})

describe('replayGame — partita a 2 giocatori', () => {
  it('accumula i punteggi delle smazzate', () => {
    const game = baseGame(2, [
      hand('h1', [
        entry('p1', { closed: true, cleanBurracos: 1, tablePoints: 300 }),
        entry('p2', { tablePoints: 120, handPoints: 40 }),
      ]),
      hand('h2', [
        entry('p1', { tablePoints: 100, handPoints: 20 }),
        entry('p2', { closed: true, dirtyBurracos: 1, tablePoints: 250 }),
      ]),
    ])
    const progress = replayGame(game)
    const points = Object.fromEntries(progress.standings.map((s) => [s.accountId, s.points]))
    expect(points.p1).toBe(600 + 80)
    expect(points.p2).toBe(80 + 450)
    expect(progress.finished).toBe(false)
  })

  it('ordina la classifica dal punteggio più alto', () => {
    const game = baseGame(2, [
      hand('h1', [entry('p1', { tablePoints: 50 }), entry('p2', { tablePoints: 400 })]),
    ])
    expect(replayGame(game).standings[0].accountId).toBe('p2')
  })
})

describe('replayGame — partita a 4 giocatori', () => {
  it('tiene il punteggio per squadra senza dividerlo', () => {
    const game = baseGame(4, [
      hand('h1', [
        entry('t1', { closed: true, cleanBurracos: 1, tablePoints: 405 }),
        entry('t2', { tablePoints: 100, handPoints: 35, tookPot: false }),
      ]),
    ])
    const progress = replayGame(game)
    const points = Object.fromEntries(progress.standings.map((s) => [s.accountId, s.points]))
    expect(points.t1).toBe(405 + 200 + 100)
    expect(points.t2).toBe(100 - 35 - 100)
    expect(progress.standings).toHaveLength(2)
  })
})

describe('replayGame — partita a 3 giocatori', () => {
  it('in fase 1 divide i punti della coppia e lascia interi quelli del solista', () => {
    const game = baseGame(3, [
      hand(
        'h1',
        [
          entry('p2', { closed: true, cleanBurracos: 1, tablePoints: 301 }),
          entry('pair:p1-p3', { tablePoints: 200, handPoints: 45 }),
        ],
        'p2',
      ),
    ])
    const points = Object.fromEntries(replayGame(game).standings.map((s) => [s.accountId, s.points]))
    expect(points.p2).toBe(301 + 200 + 100)
    expect(points.p1).toBe(78) // (200 - 45) / 2 = 77,5 -> 78
    expect(points.p3).toBe(78)
  })

  it('resta in fase 1 finché nessuno raggiunge 1000', () => {
    const game = baseGame(3, [
      hand('h1', [entry('p2', { tablePoints: 999 }), entry('pair:p1-p3', { tablePoints: 100 })], 'p2'),
    ])
    expect(replayGame(game).nextPhase).toBe(1)
  })

  it('passa alla fase 2 quando un giocatore raggiunge esattamente 1000', () => {
    const game = baseGame(3, [
      hand('h1', [entry('p2', { tablePoints: 1000 }), entry('pair:p1-p3', { tablePoints: 100 })], 'p2'),
    ])
    expect(replayGame(game).nextPhase).toBe(2)
  })

  it('in fase 2 usa tre entità individuali e non richiede il solista', () => {
    const game = baseGame(3, [
      hand('h1', [entry('p2', { tablePoints: 1000 }), entry('pair:p1-p3', { tablePoints: 100 })], 'p2'),
      hand('h2', [
        entry('p1', { tablePoints: 200 }),
        entry('p2', { tablePoints: 300 }),
        entry('p3', { closed: true, cleanBurracos: 1, tablePoints: 400 }),
      ]),
    ])
    const progress = replayGame(game)
    expect(progress.hands[1].phase).toBe(2)
    expect(progress.hands[1].valid).toBe(true)
    const points = Object.fromEntries(progress.standings.map((s) => [s.accountId, s.points]))
    expect(points.p2).toBe(1300)
  })

  it('non torna in fase 1 se i punteggi ridiscendono sotto 1000', () => {
    const game = baseGame(3, [
      hand('h1', [entry('p2', { tablePoints: 1000 }), entry('pair:p1-p3', { tablePoints: 0 })], 'p2'),
      hand('h2', [
        entry('p1', { tablePoints: 0 }),
        entry('p2', { tablePoints: 0, handPoints: 500 }),
        entry('p3', { tablePoints: 0 }),
      ]),
    ])
    expect(replayGame(game).nextPhase).toBe(2)
  })

  it('marca come da correggere una smazzata di fase 1 senza solista', () => {
    const game = baseGame(3, [hand('h1', [entry('p1'), entry('p2'), entry('p3')], null)])
    const progress = replayGame(game)
    expect(progress.hands[0].valid).toBe(false)
    expect(progress.hasIssues).toBe(true)
    expect(progress.standings.every((s) => s.points === 0)).toBe(true)
  })
})

describe('replayGame — fine partita', () => {
  it('dichiara finita la partita quando un conto supera l obiettivo', () => {
    const game = baseGame(2, [
      hand('h1', [entry('p1', { tablePoints: 2005 }), entry('p2', { tablePoints: 300 })]),
    ])
    const progress = replayGame(game)
    expect(progress.finished).toBe(true)
    expect(progress.winnerIds).toEqual(['p1'])
  })

  it('non dichiara finita la partita in caso di parità al vertice sopra l obiettivo', () => {
    const game = baseGame(2, [
      hand('h1', [entry('p1', { tablePoints: 2100 }), entry('p2', { tablePoints: 2100 })]),
    ])
    const progress = replayGame(game)
    expect(progress.finished).toBe(false)
    expect(progress.winnerIds).toEqual([])
  })

  it('assegna la vittoria al punteggio più alto quando più conti superano l obiettivo', () => {
    const game = baseGame(2, [
      hand('h1', [entry('p1', { tablePoints: 2100 }), entry('p2', { tablePoints: 2300 })]),
    ])
    expect(replayGame(game).winnerIds).toEqual(['p2'])
  })
})
