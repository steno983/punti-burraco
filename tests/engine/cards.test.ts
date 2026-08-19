import { describe, it, expect } from 'vitest'
import { CARD_VALUES, BONUS, TARGET_SCORE, PHASE_2_THRESHOLD, MIN_BURRACO_TABLE_POINTS } from '../../src/engine/cards'

describe('costanti di punteggio', () => {
  it('assegna il valore corretto a ogni carta', () => {
    expect(CARD_VALUES.jolly).toBe(30)
    expect(CARD_VALUES.pinella).toBe(20)
    expect(CARD_VALUES.asso).toBe(15)
    expect(CARD_VALUES.figura).toBe(10)
    expect(CARD_VALUES.bassa).toBe(5)
  })

  it('assegna il valore corretto a bonus e malus', () => {
    expect(BONUS.burracoPulito).toBe(200)
    expect(BONUS.burracoSemipulito).toBe(150)
    expect(BONUS.burracoSporco).toBe(100)
    expect(BONUS.chiusura).toBe(100)
    expect(BONUS.pozzettoNonPreso).toBe(-100)
  })

  it('fissa obiettivo partita e soglia di cambio fase', () => {
    expect(TARGET_SCORE).toBe(2005)
    expect(PHASE_2_THRESHOLD).toBe(1000)
    expect(MIN_BURRACO_TABLE_POINTS).toBe(35)
  })
})
