import { BONUS } from './cards'
import type { GameOptions, HandEntry } from './types'

/** Punteggio di una entità in una smazzata, scomposto per voce. */
export interface EntryScore {
  entityId: string
  tablePoints: number
  burracoBonus: number
  closingBonus: number
  handPenalty: number
  potPenalty: number
  total: number
}

/**
 * Punteggio di una singola entità.
 * Se la variante semipulito è disattivata, i burrachi semipuliti valgono come sporchi.
 */
export function scoreEntry(entry: HandEntry, options: GameOptions): EntryScore {
  const semiCleanValue = options.semipulitoEnabled
    ? BONUS.burracoSemipulito
    : BONUS.burracoSporco

  const burracoBonus =
    entry.cleanBurracos * BONUS.burracoPulito +
    entry.semiCleanBurracos * semiCleanValue +
    entry.dirtyBurracos * BONUS.burracoSporco

  const closingBonus = entry.closed ? BONUS.chiusura : 0
  const handPenalty = -entry.handPoints
  const potPenalty = entry.tookPot ? 0 : BONUS.pozzettoNonPreso

  return {
    entityId: entry.entityId,
    tablePoints: entry.tablePoints,
    burracoBonus,
    closingBonus,
    handPenalty,
    potPenalty,
    total: entry.tablePoints + burracoBonus + closingBonus + handPenalty + potPenalty,
  }
}

/** Punteggio di tutte le entità di una smazzata, nell'ordine ricevuto. */
export function scoreEntries(entries: HandEntry[], options: GameOptions): EntryScore[] {
  return entries.map((entry) => scoreEntry(entry, options))
}
