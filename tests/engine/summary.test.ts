import { describe, it, expect } from 'vitest'
import { summarizeHand } from '../../src/engine/summary'
import type { Game, Hand, HandEntry } from '../../src/engine/types'

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

function game(mode: 2 | 3, hands: Hand[], status: 'in_progress' | 'completed' = 'in_progress'): Game {
  const names = ['Ann', 'Bob', 'Cid'].slice(0, mode)
  return {
    id: 'g1',
    mode,
    options: { semipulitoEnabled: true },
    targetScore: 2005,
    players: names.map((name, i) => ({ playerId: `p${i + 1}`, name, seat: i })),
    teams: [],
    hands,
    status,
    winnerIds: [],
    createdAt: '2026-08-19T10:00:00.000Z',
    updatedAt: '2026-08-19T12:00:00.000Z',
  }
}

describe('summarizeHand', () => {
  it('restituisce null se la smazzata non esiste', () => {
    expect(summarizeHand(game(2, []), 'assente')).toBeNull()
  })

  it('riporta il delta della smazzata e il totale raggiunto', () => {
    const g = game(2, [
      hand('h1', [entry('p1', { tablePoints: 300 }), entry('p2', { tablePoints: 100 })]),
      hand('h2', [entry('p1', { tablePoints: 200 }), entry('p2', { tablePoints: 150 })]),
    ])
    const summary = summarizeHand(g, 'h2')!
    expect(summary.index).toBe(1)
    const ann = summary.rows.find((r) => r.accountId === 'p1')!
    expect(ann.delta).toBe(200)
    expect(ann.total).toBe(500)
  })

  it('segnala il passaggio alla fase 2 nella smazzata che lo provoca', () => {
    const g = game(3, [
      hand('h1', [entry('p2', { tablePoints: 400 }), entry('pair:p1-p3', { tablePoints: 100 })], 'p2'),
      hand('h2', [entry('p2', { tablePoints: 700 }), entry('pair:p1-p3', { tablePoints: 100 })], 'p2'),
    ])
    expect(summarizeHand(g, 'h1')!.phaseChanged).toBe(false)
    expect(summarizeHand(g, 'h2')!.phaseChanged).toBe(true)
  })

  it('riporta la vittoria quando la partita è conclusa', () => {
    const g = game(2, [hand('h1', [entry('p1', { tablePoints: 2100 }), entry('p2', { tablePoints: 100 })])])
    const summary = summarizeHand(g, 'h1')!
    expect(summary.finished).toBe(true)
    expect(summary.winnerLabel).toBe('Ann')
  })

  it('segnala il motivo quando la smazzata non è stata conteggiata', () => {
    const g = game(2, [hand('h1', [entry('p1', { closed: true }), entry('p2', { closed: true })])])
    const summary = summarizeHand(g, 'h1')!
    expect(summary.issue).toBe('In una smazzata può chiudere una sola parte.')
    const ann = summary.rows.find((r) => r.accountId === 'p1')!
    expect(ann.delta).toBe(0)
  })
})
