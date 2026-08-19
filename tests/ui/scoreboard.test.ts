import { describe, it, expect } from 'vitest'
import { createScoreboard } from '../../src/ui/components/scoreboard'
import type { GameProgress } from '../../src/engine/standings'

function progress(points: number[], nextPhase: 1 | 2 = 1): GameProgress {
  return {
    hands: [],
    standings: points.map((p, i) => ({
      accountId: `a${i}`,
      label: `Conto ${i}`,
      kind: 'player' as const,
      playerIds: [`p${i}`],
      points: p,
    })),
    nextPhase,
    finished: false,
    winnerIds: [],
    hasIssues: false,
  }
}

describe('createScoreboard', () => {
  it('mostra i punteggi di tutti i conti', () => {
    const board = createScoreboard(progress([1200, 800]), 2005)
    const scores = [...board.querySelectorAll('[data-role="points"]')].map((n) => n.textContent)
    expect(scores).toEqual(['1200', '800'])
  })

  it('rappresenta l avanzamento in percentuale dell obiettivo', () => {
    const board = createScoreboard(progress([1002]), 2005)
    const bar = board.querySelector<HTMLElement>('.progress > span')
    expect(bar?.style.width).toBe('50%')
  })

  it('non supera il 100 per cento oltre l obiettivo', () => {
    const board = createScoreboard(progress([2400]), 2005)
    expect(board.querySelector<HTMLElement>('.progress > span')?.style.width).toBe('100%')
  })

  it('gestisce i punteggi negativi senza barre negative', () => {
    const board = createScoreboard(progress([-150]), 2005)
    expect(board.querySelector<HTMLElement>('.progress > span')?.style.width).toBe('0%')
  })
})
