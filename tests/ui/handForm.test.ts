import { describe, it, expect, beforeEach } from 'vitest'
import { emptyEntry, handFormScreen } from '../../src/ui/screens/handForm'
import { createGame, type EngineDeps } from '../../src/engine/game'
import { upsertGame } from '../../src/storage/repository'

describe('emptyEntry', () => {
  it('crea una dichiarazione azzerata con il pozzetto preso', () => {
    expect(emptyEntry('p1')).toEqual({
      entityId: 'p1',
      closed: false,
      tookPot: true,
      cleanBurracos: 0,
      semiCleanBurracos: 0,
      dirtyBurracos: 0,
      tablePoints: 0,
      handPoints: 0,
    })
  })
})

function deps(): EngineDeps {
  let counter = 0
  return { newId: () => `id${++counter}`, now: () => '2026-08-19T12:00:00.000Z' }
}

function findButton(scope: ParentNode, text: string): HTMLButtonElement {
  const button = Array.from(scope.querySelectorAll('button')).find((b) => b.textContent === text)
  if (!button) throw new Error(`Pulsante "${text}" non trovato`)
  return button as HTMLButtonElement
}

function findPanel(scope: ParentNode, entityLabel: string): HTMLElement {
  const panel = Array.from(scope.querySelectorAll('.card')).find(
    (card) => card.querySelector('h2')?.textContent === entityLabel,
  )
  if (!panel) throw new Error(`Pannello di "${entityLabel}" non trovato`)
  return panel as HTMLElement
}

describe('handFormScreen', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // Regressione: prima della correzione, aggiungere un burraco dopo aver attivato "Ha
  // chiuso" non riabilitava il salvataggio, perché lo stepper aggiornava solo il totale
  // e non rivalutava le violazioni bloccanti né il pulsante.
  it('sblocca il salvataggio in tempo reale quando si risolve una violazione bloccante', () => {
    const game = createGame(
      {
        mode: 2,
        players: [
          { playerId: 'p1', name: 'Ann' },
          { playerId: 'p2', name: 'Bob' },
        ],
        options: { semipulitoEnabled: true },
      },
      deps(),
    )
    upsertGame(game)

    const container = handFormScreen({ gameId: game.id })

    findButton(findPanel(container, 'Ann'), 'Ha chiuso').click()

    let saveButton = findButton(container, 'Salva smazzata')
    expect(saveButton.disabled).toBe(true)
    expect(container.textContent).toMatch(/non può chiudere senza almeno un burraco/)

    // Il toggle "Ha chiuso" ridisegna l'intera schermata: i riferimenti precedenti sono superati.
    const annPanel = findPanel(container, 'Ann')
    const cleanBurracosRow = Array.from(annPanel.querySelectorAll('.row')).find((row) =>
      row.textContent?.startsWith('Burrachi puliti'),
    )
    if (!cleanBurracosRow) throw new Error('Stepper "Burrachi puliti" non trovato')
    saveButton = findButton(container, 'Salva smazzata')

    findButton(cleanBurracosRow, '+').click()

    expect(saveButton.disabled).toBe(false)
    expect(container.textContent).not.toMatch(/non può chiudere senza almeno un burraco/)
  })
})
