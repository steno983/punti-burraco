import { describe, it, expect } from 'vitest'
import { validateHandEntries, hasBlockingViolations } from '../../src/engine/validation'
import type { HandEntry, ScoringEntity } from '../../src/engine/types'

const entities: ScoringEntity[] = [
  { id: 'a', kind: 'player', playerIds: ['a'], label: 'Ann' },
  { id: 'b', kind: 'player', playerIds: ['b'], label: 'Bob' },
]

function entry(entityId: string, overrides: Partial<HandEntry> = {}): HandEntry {
  return {
    entityId,
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

/** Chiusura regolare: pozzetto preso, un burraco, zero carte in mano. */
function validCloser(entityId: string): HandEntry {
  return entry(entityId, { closed: true, tookPot: true, cleanBurracos: 1, tablePoints: 300 })
}

describe('validateHandEntries', () => {
  it('accetta una smazzata con una chiusura regolare', () => {
    const violations = validateHandEntries([validCloser('a'), entry('b', { handPoints: 40 })], entities)
    expect(violations).toEqual([])
  })

  it('accetta una smazzata senza chiusura (tallone esaurito)', () => {
    const violations = validateHandEntries(
      [entry('a', { tablePoints: 120, handPoints: 30 }), entry('b', { tablePoints: 90, handPoints: 55 })],
      entities,
    )
    expect(violations).toEqual([])
  })

  it('rifiuta due chiusure nella stessa smazzata', () => {
    const violations = validateHandEntries([validCloser('a'), validCloser('b')], entities)
    expect(violations.map((v) => v.code)).toContain('MULTIPLE_CLOSERS')
    expect(hasBlockingViolations(violations)).toBe(true)
  })

  it('rifiuta la chiusura di chi non ha preso il pozzetto', () => {
    const violations = validateHandEntries(
      [entry('a', { closed: true, tookPot: false, cleanBurracos: 1, tablePoints: 300 }), entry('b')],
      entities,
    )
    const violation = violations.find((v) => v.code === 'CLOSER_WITHOUT_POT')
    expect(violation).toBeDefined()
    expect(violation?.entityId).toBe('a')
    expect(violation?.blocking).toBe(true)
    expect(violation?.message).toMatch(/pozzetto/i)
  })

  it('rifiuta la chiusura senza alcun burraco', () => {
    const violations = validateHandEntries(
      [entry('a', { closed: true, tookPot: true, tablePoints: 300 }), entry('b')],
      entities,
    )
    expect(violations.map((v) => v.code)).toContain('CLOSER_WITHOUT_BURRACO')
  })

  it('accetta la chiusura con un burraco sporco o semipulito', () => {
    const conDirty = validateHandEntries(
      [entry('a', { closed: true, tookPot: true, dirtyBurracos: 1, tablePoints: 300 }), entry('b')],
      entities,
    )
    expect(conDirty).toEqual([])

    const conSemi = validateHandEntries(
      [entry('a', { closed: true, tookPot: true, semiCleanBurracos: 1, tablePoints: 300 }), entry('b')],
      entities,
    )
    expect(conSemi).toEqual([])
  })

  it('rifiuta la chiusura con punti ancora in mano', () => {
    const violations = validateHandEntries(
      [entry('a', { closed: true, tookPot: true, cleanBurracos: 1, tablePoints: 300, handPoints: 15 }), entry('b')],
      entities,
    )
    const violation = violations.find((v) => v.code === 'CLOSER_WITH_HAND_POINTS')
    expect(violation?.blocking).toBe(true)
    expect(violation?.message).toMatch(/in mano/i)
  })

  it('rifiuta valori negativi', () => {
    const violations = validateHandEntries([entry('a', { tablePoints: -10 }), entry('b')], entities)
    expect(violations.map((v) => v.code)).toContain('NEGATIVE_VALUE')
  })

  it('rifiuta un elenco di entità che non corrisponde alla smazzata', () => {
    const violations = validateHandEntries([entry('a'), entry('z')], entities)
    expect(violations.map((v) => v.code)).toContain('ENTITY_MISMATCH')
  })

  it('avvisa senza bloccare se i punti in tavola non bastano per i burrachi dichiarati', () => {
    const violations = validateHandEntries(
      [entry('a', { cleanBurracos: 2, tablePoints: 50 }), entry('b')],
      entities,
    )
    const violation = violations.find((v) => v.code === 'TABLE_POINTS_BELOW_BURRACOS')
    expect(violation).toBeDefined()
    expect(violation?.blocking).toBe(false)
    expect(hasBlockingViolations(violations)).toBe(false)
  })
})
