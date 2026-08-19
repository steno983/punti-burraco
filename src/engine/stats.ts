import { replayGame } from './standings'
import type { Game } from './types'

/** Statistiche aggregate di un giocatore su tutte le partite concluse. */
export interface PlayerStats {
  playerId: string
  name: string
  gamesPlayed: number
  gamesWon: number
  winRate: number
  handsPlayed: number
  averageHandPoints: number
  bestHandPoints: number
}

interface Accumulator {
  playerId: string
  name: string
  gamesPlayed: number
  gamesWon: number
  handPoints: number[]
}

export function computePlayerStats(games: Game[]): PlayerStats[] {
  const byPlayer = new Map<string, Accumulator>()

  for (const game of games) {
    if (game.status !== 'completed') continue
    const progress = replayGame(game)

    for (const player of game.players) {
      const acc = byPlayer.get(player.playerId) ?? {
        playerId: player.playerId,
        name: player.name,
        gamesPlayed: 0,
        gamesWon: 0,
        handPoints: [],
      }
      acc.name = player.name
      acc.gamesPlayed += 1

      const account = progress.standings.find((s) => s.playerIds.includes(player.playerId))
      if (account && game.winnerIds.includes(account.accountId)) acc.gamesWon += 1

      for (const result of progress.hands) {
        if (!result.valid) continue
        const accountId = account?.accountId
        if (!accountId) continue
        const delta = result.deltas[accountId]
        if (delta !== undefined) acc.handPoints.push(delta)
      }

      byPlayer.set(player.playerId, acc)
    }
  }

  return [...byPlayer.values()]
    .map((acc) => ({
      playerId: acc.playerId,
      name: acc.name,
      gamesPlayed: acc.gamesPlayed,
      gamesWon: acc.gamesWon,
      winRate: acc.gamesPlayed === 0 ? 0 : acc.gamesWon / acc.gamesPlayed,
      handsPlayed: acc.handPoints.length,
      averageHandPoints:
        acc.handPoints.length === 0
          ? 0
          : Math.round(acc.handPoints.reduce((sum, p) => sum + p, 0) / acc.handPoints.length),
      bestHandPoints: acc.handPoints.length === 0 ? 0 : Math.max(...acc.handPoints),
    }))
    .sort((a, b) => b.gamesWon - a.gamesWon || a.name.localeCompare(b.name, 'it'))
}
