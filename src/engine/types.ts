/** Numero di giocatori della partita: determina regole, pozzetti ed entità di punteggio. */
export type GameMode = 2 | 3 | 4

/** Fase della partita a tre giocatori: 1 = uno contro due, 2 = tutti contro tutti. */
export type Phase = 1 | 2

/** Giocatore in rubrica, riusabile fra partite diverse. */
export interface Player {
  id: string
  name: string
  createdAt: string
}

/** Varianti attivabili alla creazione della partita. */
export interface GameOptions {
  semipulitoEnabled: boolean
}

/** Partecipante a una partita, con il nome congelato al momento della creazione. */
export interface GamePlayerRef {
  playerId: string
  name: string
  seat: number
}

/** Squadra fissa, presente solo nelle partite a quattro giocatori. */
export interface Team {
  id: string
  name: string
  playerIds: [string, string]
}

/** Dichiarazione di fine smazzata per una singola entità di punteggio. */
export interface HandEntry {
  entityId: string
  closed: boolean
  tookPot: boolean
  cleanBurracos: number
  semiCleanBurracos: number
  dirtyBurracos: number
  tablePoints: number
  handPoints: number
}

/** Una smazzata registrata. La fase non è persistita: viene sempre ricalcolata. */
export interface Hand {
  id: string
  soloPlayerId: string | null
  entries: HandEntry[]
  createdAt: string
}

/** Partita completa. I totali non sono persistiti: derivano dalle smazzate. */
export interface Game {
  id: string
  mode: GameMode
  options: GameOptions
  targetScore: number
  players: GamePlayerRef[]
  teams: Team[]
  hands: Hand[]
  status: 'in_progress' | 'completed'
  winnerIds: string[]
  createdAt: string
  updatedAt: string
}

/** Unità a cui si attribuisce il punteggio di una singola smazzata. */
export interface ScoringEntity {
  id: string
  kind: 'player' | 'pair' | 'team'
  playerIds: string[]
  label: string
}

/** Unità che tiene il punteggio cumulativo per tutta la partita. */
export interface LedgerAccount {
  id: string
  kind: 'player' | 'team'
  playerIds: string[]
  label: string
}
