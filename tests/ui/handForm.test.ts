import { describe, it, expect, beforeEach } from 'vitest'
import { DISCARDED_ENTRIES_MESSAGE, emptyEntry, handFormScreen } from '../../src/ui/screens/handForm'
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

function findStepperRow(scope: ParentNode, label: string): HTMLElement {
  const row = Array.from(scope.querySelectorAll('.row')).find((r) => r.textContent?.startsWith(label))
  if (!row) throw new Error(`Stepper "${label}" non trovato`)
  return row as HTMLElement
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
    const cleanBurracosRow = findStepperRow(annPanel, 'Burrachi puliti')
    saveButton = findButton(container, 'Salva smazzata')

    findButton(cleanBurracosRow, '+').click()

    expect(saveButton.disabled).toBe(false)
    expect(container.textContent).not.toMatch(/non può chiudere senza almeno un burraco/)
  })

  // Regressione: prima della correzione, il gestore del clic sul solista azzerava
  // sempre `entries`, quindi riselezionare lo stesso solista già attivo (il selettore
  // resta visibile insieme ai pannelli per tutta la fase 1) perdeva i dati inseriti.
  it('riselezionare lo stesso solista non perde i dati inseriti', () => {
    const game = createGame(
      {
        mode: 3,
        players: [
          { playerId: 'p1', name: 'Ann' },
          { playerId: 'p2', name: 'Bob' },
          { playerId: 'p3', name: 'Cid' },
        ],
        options: { semipulitoEnabled: true },
      },
      deps(),
    )
    upsertGame(game)

    const container = handFormScreen({ gameId: game.id })

    findButton(container, 'Ann').click()
    findButton(findStepperRow(findPanel(container, 'Ann'), 'Burrachi puliti'), '+').click()
    expect(findStepperRow(findPanel(container, 'Ann'), 'Burrachi puliti').textContent).toContain('1')

    findButton(container, 'Ann').click()

    expect(findStepperRow(findPanel(container, 'Ann'), 'Burrachi puliti').textContent).toContain('1')
  })

  it('cambiare solista ricostruisce le entità senza errori', () => {
    const game = createGame(
      {
        mode: 3,
        players: [
          { playerId: 'p1', name: 'Ann' },
          { playerId: 'p2', name: 'Bob' },
          { playerId: 'p3', name: 'Cid' },
        ],
        options: { semipulitoEnabled: true },
      },
      deps(),
    )
    upsertGame(game)

    const container = handFormScreen({ gameId: game.id })

    findButton(container, 'Ann').click()
    findButton(findStepperRow(findPanel(container, 'Ann'), 'Burrachi puliti'), '+').click()

    expect(() => findButton(container, 'Bob').click()).not.toThrow()

    expect(findPanel(container, 'Bob')).toBeTruthy()
    expect(container.querySelectorAll('.card').length).toBeGreaterThan(0)
    // Bob solista: la coppia è Ann e Cid, con una dichiarazione azzerata (entità nuova).
    expect(findPanel(container, 'Ann e Cid')).toBeTruthy()
    expect(findStepperRow(findPanel(container, 'Ann e Cid'), 'Burrachi puliti').textContent).toContain('0')
  })

  // Correggere una smazzata passata può spostare il confine di fase: una smazzata
  // registrata in fase 2 si ritrova in fase 1, dove le entità sono solista e coppia.
  // Le dichiarazioni che non corrispondono più vengono azzerate, e va detto.
  it('avvisa quando le dichiarazioni non corrispondono più alle entità della fase', () => {
    const game = createGame(
      {
        mode: 3,
        players: [
          { playerId: 'p1', name: 'Ann' },
          { playerId: 'p2', name: 'Bob' },
          { playerId: 'p3', name: 'Cid' },
        ],
        options: { semipulitoEnabled: true },
      },
      deps(),
    )
    upsertGame({
      ...game,
      hands: [
        {
          id: 'h1',
          soloPlayerId: null,
          entries: [
            { ...emptyEntry('p1'), tablePoints: 120 },
            { ...emptyEntry('p2'), tablePoints: 80 },
            { ...emptyEntry('p3'), tablePoints: 60 },
          ],
          createdAt: '2026-08-19T12:00:00.000Z',
        },
      ],
    })

    const container = handFormScreen({ gameId: game.id, handId: 'h1' })
    expect(container.textContent).not.toContain(DISCARDED_ENTRIES_MESSAGE)

    findButton(container, 'Ann').click()

    const alert = Array.from(container.querySelectorAll('.alert')).find(
      (node) => node.textContent === DISCARDED_ENTRIES_MESSAGE,
    )
    // L'avviso è in pagina, non in una finestra del browser.
    expect(alert).toBeTruthy()
    expect(findPanel(container, 'Bob e Cid')).toBeTruthy()

    // Resta visibile anche dopo un'interazione che ridisegna la schermata.
    findButton(findPanel(container, 'Ann'), 'Ha chiuso').click()
    expect(container.textContent).toContain(DISCARDED_ENTRIES_MESSAGE)
  })

  it('non avvisa quando non si perde nulla', () => {
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
    expect(container.textContent).not.toContain(DISCARDED_ENTRIES_MESSAGE)
  })
})
