import { describe, it, expect, beforeEach } from 'vitest'
import { historyScreen } from '../../src/ui/screens/history'
import { TARGET_SCORE } from '../../src/engine/cards'
import { loadState, upsertGame } from '../../src/storage/repository'
import type { Game } from '../../src/engine/types'

beforeEach(() => {
  localStorage.clear()
})

/** Partita a due conclusa, senza smazzate: basta per esercitare l'elenco e l'eliminazione. */
function completedGame(id: string, playerA: string, playerB: string, winnerPlayerId: string): Game {
  return {
    id,
    mode: 2,
    options: { semipulitoEnabled: true },
    targetScore: TARGET_SCORE,
    players: [
      { playerId: `${id}-p1`, name: playerA, seat: 0 },
      { playerId: `${id}-p2`, name: playerB, seat: 1 },
    ],
    teams: [],
    hands: [],
    status: 'completed',
    winnerIds: [winnerPlayerId],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  }
}

function findButton(scope: ParentNode, text: string): HTMLButtonElement {
  const button = Array.from(scope.querySelectorAll('button')).find((b) => b.textContent === text)
  if (!button) throw new Error(`Pulsante "${text}" non trovato`)
  return button as HTMLButtonElement
}

function queryButton(scope: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(scope.querySelectorAll('button')).find((b) => b.textContent === text) as
    | HTMLButtonElement
    | undefined
}

function findCard(scope: ParentNode, text: string): HTMLElement {
  const card = Array.from(scope.querySelectorAll('.card')).find((c) => c.textContent?.includes(text))
  if (!card) throw new Error(`Card contenente "${text}" non trovata`)
  return card as HTMLElement
}

describe('historyScreen', () => {
  it('elimina una partita solo dopo la conferma, non al primo tocco', () => {
    const game = completedGame('g1', 'Ann', 'Bob', 'g1-p1')
    upsertGame(game)

    const container = historyScreen({})

    findButton(container, 'Elimina').click()

    // Primo tocco: la partita non è ancora stata rimossa e compare la conferma.
    expect(loadState().games.some((g) => g.id === 'g1')).toBe(true)
    expect(findButton(container, 'Elimina davvero')).toBeTruthy()
    expect(queryButton(container, 'Elimina')).toBeUndefined()

    // "Annulla" riporta allo stato iniziale senza eliminare nulla.
    findButton(container, 'Annulla').click()
    expect(loadState().games.some((g) => g.id === 'g1')).toBe(true)
    expect(queryButton(container, 'Elimina davvero')).toBeUndefined()
    expect(findButton(container, 'Elimina')).toBeTruthy()

    // Solo il secondo tocco, sulla conferma, elimina davvero la partita.
    findButton(container, 'Elimina').click()
    findButton(container, 'Elimina davvero').click()
    expect(loadState().games.some((g) => g.id === 'g1')).toBe(false)
  })

  it('con più partite in elenco elimina esattamente quella confermata', () => {
    upsertGame(completedGame('g1', 'Ann', 'Bob', 'g1-p1'))
    upsertGame(completedGame('g2', 'Cid', 'Dan', 'g2-p1'))

    const container = historyScreen({})

    findButton(findCard(container, 'Ann'), 'Elimina').click()
    // Dopo il redraw il riferimento alla card precedente è superato: va ricercata.
    findButton(findCard(container, 'Ann'), 'Elimina davvero').click()

    const remaining = loadState().games
    expect(remaining.some((g) => g.id === 'g1')).toBe(false)
    expect(remaining.some((g) => g.id === 'g2')).toBe(true)
    expect(findCard(container, 'Cid')).toBeTruthy()
  })
})
