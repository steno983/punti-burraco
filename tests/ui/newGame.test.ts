import { describe, it, expect, beforeEach } from 'vitest'
import { buildGameFromForm, newGameScreen, suggestionNames, validateNewGameForm } from '../../src/ui/screens/newGame'
import { saveState } from '../../src/storage/repository'
import type { EngineDeps } from '../../src/engine/game'

function deps(): EngineDeps {
  let counter = 0
  return { newId: () => `id${++counter}`, now: () => '2026-08-19T12:00:00.000Z' }
}

describe('validateNewGameForm', () => {
  it('accetta una configurazione valida a 3 giocatori', () => {
    expect(
      validateNewGameForm({ mode: 3, names: ['Ann', 'Bob', 'Cid'], teamSplit: [], semipulitoEnabled: true }),
    ).toEqual([])
  })

  it('rifiuta i nomi vuoti', () => {
    const errors = validateNewGameForm({
      mode: 2,
      names: ['Ann', '  '],
      teamSplit: [],
      semipulitoEnabled: true,
    })
    expect(errors[0]).toMatch(/nome/i)
  })

  it('rifiuta i nomi duplicati', () => {
    const errors = validateNewGameForm({
      mode: 2,
      names: ['Ann', 'ann'],
      teamSplit: [],
      semipulitoEnabled: true,
    })
    expect(errors[0]).toMatch(/diversi/i)
  })
})

describe('buildGameFromForm', () => {
  it('costruisce una partita a 4 giocatori con le squadre indicate', () => {
    const game = buildGameFromForm(
      {
        mode: 4,
        names: ['Ann', 'Bob', 'Cid', 'Dan'],
        teamSplit: [
          [0, 2],
          [1, 3],
        ],
        semipulitoEnabled: false,
      },
      deps(),
      ['pa', 'pb', 'pc', 'pd'],
    )
    expect(game.mode).toBe(4)
    expect(game.teams[0].playerIds).toEqual(['pa', 'pc'])
    expect(game.teams[1].playerIds).toEqual(['pb', 'pd'])
    expect(game.teams[0].name).toBe('Ann e Cid')
    expect(game.options.semipulitoEnabled).toBe(false)
  })

  it('costruisce una partita a 2 giocatori senza squadre', () => {
    const game = buildGameFromForm(
      { mode: 2, names: ['Ann', 'Bob'], teamSplit: [], semipulitoEnabled: true },
      deps(),
      ['pa', 'pb'],
    )
    expect(game.teams).toEqual([])
    expect(game.players.map((p) => p.name)).toEqual(['Ann', 'Bob'])
  })
})

describe('newGameScreen — anteprima delle squadre', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("aggiorna l'anteprima mentre si digita, senza ricreare i campi", () => {
    const container = newGameScreen({})
    document.body.replaceChildren(container)
    const inputs = Array.from(container.querySelectorAll('input'))
    inputs[0].focus()

    inputs[0].value = 'Ann'
    inputs[0].dispatchEvent(new Event('input'))

    expect(container.textContent).toContain('Ann e Giocatore 2')
    // Il campo non è stato ricreato: chi sta scrivendo non perde il fuoco.
    expect(container.querySelectorAll('input')[0]).toBe(inputs[0])
    expect(document.activeElement).toBe(inputs[0])

    inputs[1].value = 'Bob'
    inputs[1].dispatchEvent(new Event('input'))
    expect(container.textContent).toContain('Ann e Bob')
  })

  it('segue anche il cambio di accoppiamento', () => {
    const container = newGameScreen({})
    const inputs = Array.from(container.querySelectorAll('input'))
    for (const [i, name] of ['Ann', 'Bob', 'Cid', 'Dan'].entries()) {
      inputs[i].value = name
      inputs[i].dispatchEvent(new Event('input'))
    }
    expect(container.textContent).toContain('Ann e Bob')

    const rotate = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Cambia accoppiamento',
    )!
    rotate.click()

    expect(container.textContent).toContain('Ann e Cid')
  })
})

describe('newGameScreen — suggerimenti dalla rubrica', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('propone i nomi già usati e lascia scrivere un nome nuovo', () => {
    saveState({
      schemaVersion: 1,
      players: [
        { id: 'p1', name: 'Bob', createdAt: '2026-08-19T10:00:00.000Z' },
        { id: 'p2', name: 'Ann', createdAt: '2026-08-19T10:00:00.000Z' },
      ],
      games: [],
    })

    const container = newGameScreen({})
    const datalist = container.querySelector('datalist')!
    expect(Array.from(datalist.querySelectorAll('option')).map((o) => o.value)).toEqual(['Ann', 'Bob'])

    for (const input of Array.from(container.querySelectorAll('input'))) {
      expect(input.getAttribute('list')).toBe(datalist.id)
      // Resta un campo di testo libero: si può digitare un nome mai usato.
      expect(input.type).toBe('text')
    }
  })

  it('senza rubrica non propone nulla', () => {
    const container = newGameScreen({})
    expect(container.querySelector('datalist')!.querySelectorAll('option')).toHaveLength(0)
  })
})

describe('suggestionNames', () => {
  it('ordina i nomi come farebbe una rubrica italiana, accenti e maiuscole comprese', () => {
    expect(suggestionNames([{ name: 'elena' }, { name: 'Èlia' }, { name: 'Ada' }])).toEqual([
      'Ada',
      'elena',
      'Èlia',
    ])
  })
})
