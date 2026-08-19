import { describe, it, expect } from 'vitest'
import { computePlayerStats } from '../../src/engine/stats'
import type { Game, Hand, HandEntry } from '../../src/engine/types'

function entry(entityId: string, tablePoints: number): HandEntry {
  return {
    entityId,
    closed: false,
    tookPot: true,
    cleanBurracos: 0,
    semiCleanBurracos: 0,
    dirtyBurracos: 0,
    tablePoints,
    handPoints: 0,
  }
}

function completedTwoPlayerGame(id: string, p1Points: number, p2Points: number): Game {
  const hands: Hand[] = [
    {
      id: `${id}-h1`,
      soloPlayerId: null,
      entries: [entry('p1', p1Points), entry('p2', p2Points)],
      createdAt: '2026-08-19T11:00:00.000Z',
    },
  ]
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
    hands,
    status: p1Points >= 2005 || p2Points >= 2005 ? 'completed' : 'in_progress',
    winnerIds: p1Points >= 2005 ? ['p1'] : p2Points >= 2005 ? ['p2'] : [],
    createdAt: '2026-08-19T10:00:00.000Z',
    updatedAt: '2026-08-19T12:00:00.000Z',
  }
}

describe('computePlayerStats', () => {
  it('conta partite giocate, vinte e percentuale di vittoria', () => {
    const stats = computePlayerStats([
      completedTwoPlayerGame('g1', 2100, 800),
      completedTwoPlayerGame('g2', 900, 2200),
      completedTwoPlayerGame('g3', 2300, 700),
    ])
    const ann = stats.find((s) => s.playerId === 'p1')!
    expect(ann.gamesPlayed).toBe(3)
    expect(ann.gamesWon).toBe(2)
    expect(ann.winRate).toBeCloseTo(2 / 3)
  })

  it('ignora le partite ancora in corso', () => {
    const stats = computePlayerStats([completedTwoPlayerGame('g1', 300, 200)])
    expect(stats).toEqual([])
  })

  it('calcola media e miglior smazzata', () => {
    const game = completedTwoPlayerGame('g1', 2100, 800)
    game.hands.push({
      id: 'g1-h2',
      soloPlayerId: null,
      entries: [entry('p1', 300), entry('p2', 100)],
      createdAt: '2026-08-19T11:30:00.000Z',
    })
    const stats = computePlayerStats([game])
    const ann = stats.find((s) => s.playerId === 'p1')!
    expect(ann.handsPlayed).toBe(2)
    expect(ann.bestHandPoints).toBe(2100)
    expect(ann.averageHandPoints).toBe(1200)
  })

  it('ordina per vittorie decrescenti', () => {
    const stats = computePlayerStats([
      completedTwoPlayerGame('g1', 2100, 800),
      completedTwoPlayerGame('g2', 2100, 800),
    ])
    expect(stats[0].playerId).toBe('p1')
  })
})
