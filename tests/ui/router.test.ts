import { describe, it, expect } from 'vitest'
import { matchRoute } from '../../src/ui/router'

describe('matchRoute', () => {
  it('riconosce una rotta statica', () => {
    expect(matchRoute('/storico', '/storico')).toEqual({})
    expect(matchRoute('/storico', '/giocatori')).toBeNull()
  })

  it('estrae i parametri di una rotta dinamica', () => {
    expect(matchRoute('/partita/:gameId', '/partita/abc')).toEqual({ gameId: 'abc' })
  })

  it('estrae più parametri', () => {
    expect(matchRoute('/partita/:gameId/smazzata/:handId', '/partita/abc/smazzata/h1')).toEqual({
      gameId: 'abc',
      handId: 'h1',
    })
  })

  // Un indirizzo malformato incollato a mano non deve lasciare la pagina bianca:
  // la rotta non corrisponde e il router ripiega sulla home.
  it('non corrisponde se un parametro non è decodificabile', () => {
    expect(matchRoute('/partita/:gameId', '/partita/%E0%A4%A')).toBeNull()
    expect(matchRoute('/partita/:gameId/smazzata/:handId', '/partita/abc/smazzata/%')).toBeNull()
  })

  it('non confonde rotte di lunghezza diversa', () => {
    expect(matchRoute('/partita/:gameId', '/partita/abc/smazzata')).toBeNull()
    expect(matchRoute('/partita/:gameId/smazzata', '/partita/abc')).toBeNull()
  })
})
