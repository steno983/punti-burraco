import type { Game, LedgerAccount, Phase, ScoringEntity } from './types'

/**
 * Messaggi rivolti all'utente: finiscono negli avvisi della schermata partita e
 * del riepilogo, quindi niente identificativi interni e sempre l'azione da fare.
 */
export const MISSING_PLAYER_MESSAGE =
  'Uno dei giocatori di questa smazzata non fa più parte della partita: apri la smazzata in modifica e reinserisci i punti.'

export const MISSING_SOLO_MESSAGE =
  'Questa smazzata ricade nella fase in cui uno gioca contro due, ma non risulta chi ha giocato da solo: può succedere quando la correzione di una smazzata precedente sposta il passaggio di fase. Apri la smazzata in modifica e indica di nuovo il solista.'

export const UNKNOWN_SOLO_MESSAGE =
  'Il giocatore indicato come solista non fa parte di questa partita: apri la smazzata in modifica e indica di nuovo chi ha giocato da solo.'

function nameOf(game: Game, playerId: string): string {
  const player = game.players.find((p) => p.playerId === playerId)
  if (!player) throw new Error(MISSING_PLAYER_MESSAGE)
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
    throw new Error(MISSING_SOLO_MESSAGE)
  }
  const others = game.players.filter((p) => p.playerId !== soloPlayerId)
  if (others.length !== 2) {
    throw new Error(UNKNOWN_SOLO_MESSAGE)
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
