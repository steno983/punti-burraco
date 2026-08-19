import { describe, it, expect } from 'vitest'
import { buildGameFromForm, validateNewGameForm } from '../../src/ui/screens/newGame'
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
