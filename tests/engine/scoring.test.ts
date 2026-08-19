import { describe, it, expect } from 'vitest'
import { scoreEntry, scoreEntries } from '../../src/engine/scoring'
import type { GameOptions, HandEntry } from '../../src/engine/types'

const options: GameOptions = { semipulitoEnabled: true }

function entry(overrides: Partial<HandEntry> = {}): HandEntry {
  return {
    entityId: 'p1',
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

describe('scoreEntry', () => {
  it('somma i punti in tavola senza altre voci', () => {
    const score = scoreEntry(entry({ tablePoints: 240 }), options)
    expect(score.total).toBe(240)
    expect(score.burracoBonus).toBe(0)
    expect(score.closingBonus).toBe(0)
  })

  it('somma i bonus dei tre tipi di burraco', () => {
    const score = scoreEntry(
      entry({ cleanBurracos: 2, semiCleanBurracos: 1, dirtyBurracos: 3, tablePoints: 500 }),
      options,
    )
    expect(score.burracoBonus).toBe(2 * 200 + 150 + 3 * 100)
    expect(score.total).toBe(500 + 850)
  })

  it('conta i semipuliti come sporchi quando la variante è disattivata', () => {
    const score = scoreEntry(entry({ semiCleanBurracos: 2 }), { semipulitoEnabled: false })
    expect(score.burracoBonus).toBe(200)
  })

  it('aggiunge il bonus di chiusura a chi chiude', () => {
    const score = scoreEntry(entry({ closed: true, tablePoints: 300, cleanBurracos: 1 }), options)
    expect(score.closingBonus).toBe(100)
    expect(score.total).toBe(300 + 200 + 100)
  })

  it('sottrae i punti delle carte rimaste in mano', () => {
    const score = scoreEntry(entry({ tablePoints: 180, handPoints: 65 }), options)
    expect(score.handPenalty).toBe(-65)
    expect(score.total).toBe(115)
  })

  it('applica il malus di 100 a chi non ha preso il pozzetto', () => {
    const score = scoreEntry(entry({ tookPot: false, tablePoints: 80 }), options)
    expect(score.potPenalty).toBe(-100)
    expect(score.total).toBe(-20)
  })

  it('produce un totale negativo quando le penalità superano i punti', () => {
    const score = scoreEntry(entry({ tookPot: false, tablePoints: 30, handPoints: 90 }), options)
    expect(score.total).toBe(-160)
  })

  it('calcola una smazzata completa di esempio', () => {
    // 420 in tavola, un burraco pulito e uno sporco, chiude, pozzetto preso
    const score = scoreEntry(
      entry({ closed: true, tablePoints: 420, cleanBurracos: 1, dirtyBurracos: 1 }),
      options,
    )
    expect(score.total).toBe(420 + 200 + 100 + 100)
  })
})

describe('scoreEntries', () => {
  it('calcola il punteggio di tutte le entità mantenendo l ordine', () => {
    const scores = scoreEntries(
      [entry({ entityId: 'a', tablePoints: 100 }), entry({ entityId: 'b', tablePoints: 50 })],
      options,
    )
    expect(scores.map((s) => s.entityId)).toEqual(['a', 'b'])
    expect(scores.map((s) => s.total)).toEqual([100, 50])
  })
})
