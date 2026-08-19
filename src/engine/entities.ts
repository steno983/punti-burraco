import type { Game, LedgerAccount, Phase, ScoringEntity } from './types'

function nameOf(game: Game, playerId: string): string {
  const player = game.players.find((p) => p.playerId === playerId)
  if (!player) throw new Error(`Giocatore ${playerId} non presente nella partita`)
  return player.name
}

function playerEntity(game: Game, playerId: string): ScoringEntity {
  return { id: playerId, kind: 'player', playerIds: [playerId], label: nameOf(game, playerId) }
}

/**
 * Entità di punteggio valide per una smazzata, dati modalità e fase.
 * A tre giocatori in fase 1 il solista va indicato esplicitamente.
 */
export function resolveEntities(
  game: Game,
  phase: Phase,
  soloPlayerId: string | null,
): ScoringEntity[] {
  if (game.mode === 4) {
    return game.teams.map((team) => ({
      id: team.id,
      kind: 'team' as const,
      playerIds: [...team.playerIds],
      label: team.name,
    }))
  }

  if (game.mode === 2 || phase === 2) {
    return game.players.map((p) => playerEntity(game, p.playerId))
  }

  if (!soloPlayerId) {
    throw new Error('Nella fase 1 della partita a tre va indicato il solista')
  }
  const others = game.players.filter((p) => p.playerId !== soloPlayerId)
  if (others.length !== 2) {
    throw new Error(`Solista ${soloPlayerId} non presente nella partita`)
  }
  return [
    playerEntity(game, soloPlayerId),
    {
      id: `pair:${others.map((p) => p.playerId).join('-')}`,
      kind: 'pair',
      playerIds: others.map((p) => p.playerId),
      label: `${others[0].name} e ${others[1].name}`,
    },
  ]
}

/** Conti su cui si accumulano i punti per tutta la partita. */
export function resolveLedgerAccounts(game: Game): LedgerAccount[] {
  if (game.mode === 4) {
    return game.teams.map((team) => ({
      id: team.id,
      kind: 'team' as const,
      playerIds: [...team.playerIds],
      label: team.name,
    }))
  }
  return game.players.map((p) => ({
    id: p.playerId,
    kind: 'player' as const,
    playerIds: [p.playerId],
    label: p.name,
  }))
}
