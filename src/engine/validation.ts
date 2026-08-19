import { MIN_BURRACO_TABLE_POINTS } from './cards'
import type { HandEntry, ScoringEntity } from './types'

export type ViolationCode =
  | 'MULTIPLE_CLOSERS'
  | 'CLOSER_WITHOUT_POT'
  | 'CLOSER_WITHOUT_BURRACO'
  | 'CLOSER_WITH_HAND_POINTS'
  | 'NEGATIVE_VALUE'
  | 'ENTITY_MISMATCH'
  | 'TABLE_POINTS_BELOW_BURRACOS'

/** Violazione rilevata su una smazzata. Se `blocking` è falsa è solo un avviso. */
export interface Violation {
  code: ViolationCode
  entityId: string | null
  message: string
  blocking: boolean
}

function totalBurracos(entry: HandEntry): number {
  return entry.cleanBurracos + entry.semiCleanBurracos + entry.dirtyBurracos
}

function labelOf(entities: ScoringEntity[], entityId: string): string {
  return entities.find((e) => e.id === entityId)?.label ?? entityId
}

/**
 * Verifica i constraint di chiusura e la coerenza dei valori inseriti.
 * Non conosce modalità né fase: riceve le entità già risolte.
 */
export function validateHandEntries(
  entries: HandEntry[],
  entities: ScoringEntity[],
): Violation[] {
  const violations: Violation[] = []

  const expectedIds = entities.map((e) => e.id).sort()
  const actualIds = entries.map((e) => e.entityId).sort()
  if (expectedIds.length !== actualIds.length || expectedIds.some((id, i) => id !== actualIds[i])) {
    violations.push({
      code: 'ENTITY_MISMATCH',
      entityId: null,
      message: 'La smazzata non corrisponde ai giocatori previsti per questa fase della partita.',
      blocking: true,
    })
    return violations
  }

  const closers = entries.filter((e) => e.closed)
  if (closers.length > 1) {
    violations.push({
      code: 'MULTIPLE_CLOSERS',
      entityId: null,
      message: 'In una smazzata può chiudere una sola parte.',
      blocking: true,
    })
  }

  for (const entry of entries) {
    const label = labelOf(entities, entry.entityId)

    const negativeValues =
      entry.tablePoints < 0 ||
      entry.handPoints < 0 ||
      entry.cleanBurracos < 0 ||
      entry.semiCleanBurracos < 0 ||
      entry.dirtyBurracos < 0
    if (negativeValues) {
      violations.push({
        code: 'NEGATIVE_VALUE',
        entityId: entry.entityId,
        message: `${label}: i valori inseriti non possono essere negativi.`,
        blocking: true,
      })
    }

    if (entry.closed) {
      if (!entry.tookPot) {
        violations.push({
          code: 'CLOSER_WITHOUT_POT',
          entityId: entry.entityId,
          message: `${label} non può chiudere senza aver preso il pozzetto.`,
          blocking: true,
        })
      }
      if (totalBurracos(entry) === 0) {
        violations.push({
          code: 'CLOSER_WITHOUT_BURRACO',
          entityId: entry.entityId,
          message: `${label} non può chiudere senza almeno un burraco.`,
          blocking: true,
        })
      }
      if (entry.handPoints !== 0) {
        violations.push({
          code: 'CLOSER_WITH_HAND_POINTS',
          entityId: entry.entityId,
          message: `${label} ha chiuso: non può avere punti in mano.`,
          blocking: true,
        })
      }
    }

    const burracos = totalBurracos(entry)
    if (burracos > 0 && entry.tablePoints < burracos * MIN_BURRACO_TABLE_POINTS) {
      violations.push({
        code: 'TABLE_POINTS_BELOW_BURRACOS',
        entityId: entry.entityId,
        message: `${label}: ${burracos} burrachi valgono almeno ${
          burracos * MIN_BURRACO_TABLE_POINTS
        } punti di carte. Controlla i punti in tavola.`,
        blocking: false,
      })
    }
  }

  return violations
}

/** Vero se almeno una violazione impedisce il salvataggio. */
export function hasBlockingViolations(violations: Violation[]): boolean {
  return violations.some((v) => v.blocking)
}
