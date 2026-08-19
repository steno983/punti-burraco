import { PHASE_2_THRESHOLD } from './cards'
import { resolveEntities, resolveLedgerAccounts } from './entities'
import { scoreEntries, type EntryScore } from './scoring'
import { hasBlockingViolations, validateHandEntries } from './validation'
import type { Game, Phase, ScoringEntity } from './types'

/** Punteggio cumulativo di un conto (giocatore o squadra). */
export interface Standing {
  accountId: string
  label: string
  kind: 'player' | 'team'
  playerIds: string[]
  points: number
}

/** Esito del calcolo di una singola smazzata durante il replay. */
export interface HandResult {
  handId: string
  phase: Phase
  entities: ScoringEntity[]
  scores: EntryScore[]
  deltas: Record<string, number>
  valid: boolean
  issue: string | null
}

/** Stato completo della partita ricalcolato dalle smazzate. */
export interface GameProgress {
  hands: HandResult[]
  standings: Standing[]
  nextPhase: Phase
  finished: boolean
  winnerIds: string[]
  hasIssues: boolean
}

/**
 * Proietta i punteggi delle entità sui conti che accumulano punti.
 * Le entità coppia si dividono a metà arrotondando sempre verso l'alto.
 */
export function projectScores(
  scores: EntryScore[],
  entities: ScoringEntity[],
): Record<string, number> {
  const deltas: Record<string, number> = {}
  for (const score of scores) {
    const entity = entities.find((e) => e.id === score.entityId)
    if (!entity) continue
    if (entity.kind === 'pair') {
      const half = Math.ceil(score.total / 2)
      for (const playerId of entity.playerIds) {
        deltas[playerId] = (deltas[playerId] ?? 0) + half
      }
    } else {
      deltas[entity.id] = (deltas[entity.id] ?? 0) + score.total
    }
  }
  return deltas
}

/**
 * Ricalcola l'intera partita dalle smazzate: punteggi, fase corrente ed esito.
 * Le smazzate incoerenti non vengono conteggiate e restano marcate come da correggere.
 */
export function replayGame(game: Game): GameProgress {
  const accounts = resolveLedgerAccounts(game)
  const totals = new Map<string, number>(accounts.map((a) => [a.id, 0]))
  const results: HandResult[] = []
  let phase: Phase = 1

  for (const hand of game.hands) {
    const handPhase = phase
    let entities: ScoringEntity[]
    try {
      entities = resolveEntities(game, handPhase, hand.soloPlayerId)
    } catch (error) {
      results.push({
        handId: hand.id,
        phase: handPhase,
        entities: [],
        scores: [],
        deltas: {},
        valid: false,
        issue: error instanceof Error ? error.message : 'Smazzata non calcolabile',
      })
      continue
    }

    const violations = validateHandEntries(hand.entries, entities)
    if (hasBlockingViolations(violations)) {
      results.push({
        handId: hand.id,
        phase: handPhase,
        entities,
        scores: [],
        deltas: {},
        valid: false,
        issue: violations.find((v) => v.blocking)?.message ?? 'Smazzata non valida',
      })
      continue
    }

    const scores = scoreEntries(hand.entries, game.options)
    const deltas = projectScores(scores, entities)
    for (const [accountId, delta] of Object.entries(deltas)) {
      totals.set(accountId, (totals.get(accountId) ?? 0) + delta)
    }

    results.push({
      handId: hand.id,
      phase: handPhase,
      entities,
      scores,
      deltas,
      valid: true,
      issue: null,
    })

    if (game.mode === 3 && phase === 1) {
      const reached = accounts.some((a) => (totals.get(a.id) ?? 0) >= PHASE_2_THRESHOLD)
      if (reached) phase = 2
    }
  }

  const standings: Standing[] = accounts
    .map((account) => ({
      accountId: account.id,
      label: account.label,
      kind: account.kind,
      playerIds: account.playerIds,
      points: totals.get(account.id) ?? 0,
    }))
    .sort((a, b) => b.points - a.points)

  const atTarget = standings.filter((s) => s.points >= game.targetScore)
  const best = standings[0]
  const tiedAtTop = standings.filter((s) => s.points === best?.points)
  const finished = atTarget.length > 0 && tiedAtTop.length === 1
  const winnerIds = finished && best ? [best.accountId] : []

  return {
    hands: results,
    standings,
    nextPhase: phase,
    finished,
    winnerIds,
    hasIssues: results.some((r) => !r.valid),
  }
}
