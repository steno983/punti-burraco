import { replayGame } from './standings'
import type { Game } from './types'

/** Effetto di una singola smazzata sui punteggi, con eventuali eventi di partita. */
export interface HandSummary {
  handId: string
  index: number
  rows: { accountId: string; label: string; delta: number; total: number }[]
  phaseChanged: boolean
  finished: boolean
  winnerLabel: string | null
  /** Motivo per cui la smazzata non è stata conteggiata, nullo se è valida. */
  issue: string | null
}

export function summarizeHand(game: Game, handId: string): HandSummary | null {
  const index = game.hands.findIndex((h) => h.id === handId)
  if (index === -1) return null

  const progress = replayGame(game)
  const result = progress.hands[index]

  const upToHand = { ...game, hands: game.hands.slice(0, index + 1) }
  const totalsAfter = replayGame(upToHand).standings

  const rows = totalsAfter.map((standing) => ({
    accountId: standing.accountId,
    label: standing.label,
    delta: result.deltas[standing.accountId] ?? 0,
    total: standing.points,
  }))

  const phaseAfter =
    index + 1 < progress.hands.length ? progress.hands[index + 1].phase : progress.nextPhase
  const phaseChanged = game.mode === 3 && result.phase === 1 && phaseAfter === 2

  const winner = progress.standings.find((s) => progress.winnerIds.includes(s.accountId))

  return {
    handId,
    index,
    rows,
    phaseChanged,
    finished: progress.finished,
    winnerLabel: winner?.label ?? null,
    issue: result.issue,
  }
}
