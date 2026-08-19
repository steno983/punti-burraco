import { TARGET_SCORE } from './cards'
import { replayGame } from './standings'
import type { Game, GameMode, GameOptions, Hand, HandEntry, Team } from './types'

/** Dipendenze impure iniettate, così il motore resta deterministico nei test. */
export interface EngineDeps {
  newId: () => string
  now: () => string
}

export interface NewGameInput {
  mode: GameMode
  players: { playerId: string; name: string }[]
  teams?: { name: string; playerIds: [string, string] }[]
  options: GameOptions
}

export interface HandInput {
  soloPlayerId: string | null
  entries: HandEntry[]
}

/** Aggiorna stato ed esito rigiocando la partita dalle sue smazzate. */
function withRecomputedStatus(game: Game, deps: EngineDeps): Game {
  const progress = replayGame(game)
  return {
    ...game,
    status: progress.finished ? 'completed' : 'in_progress',
    winnerIds: progress.winnerIds,
    updatedAt: deps.now(),
  }
}

export function createGame(input: NewGameInput, deps: EngineDeps): Game {
  if (input.players.length !== input.mode) {
    throw new Error(`Una partita a ${input.mode} richiede esattamente ${input.mode} giocatori`)
  }

  let teams: Team[] = []
  if (input.mode === 4) {
    if (!input.teams || input.teams.length !== 2) {
      throw new Error('Una partita a quattro richiede due squadre')
    }
    teams = input.teams.map((team) => ({
      id: deps.newId(),
      name: team.name,
      playerIds: [...team.playerIds] as [string, string],
    }))
  }

  const timestamp = deps.now()
  return {
    id: deps.newId(),
    mode: input.mode,
    options: { ...input.options },
    targetScore: TARGET_SCORE,
    players: input.players.map((p, seat) => ({ playerId: p.playerId, name: p.name, seat })),
    teams,
    hands: [],
    status: 'in_progress',
    winnerIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function addHand(game: Game, input: HandInput, deps: EngineDeps): Game {
  const hand: Hand = {
    id: deps.newId(),
    soloPlayerId: input.soloPlayerId,
    entries: input.entries.map((e) => ({ ...e })),
    createdAt: deps.now(),
  }
  return withRecomputedStatus({ ...game, hands: [...game.hands, hand] }, deps)
}

export function updateHand(
  game: Game,
  handId: string,
  input: HandInput,
  deps: EngineDeps,
): Game {
  const index = game.hands.findIndex((h) => h.id === handId)
  if (index === -1) throw new Error(`Smazzata ${handId} non trovata`)

  const hands = game.hands.map((hand, i) =>
    i === index
      ? { ...hand, soloPlayerId: input.soloPlayerId, entries: input.entries.map((e) => ({ ...e })) }
      : hand,
  )
  return withRecomputedStatus({ ...game, hands }, deps)
}

export function deleteHand(game: Game, handId: string, deps: EngineDeps): Game {
  const hands = game.hands.filter((h) => h.id !== handId)
  if (hands.length === game.hands.length) throw new Error(`Smazzata ${handId} non trovata`)
  return withRecomputedStatus({ ...game, hands }, deps)
}
