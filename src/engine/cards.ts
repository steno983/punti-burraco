/** Valore in punti di ogni carta, sia in tavola sia in mano. */
export const CARD_VALUES = {
  jolly: 30,
  pinella: 20,
  asso: 15,
  figura: 10,
  bassa: 5,
} as const

/** Bonus e malus applicati al punteggio di una smazzata. */
export const BONUS = {
  burracoPulito: 200,
  burracoSemipulito: 150,
  burracoSporco: 100,
  chiusura: 100,
  pozzettoNonPreso: -100,
} as const

/** Punteggio che chiude la partita, uguale per tutte le modalità. */
export const TARGET_SCORE = 2005

/** Punteggio individuale oltre il quale la partita a tre passa al tutti contro tutti. */
export const PHASE_2_THRESHOLD = 1000

/** Punti di carte minimi che un burraco può valere (7 carte da 5). Usato per gli avvisi. */
export const MIN_BURRACO_TABLE_POINTS = 35
