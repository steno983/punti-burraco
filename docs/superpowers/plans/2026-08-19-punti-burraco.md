# Punti Burraco — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Webapp mobile-first per il punteggio di partite di burraco a 2, 3 o 4 giocatori, con persistenza locale, storico e pubblicazione su GitHub Pages come PWA.

**Architecture:** Motore di punteggio in TypeScript puro (nessuna dipendenza da DOM o storage) coperto da test Vitest, sopra il quale sta un layer di persistenza su localStorage e una UI senza framework costruita con moduli che renderizzano dentro un contenitore. La UI non contiene regole di gioco: chiama il motore e mostra il risultato.

**Tech Stack:** Vite 6, TypeScript 5 (strict), Vitest + jsdom, nessuna dipendenza runtime, deploy via GitHub Actions su GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-19-punti-burraco-design.md`

## Global Constraints

- Lingua dell'interfaccia e dei messaggi di errore: **italiano**, con accenti corretti (`è`, `à`, `più`, `perché`).
- Obiettivo partita fisso: **2005** punti. Soglia cambio fase a 3 giocatori: **1000** punti.
- Valori carte: jolly 30, pinella 20, asso 15, figure/10/9/8 10, 7-3 5.
- Bonus: burraco pulito 200, semipulito 150 (opzionale), sporco 100, chiusura 100, pozzetto non preso −100.
- `src/engine/**` non deve importare nulla da `src/ui/**` né da `src/storage/**`, e non deve usare `window`, `document` o `localStorage`.
- `src/ui/**` non deve accedere a `localStorage` direttamente: solo tramite `src/storage/repository.ts`.
- TypeScript in modalità `strict`. Nessun `any` implicito o esplicito nel codice di produzione.
- Arrotondamento della metà punti coppia: sempre verso l'alto (`Math.ceil`), anche sui negativi.
- Nessuna dipendenza runtime aggiuntiva: niente framework, niente librerie di UI, niente librerie di date.
- Base path Vite: `/puntiBurraco/`.
- Ogni task termina con un commit; i test devono essere verdi prima del commit.

## File Structure

| File | Responsabilità |
|---|---|
| `src/engine/types.ts` | Tipi condivisi del dominio: partita, smazzata, giocatore, entità di punteggio |
| `src/engine/cards.ts` | Costanti: valori carte, bonus, soglie |
| `src/engine/entities.ts` | Derivazione delle entità di punteggio da modalità e fase |
| `src/engine/scoring.ts` | Calcolo del punteggio di una smazzata per entità |
| `src/engine/validation.ts` | Constraint di chiusura e coerenza dell'input |
| `src/engine/standings.ts` | Punteggi cumulativi, proiezione entità → conto punti, fase, fine partita |
| `src/engine/game.ts` | Creazione partita e mutazioni immutabili (aggiunta/modifica/eliminazione smazzata) |
| `src/engine/stats.ts` | Statistiche aggregate per giocatore |
| `src/storage/repository.ts` | Persistenza su localStorage, versione schema, lettura difensiva |
| `src/ui/router.ts` | Routing via hash, montaggio/smontaggio schermate |
| `src/ui/dom.ts` | Helper minimi di creazione elementi |
| `src/ui/components/numpad.ts` | Tastierino numerico |
| `src/ui/components/stepper.ts` | Contatore +/− per i burrachi |
| `src/ui/components/toggle.ts` | Interruttore per chiusura e pozzetto |
| `src/ui/components/scoreboard.ts` | Tabellone punteggi con avanzamento |
| `src/ui/screens/home.ts` | Schermata iniziale |
| `src/ui/screens/newGame.ts` | Wizard di creazione partita |
| `src/ui/screens/game.ts` | Partita in corso: tabellone ed elenco smazzate |
| `src/ui/screens/handForm.ts` | Inserimento e modifica di una smazzata |
| `src/ui/screens/history.ts` | Storico partite concluse |
| `src/ui/screens/players.ts` | Rubrica giocatori e statistiche |
| `src/styles/app.css` | Stili globali, tema, layout mobile |
| `src/main.ts` | Bootstrap dell'applicazione |
| `public/manifest.webmanifest` | Manifest PWA |
| `public/sw.js` | Service worker |
| `.github/workflows/deploy.yml` | Build e pubblicazione su GitHub Pages |

---

### Task 1: Scaffolding del progetto e costanti di punteggio

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `.gitignore`
- Create: `src/engine/cards.ts`
- Test: `tests/engine/cards.test.ts`

**Interfaces:**
- Consumes: niente (primo task)
- Produces: `CARD_VALUES`, `BONUS`, `TARGET_SCORE`, `PHASE_2_THRESHOLD`, `MIN_BURRACO_TABLE_POINTS` da `src/engine/cards.ts`

- [ ] **Step 1: Inizializzare il progetto**

```bash
npm init -y
npm install --save-dev vite typescript vitest jsdom @types/node
```

- [ ] **Step 2: Scrivere i file di configurazione**

`package.json` — sostituire la sezione `scripts`:

```json
{
  "name": "punti-burraco",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vitest/globals", "vite/client"]
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/puntiBurraco/',
  build: { target: 'es2022' },
})
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    // jsdom per tutti i test: serve a storage e interfaccia, e non disturba il motore.
    environment: 'jsdom',
  },
})
```

`index.html`:

```html
<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0f172a" />
    <title>Punti Burraco</title>
    <link rel="manifest" href="/puntiBurraco/manifest.webmanifest" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`.gitignore`:

```
node_modules
dist
.DS_Store
*.local
```

Creare anche `src/main.ts` con un contenuto minimo, altrimenti la build fallisce:

```ts
document.querySelector<HTMLDivElement>('#app')!.textContent = 'Punti Burraco'
```

- [ ] **Step 3: Scrivere il test delle costanti (fallirà)**

`tests/engine/cards.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CARD_VALUES, BONUS, TARGET_SCORE, PHASE_2_THRESHOLD, MIN_BURRACO_TABLE_POINTS } from '../../src/engine/cards'

describe('costanti di punteggio', () => {
  it('assegna il valore corretto a ogni carta', () => {
    expect(CARD_VALUES.jolly).toBe(30)
    expect(CARD_VALUES.pinella).toBe(20)
    expect(CARD_VALUES.asso).toBe(15)
    expect(CARD_VALUES.figura).toBe(10)
    expect(CARD_VALUES.bassa).toBe(5)
  })

  it('assegna il valore corretto a bonus e malus', () => {
    expect(BONUS.burracoPulito).toBe(200)
    expect(BONUS.burracoSemipulito).toBe(150)
    expect(BONUS.burracoSporco).toBe(100)
    expect(BONUS.chiusura).toBe(100)
    expect(BONUS.pozzettoNonPreso).toBe(-100)
  })

  it('fissa obiettivo partita e soglia di cambio fase', () => {
    expect(TARGET_SCORE).toBe(2005)
    expect(PHASE_2_THRESHOLD).toBe(1000)
    expect(MIN_BURRACO_TABLE_POINTS).toBe(35)
  })
})
```

- [ ] **Step 4: Eseguire il test e verificare che fallisca**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../src/engine/cards'`

- [ ] **Step 5: Implementare le costanti**

`src/engine/cards.ts`:

```ts
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
```

- [ ] **Step 6: Eseguire i test e verificare che passino**

Run: `npm test`
Expected: PASS — 3 test verdi

- [ ] **Step 7: Verificare che la build funzioni**

Run: `npm run build`
Expected: build completata, cartella `dist/` creata

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffolding Vite + TypeScript + Vitest e costanti di punteggio"
```

---

### Task 2: Tipi del dominio ed entità di punteggio

**Files:**
- Create: `src/engine/types.ts`, `src/engine/entities.ts`
- Test: `tests/engine/entities.test.ts`

**Interfaces:**
- Consumes: niente da Task 1 (solo coesistenza)
- Produces:
  - tipi `GameMode`, `Phase`, `Player`, `GameOptions`, `GamePlayerRef`, `Team`, `HandEntry`, `Hand`, `Game`, `ScoringEntity`, `LedgerAccount` da `src/engine/types.ts`
  - `resolveEntities(game: Game, phase: Phase, soloPlayerId: string | null): ScoringEntity[]`
  - `resolveLedgerAccounts(game: Game): LedgerAccount[]`
  - da `src/engine/entities.ts`

- [ ] **Step 1: Scrivere il test delle entità (fallirà)**

`tests/engine/entities.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveEntities, resolveLedgerAccounts } from '../../src/engine/entities'
import type { Game } from '../../src/engine/types'

function makeGame(mode: 2 | 3 | 4, playerNames: string[]): Game {
  return {
    id: 'g1',
    mode,
    options: { semipulitoEnabled: true },
    targetScore: 2005,
    players: playerNames.map((name, i) => ({ playerId: `p${i + 1}`, name, seat: i })),
    teams:
      mode === 4
        ? [
            { id: 't1', name: 'Squadra 1', playerIds: ['p1', 'p3'] },
            { id: 't2', name: 'Squadra 2', playerIds: ['p2', 'p4'] },
          ]
        : [],
    hands: [],
    status: 'in_progress',
    winnerIds: [],
    createdAt: '2026-08-19T10:00:00.000Z',
    updatedAt: '2026-08-19T10:00:00.000Z',
  }
}

describe('resolveEntities', () => {
  it('a 2 giocatori restituisce due entità individuali', () => {
    const entities = resolveEntities(makeGame(2, ['Ann', 'Bob']), 1, null)
    expect(entities).toHaveLength(2)
    expect(entities.map((e) => e.kind)).toEqual(['player', 'player'])
    expect(entities.map((e) => e.id)).toEqual(['p1', 'p2'])
  })

  it('a 4 giocatori restituisce due entità squadra con i rispettivi giocatori', () => {
    const entities = resolveEntities(makeGame(4, ['Ann', 'Bob', 'Cid', 'Dan']), 1, null)
    expect(entities).toHaveLength(2)
    expect(entities[0]).toMatchObject({ id: 't1', kind: 'team', playerIds: ['p1', 'p3'] })
    expect(entities[1]).toMatchObject({ id: 't2', kind: 'team', playerIds: ['p2', 'p4'] })
  })

  it('a 3 giocatori in fase 1 separa il solista dalla coppia', () => {
    const entities = resolveEntities(makeGame(3, ['Ann', 'Bob', 'Cid']), 1, 'p2')
    expect(entities).toHaveLength(2)
    expect(entities[0]).toMatchObject({ id: 'p2', kind: 'player', playerIds: ['p2'] })
    expect(entities[1]).toMatchObject({ kind: 'pair', playerIds: ['p1', 'p3'] })
    expect(entities[1].label).toBe('Ann e Cid')
  })

  it('a 3 giocatori in fase 2 restituisce tre entità individuali', () => {
    const entities = resolveEntities(makeGame(3, ['Ann', 'Bob', 'Cid']), 2, null)
    expect(entities.map((e) => e.id)).toEqual(['p1', 'p2', 'p3'])
    expect(entities.every((e) => e.kind === 'player')).toBe(true)
  })

  it('a 3 giocatori in fase 1 senza solista indicato solleva un errore', () => {
    expect(() => resolveEntities(makeGame(3, ['Ann', 'Bob', 'Cid']), 1, null)).toThrow(
      /solista/i,
    )
  })
})

describe('resolveLedgerAccounts', () => {
  it('a 4 giocatori il conto punti è di squadra', () => {
    const accounts = resolveLedgerAccounts(makeGame(4, ['Ann', 'Bob', 'Cid', 'Dan']))
    expect(accounts.map((a) => a.id)).toEqual(['t1', 't2'])
    expect(accounts[0].kind).toBe('team')
  })

  it('a 2 e 3 giocatori il conto punti è individuale', () => {
    expect(resolveLedgerAccounts(makeGame(2, ['Ann', 'Bob'])).map((a) => a.id)).toEqual(['p1', 'p2'])
    expect(resolveLedgerAccounts(makeGame(3, ['Ann', 'Bob', 'Cid'])).map((a) => a.id)).toEqual([
      'p1',
      'p2',
      'p3',
    ])
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npm test -- tests/engine/entities.test.ts`
Expected: FAIL — modulo non trovato

- [ ] **Step 3: Scrivere i tipi del dominio**

`src/engine/types.ts`:

```ts
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
```

- [ ] **Step 4: Implementare la derivazione delle entità**

`src/engine/entities.ts`:

```ts
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
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `npm test`
Expected: PASS — tutti i test di `cards` ed `entities` verdi

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(engine): tipi del dominio ed entità di punteggio per 2, 3 e 4 giocatori"
```

---

### Task 3: Calcolo del punteggio di una smazzata

**Files:**
- Create: `src/engine/scoring.ts`
- Test: `tests/engine/scoring.test.ts`

**Interfaces:**
- Consumes: `BONUS` da `src/engine/cards.ts`; `GameOptions`, `HandEntry` da `src/engine/types.ts`
- Produces:
  - `interface EntryScore { entityId: string; tablePoints: number; burracoBonus: number; closingBonus: number; handPenalty: number; potPenalty: number; total: number }`
  - `scoreEntry(entry: HandEntry, options: GameOptions): EntryScore`
  - `scoreEntries(entries: HandEntry[], options: GameOptions): EntryScore[]`
  - da `src/engine/scoring.ts`

- [ ] **Step 1: Scrivere i test del punteggio (falliranno)**

`tests/engine/scoring.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { scoreEntry, scoreEntries } from '../../src/engine/scoring'
import type { GameOptions, HandEntry } from '../../src/engine/types'

const options: GameOptions = { semipulitoEnabled: true }

function entry(overrides: Partial<HandEntry> = {}): HandEntry {
  return {
    entityId: 'p1',
    closed: false,
    tookPot: true,
    cleanBurracos: 0,
    semiCleanBurracos: 0,
    dirtyBurracos: 0,
    tablePoints: 0,
    handPoints: 0,
    ...overrides,
  }
}

describe('scoreEntry', () => {
  it('somma i punti in tavola senza altre voci', () => {
    const score = scoreEntry(entry({ tablePoints: 240 }), options)
    expect(score.total).toBe(240)
    expect(score.burracoBonus).toBe(0)
    expect(score.closingBonus).toBe(0)
  })

  it('somma i bonus dei tre tipi di burraco', () => {
    const score = scoreEntry(
      entry({ cleanBurracos: 2, semiCleanBurracos: 1, dirtyBurracos: 3, tablePoints: 500 }),
      options,
    )
    expect(score.burracoBonus).toBe(2 * 200 + 150 + 3 * 100)
    expect(score.total).toBe(500 + 850)
  })

  it('conta i semipuliti come sporchi quando la variante è disattivata', () => {
    const score = scoreEntry(entry({ semiCleanBurracos: 2 }), { semipulitoEnabled: false })
    expect(score.burracoBonus).toBe(200)
  })

  it('aggiunge il bonus di chiusura a chi chiude', () => {
    const score = scoreEntry(entry({ closed: true, tablePoints: 300, cleanBurracos: 1 }), options)
    expect(score.closingBonus).toBe(100)
    expect(score.total).toBe(300 + 200 + 100)
  })

  it('sottrae i punti delle carte rimaste in mano', () => {
    const score = scoreEntry(entry({ tablePoints: 180, handPoints: 65 }), options)
    expect(score.handPenalty).toBe(-65)
    expect(score.total).toBe(115)
  })

  it('applica il malus di 100 a chi non ha preso il pozzetto', () => {
    const score = scoreEntry(entry({ tookPot: false, tablePoints: 80 }), options)
    expect(score.potPenalty).toBe(-100)
    expect(score.total).toBe(-20)
  })

  it('produce un totale negativo quando le penalità superano i punti', () => {
    const score = scoreEntry(entry({ tookPot: false, tablePoints: 30, handPoints: 90 }), options)
    expect(score.total).toBe(-160)
  })

  it('calcola una smazzata completa di esempio', () => {
    // 420 in tavola, un burraco pulito e uno sporco, chiude, pozzetto preso
    const score = scoreEntry(
      entry({ closed: true, tablePoints: 420, cleanBurracos: 1, dirtyBurracos: 1 }),
      options,
    )
    expect(score.total).toBe(420 + 200 + 100 + 100)
  })
})

describe('scoreEntries', () => {
  it('calcola il punteggio di tutte le entità mantenendo l ordine', () => {
    const scores = scoreEntries(
      [entry({ entityId: 'a', tablePoints: 100 }), entry({ entityId: 'b', tablePoints: 50 })],
      options,
    )
    expect(scores.map((s) => s.entityId)).toEqual(['a', 'b'])
    expect(scores.map((s) => s.total)).toEqual([100, 50])
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/engine/scoring.test.ts`
Expected: FAIL — modulo non trovato

- [ ] **Step 3: Implementare il calcolo**

`src/engine/scoring.ts`:

```ts
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
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test`
Expected: PASS — tutti i test verdi

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(engine): calcolo del punteggio di una smazzata con bonus, malus e carte in mano"
```

---

### Task 4: Constraint di chiusura e validazione dell'input

**Files:**
- Create: `src/engine/validation.ts`
- Test: `tests/engine/validation.test.ts`

**Interfaces:**
- Consumes: `MIN_BURRACO_TABLE_POINTS` da `src/engine/cards.ts`; `HandEntry`, `ScoringEntity` da `src/engine/types.ts`
- Produces:
  - `type ViolationCode = 'MULTIPLE_CLOSERS' | 'CLOSER_WITHOUT_POT' | 'CLOSER_WITHOUT_BURRACO' | 'CLOSER_WITH_HAND_POINTS' | 'NEGATIVE_VALUE' | 'ENTITY_MISMATCH' | 'TABLE_POINTS_BELOW_BURRACOS'`
  - `interface Violation { code: ViolationCode; entityId: string | null; message: string; blocking: boolean }`
  - `validateHandEntries(entries: HandEntry[], entities: ScoringEntity[]): Violation[]`
  - `hasBlockingViolations(violations: Violation[]): boolean`
  - da `src/engine/validation.ts`

- [ ] **Step 1: Scrivere i test dei constraint (falliranno)**

`tests/engine/validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateHandEntries, hasBlockingViolations } from '../../src/engine/validation'
import type { HandEntry, ScoringEntity } from '../../src/engine/types'

const entities: ScoringEntity[] = [
  { id: 'a', kind: 'player', playerIds: ['a'], label: 'Ann' },
  { id: 'b', kind: 'player', playerIds: ['b'], label: 'Bob' },
]

function entry(entityId: string, overrides: Partial<HandEntry> = {}): HandEntry {
  return {
    entityId,
    closed: false,
    tookPot: true,
    cleanBurracos: 0,
    semiCleanBurracos: 0,
    dirtyBurracos: 0,
    tablePoints: 0,
    handPoints: 0,
    ...overrides,
  }
}

/** Chiusura regolare: pozzetto preso, un burraco, zero carte in mano. */
function validCloser(entityId: string): HandEntry {
  return entry(entityId, { closed: true, tookPot: true, cleanBurracos: 1, tablePoints: 300 })
}

describe('validateHandEntries', () => {
  it('accetta una smazzata con una chiusura regolare', () => {
    const violations = validateHandEntries([validCloser('a'), entry('b', { handPoints: 40 })], entities)
    expect(violations).toEqual([])
  })

  it('accetta una smazzata senza chiusura (tallone esaurito)', () => {
    const violations = validateHandEntries(
      [entry('a', { tablePoints: 120, handPoints: 30 }), entry('b', { tablePoints: 90, handPoints: 55 })],
      entities,
    )
    expect(violations).toEqual([])
  })

  it('rifiuta due chiusure nella stessa smazzata', () => {
    const violations = validateHandEntries([validCloser('a'), validCloser('b')], entities)
    expect(violations.map((v) => v.code)).toContain('MULTIPLE_CLOSERS')
    expect(hasBlockingViolations(violations)).toBe(true)
  })

  it('rifiuta la chiusura di chi non ha preso il pozzetto', () => {
    const violations = validateHandEntries(
      [entry('a', { closed: true, tookPot: false, cleanBurracos: 1, tablePoints: 300 }), entry('b')],
      entities,
    )
    const violation = violations.find((v) => v.code === 'CLOSER_WITHOUT_POT')
    expect(violation).toBeDefined()
    expect(violation?.entityId).toBe('a')
    expect(violation?.blocking).toBe(true)
    expect(violation?.message).toMatch(/pozzetto/i)
  })

  it('rifiuta la chiusura senza alcun burraco', () => {
    const violations = validateHandEntries(
      [entry('a', { closed: true, tookPot: true, tablePoints: 300 }), entry('b')],
      entities,
    )
    expect(violations.map((v) => v.code)).toContain('CLOSER_WITHOUT_BURRACO')
  })

  it('accetta la chiusura con un burraco sporco o semipulito', () => {
    const conDirty = validateHandEntries(
      [entry('a', { closed: true, tookPot: true, dirtyBurracos: 1, tablePoints: 300 }), entry('b')],
      entities,
    )
    expect(conDirty).toEqual([])

    const conSemi = validateHandEntries(
      [entry('a', { closed: true, tookPot: true, semiCleanBurracos: 1, tablePoints: 300 }), entry('b')],
      entities,
    )
    expect(conSemi).toEqual([])
  })

  it('rifiuta la chiusura con punti ancora in mano', () => {
    const violations = validateHandEntries(
      [entry('a', { closed: true, tookPot: true, cleanBurracos: 1, tablePoints: 300, handPoints: 15 }), entry('b')],
      entities,
    )
    const violation = violations.find((v) => v.code === 'CLOSER_WITH_HAND_POINTS')
    expect(violation?.blocking).toBe(true)
    expect(violation?.message).toMatch(/in mano/i)
  })

  it('rifiuta valori negativi', () => {
    const violations = validateHandEntries([entry('a', { tablePoints: -10 }), entry('b')], entities)
    expect(violations.map((v) => v.code)).toContain('NEGATIVE_VALUE')
  })

  it('rifiuta un elenco di entità che non corrisponde alla smazzata', () => {
    const violations = validateHandEntries([entry('a'), entry('z')], entities)
    expect(violations.map((v) => v.code)).toContain('ENTITY_MISMATCH')
  })

  it('avvisa senza bloccare se i punti in tavola non bastano per i burrachi dichiarati', () => {
    const violations = validateHandEntries(
      [entry('a', { cleanBurracos: 2, tablePoints: 50 }), entry('b')],
      entities,
    )
    const violation = violations.find((v) => v.code === 'TABLE_POINTS_BELOW_BURRACOS')
    expect(violation).toBeDefined()
    expect(violation?.blocking).toBe(false)
    expect(hasBlockingViolations(violations)).toBe(false)
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/engine/validation.test.ts`
Expected: FAIL — modulo non trovato

- [ ] **Step 3: Implementare la validazione**

`src/engine/validation.ts`:

```ts
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
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test`
Expected: PASS — tutti i test verdi

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(engine): constraint di chiusura e validazione della smazzata"
```

---

### Task 5: Punteggi cumulativi, cambio fase e fine partita

**Files:**
- Create: `src/engine/standings.ts`
- Test: `tests/engine/standings.test.ts`

**Interfaces:**
- Consumes: `resolveEntities`, `resolveLedgerAccounts` da `src/engine/entities.ts`; `scoreEntries`, `EntryScore` da `src/engine/scoring.ts`; `validateHandEntries`, `hasBlockingViolations` da `src/engine/validation.ts`; `PHASE_2_THRESHOLD` da `src/engine/cards.ts`
- Produces:
  - `interface Standing { accountId: string; label: string; kind: 'player' | 'team'; playerIds: string[]; points: number }`
  - `interface HandResult { handId: string; phase: Phase; entities: ScoringEntity[]; scores: EntryScore[]; deltas: Record<string, number>; valid: boolean; issue: string | null }`
  - `interface GameProgress { hands: HandResult[]; standings: Standing[]; nextPhase: Phase; finished: boolean; winnerIds: string[]; hasIssues: boolean }`
  - `replayGame(game: Game): GameProgress`
  - `projectScores(scores: EntryScore[], entities: ScoringEntity[]): Record<string, number>`
  - da `src/engine/standings.ts`

**Regole implementate qui:**
- La fase non è persistita: si ricalcola sempre riproducendo le smazzate dall'inizio.
- Il passaggio alla fase 2 avviene quando, a fine smazzata, un giocatore raggiunge 1000; vale dalla smazzata successiva ed è irreversibile.
- Le entità coppia proiettano `Math.ceil(total / 2)` su ciascun componente, anche con totali negativi.
- Una smazzata incoerente (fase 1 senza solista, entità non corrispondenti, violazione bloccante) non viene conteggiata e viene marcata come da correggere.

Nota rispetto alla spec: `computeStandings`, `resolvePhase` e `checkGameEnd` sono
unificate in `replayGame`, che le ricava in un solo passaggio sulle smazzate.
Tenerle separate avrebbe richiesto tre replay identici della stessa partita.

- [ ] **Step 1: Scrivere i test (falliranno)**

`tests/engine/standings.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { replayGame, projectScores } from '../../src/engine/standings'
import type { Game, Hand, HandEntry, ScoringEntity } from '../../src/engine/types'

function baseGame(mode: 2 | 3 | 4, hands: Hand[] = []): Game {
  const names = ['Ann', 'Bob', 'Cid', 'Dan'].slice(0, mode)
  return {
    id: 'g1',
    mode,
    options: { semipulitoEnabled: true },
    targetScore: 2005,
    players: names.map((name, i) => ({ playerId: `p${i + 1}`, name, seat: i })),
    teams:
      mode === 4
        ? [
            { id: 't1', name: 'Ann e Cid', playerIds: ['p1', 'p3'] },
            { id: 't2', name: 'Bob e Dan', playerIds: ['p2', 'p4'] },
          ]
        : [],
    hands,
    status: 'in_progress',
    winnerIds: [],
    createdAt: '2026-08-19T10:00:00.000Z',
    updatedAt: '2026-08-19T10:00:00.000Z',
  }
}

function entry(entityId: string, overrides: Partial<HandEntry> = {}): HandEntry {
  return {
    entityId,
    closed: false,
    tookPot: true,
    cleanBurracos: 0,
    semiCleanBurracos: 0,
    dirtyBurracos: 0,
    tablePoints: 0,
    handPoints: 0,
    ...overrides,
  }
}

function hand(id: string, entries: HandEntry[], soloPlayerId: string | null = null): Hand {
  return { id, soloPlayerId, entries, createdAt: '2026-08-19T11:00:00.000Z' }
}

describe('projectScores', () => {
  it('divide a metà il punteggio di una coppia arrotondando verso l alto', () => {
    const entities: ScoringEntity[] = [
      { id: 'pair:p1-p3', kind: 'pair', playerIds: ['p1', 'p3'], label: 'Ann e Cid' },
    ]
    const deltas = projectScores(
      [
        {
          entityId: 'pair:p1-p3',
          tablePoints: 305,
          burracoBonus: 0,
          closingBonus: 0,
          handPenalty: 0,
          potPenalty: 0,
          total: 305,
        },
      ],
      entities,
    )
    expect(deltas).toEqual({ p1: 153, p3: 153 })
  })

  it('arrotonda verso l alto anche i punteggi negativi di coppia', () => {
    const entities: ScoringEntity[] = [
      { id: 'pair:p1-p3', kind: 'pair', playerIds: ['p1', 'p3'], label: 'Ann e Cid' },
    ]
    const deltas = projectScores(
      [
        {
          entityId: 'pair:p1-p3',
          tablePoints: 0,
          burracoBonus: 0,
          closingBonus: 0,
          handPenalty: -205,
          potPenalty: -100,
          total: -305,
        },
      ],
      entities,
    )
    expect(deltas).toEqual({ p1: -152, p3: -152 })
  })

  it('assegna il punteggio intero alle entità squadra senza dividerlo', () => {
    const entities: ScoringEntity[] = [
      { id: 't1', kind: 'team', playerIds: ['p1', 'p3'], label: 'Ann e Cid' },
    ]
    const deltas = projectScores(
      [
        {
          entityId: 't1',
          tablePoints: 305,
          burracoBonus: 0,
          closingBonus: 0,
          handPenalty: 0,
          potPenalty: 0,
          total: 305,
        },
      ],
      entities,
    )
    expect(deltas).toEqual({ t1: 305 })
  })
})

describe('replayGame — partita a 2 giocatori', () => {
  it('accumula i punteggi delle smazzate', () => {
    const game = baseGame(2, [
      hand('h1', [
        entry('p1', { closed: true, cleanBurracos: 1, tablePoints: 300 }),
        entry('p2', { tablePoints: 120, handPoints: 40 }),
      ]),
      hand('h2', [
        entry('p1', { tablePoints: 100, handPoints: 20 }),
        entry('p2', { closed: true, dirtyBurracos: 1, tablePoints: 250 }),
      ]),
    ])
    const progress = replayGame(game)
    const points = Object.fromEntries(progress.standings.map((s) => [s.accountId, s.points]))
    expect(points.p1).toBe(600 + 80)
    expect(points.p2).toBe(80 + 450)
    expect(progress.finished).toBe(false)
  })

  it('ordina la classifica dal punteggio più alto', () => {
    const game = baseGame(2, [
      hand('h1', [entry('p1', { tablePoints: 50 }), entry('p2', { tablePoints: 400 })]),
    ])
    expect(replayGame(game).standings[0].accountId).toBe('p2')
  })
})

describe('replayGame — partita a 4 giocatori', () => {
  it('tiene il punteggio per squadra senza dividerlo', () => {
    const game = baseGame(4, [
      hand('h1', [
        entry('t1', { closed: true, cleanBurracos: 1, tablePoints: 405 }),
        entry('t2', { tablePoints: 100, handPoints: 35, tookPot: false }),
      ]),
    ])
    const progress = replayGame(game)
    const points = Object.fromEntries(progress.standings.map((s) => [s.accountId, s.points]))
    expect(points.t1).toBe(405 + 200 + 100)
    expect(points.t2).toBe(100 - 35 - 100)
    expect(progress.standings).toHaveLength(2)
  })
})

describe('replayGame — partita a 3 giocatori', () => {
  it('in fase 1 divide i punti della coppia e lascia interi quelli del solista', () => {
    const game = baseGame(3, [
      hand(
        'h1',
        [
          entry('p2', { closed: true, cleanBurracos: 1, tablePoints: 301 }),
          entry('pair:p1-p3', { tablePoints: 200, handPoints: 45 }),
        ],
        'p2',
      ),
    ])
    const points = Object.fromEntries(replayGame(game).standings.map((s) => [s.accountId, s.points]))
    expect(points.p2).toBe(301 + 200 + 100)
    expect(points.p1).toBe(78) // (200 - 45) / 2 = 77,5 -> 78
    expect(points.p3).toBe(78)
  })

  it('resta in fase 1 finché nessuno raggiunge 1000', () => {
    const game = baseGame(3, [
      hand('h1', [entry('p2', { tablePoints: 999 }), entry('pair:p1-p3', { tablePoints: 100 })], 'p2'),
    ])
    expect(replayGame(game).nextPhase).toBe(1)
  })

  it('passa alla fase 2 quando un giocatore raggiunge esattamente 1000', () => {
    const game = baseGame(3, [
      hand('h1', [entry('p2', { tablePoints: 1000 }), entry('pair:p1-p3', { tablePoints: 100 })], 'p2'),
    ])
    expect(replayGame(game).nextPhase).toBe(2)
  })

  it('in fase 2 usa tre entità individuali e non richiede il solista', () => {
    const game = baseGame(3, [
      hand('h1', [entry('p2', { tablePoints: 1000 }), entry('pair:p1-p3', { tablePoints: 100 })], 'p2'),
      hand('h2', [
        entry('p1', { tablePoints: 200 }),
        entry('p2', { tablePoints: 300 }),
        entry('p3', { closed: true, cleanBurracos: 1, tablePoints: 400 }),
      ]),
    ])
    const progress = replayGame(game)
    expect(progress.hands[1].phase).toBe(2)
    expect(progress.hands[1].valid).toBe(true)
    const points = Object.fromEntries(progress.standings.map((s) => [s.accountId, s.points]))
    expect(points.p2).toBe(1300)
  })

  it('non torna in fase 1 se i punteggi ridiscendono sotto 1000', () => {
    const game = baseGame(3, [
      hand('h1', [entry('p2', { tablePoints: 1000 }), entry('pair:p1-p3', { tablePoints: 0 })], 'p2'),
      hand('h2', [
        entry('p1', { tablePoints: 0 }),
        entry('p2', { tablePoints: 0, handPoints: 500 }),
        entry('p3', { tablePoints: 0 }),
      ]),
    ])
    expect(replayGame(game).nextPhase).toBe(2)
  })

  it('marca come da correggere una smazzata di fase 1 senza solista', () => {
    const game = baseGame(3, [hand('h1', [entry('p1'), entry('p2'), entry('p3')], null)])
    const progress = replayGame(game)
    expect(progress.hands[0].valid).toBe(false)
    expect(progress.hasIssues).toBe(true)
    expect(progress.standings.every((s) => s.points === 0)).toBe(true)
  })
})

describe('replayGame — fine partita', () => {
  it('dichiara finita la partita quando un conto supera l obiettivo', () => {
    const game = baseGame(2, [
      hand('h1', [entry('p1', { tablePoints: 2005 }), entry('p2', { tablePoints: 300 })]),
    ])
    const progress = replayGame(game)
    expect(progress.finished).toBe(true)
    expect(progress.winnerIds).toEqual(['p1'])
  })

  it('non dichiara finita la partita in caso di parità al vertice sopra l obiettivo', () => {
    const game = baseGame(2, [
      hand('h1', [entry('p1', { tablePoints: 2100 }), entry('p2', { tablePoints: 2100 })]),
    ])
    const progress = replayGame(game)
    expect(progress.finished).toBe(false)
    expect(progress.winnerIds).toEqual([])
  })

  it('assegna la vittoria al punteggio più alto quando più conti superano l obiettivo', () => {
    const game = baseGame(2, [
      hand('h1', [entry('p1', { tablePoints: 2100 }), entry('p2', { tablePoints: 2300 })]),
    ])
    expect(replayGame(game).winnerIds).toEqual(['p2'])
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/engine/standings.test.ts`
Expected: FAIL — modulo non trovato

- [ ] **Step 3: Implementare il replay della partita**

`src/engine/standings.ts`:

```ts
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
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test`
Expected: PASS — tutti i test verdi

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(engine): punteggi cumulativi, cambio fase a tre giocatori e condizione di vittoria"
```

---

### Task 6: Creazione partita e mutazioni delle smazzate

**Files:**
- Create: `src/engine/game.ts`
- Test: `tests/engine/game.test.ts`

**Interfaces:**
- Consumes: `replayGame` da `src/engine/standings.ts`; tipi da `src/engine/types.ts`
- Produces:
  - `interface EngineDeps { newId: () => string; now: () => string }`
  - `interface NewGameInput { mode: GameMode; players: { playerId: string; name: string }[]; teams?: { name: string; playerIds: [string, string] }[]; options: GameOptions }`
  - `createGame(input: NewGameInput, deps: EngineDeps): Game`
  - `addHand(game: Game, input: { soloPlayerId: string | null; entries: HandEntry[] }, deps: EngineDeps): Game`
  - `updateHand(game: Game, handId: string, input: { soloPlayerId: string | null; entries: HandEntry[] }, deps: EngineDeps): Game`
  - `deleteHand(game: Game, handId: string, deps: EngineDeps): Game`
  - da `src/engine/game.ts`

**Regole implementate qui:**
- Ogni mutazione restituisce una nuova partita: nessuna struttura viene modificata sul posto.
- Dopo ogni mutazione la partita viene rigiocata: se risulta conclusa, `status` diventa `completed` e `winnerIds` viene valorizzato; se una modifica successiva la riapre, torna `in_progress` con `winnerIds` vuoto.

- [ ] **Step 1: Scrivere i test (falliranno)**

`tests/engine/game.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createGame, addHand, updateHand, deleteHand, type EngineDeps } from '../../src/engine/game'
import type { HandEntry } from '../../src/engine/types'

function makeDeps(): EngineDeps {
  let counter = 0
  return {
    newId: () => `id${++counter}`,
    now: () => '2026-08-19T12:00:00.000Z',
  }
}

function entry(entityId: string, overrides: Partial<HandEntry> = {}): HandEntry {
  return {
    entityId,
    closed: false,
    tookPot: true,
    cleanBurracos: 0,
    semiCleanBurracos: 0,
    dirtyBurracos: 0,
    tablePoints: 0,
    handPoints: 0,
    ...overrides,
  }
}

describe('createGame', () => {
  it('crea una partita a due giocatori pronta da giocare', () => {
    const game = createGame(
      {
        mode: 2,
        players: [
          { playerId: 'p1', name: 'Ann' },
          { playerId: 'p2', name: 'Bob' },
        ],
        options: { semipulitoEnabled: true },
      },
      makeDeps(),
    )
    expect(game.mode).toBe(2)
    expect(game.targetScore).toBe(2005)
    expect(game.status).toBe('in_progress')
    expect(game.hands).toEqual([])
    expect(game.players.map((p) => p.seat)).toEqual([0, 1])
  })

  it('crea le squadre nella partita a quattro giocatori', () => {
    const game = createGame(
      {
        mode: 4,
        players: [
          { playerId: 'p1', name: 'Ann' },
          { playerId: 'p2', name: 'Bob' },
          { playerId: 'p3', name: 'Cid' },
          { playerId: 'p4', name: 'Dan' },
        ],
        teams: [
          { name: 'Noi', playerIds: ['p1', 'p3'] },
          { name: 'Loro', playerIds: ['p2', 'p4'] },
        ],
        options: { semipulitoEnabled: false },
      },
      makeDeps(),
    )
    expect(game.teams).toHaveLength(2)
    expect(game.teams[0].playerIds).toEqual(['p1', 'p3'])
    expect(game.options.semipulitoEnabled).toBe(false)
  })

  it('rifiuta un numero di giocatori diverso dalla modalità', () => {
    expect(() =>
      createGame(
        { mode: 4, players: [{ playerId: 'p1', name: 'Ann' }], options: { semipulitoEnabled: true } },
        makeDeps(),
      ),
    ).toThrow(/giocatori/i)
  })
})

describe('addHand', () => {
  it('aggiunge una smazzata senza modificare la partita originale', () => {
    const deps = makeDeps()
    const game = createGame(
      {
        mode: 2,
        players: [
          { playerId: 'p1', name: 'Ann' },
          { playerId: 'p2', name: 'Bob' },
        ],
        options: { semipulitoEnabled: true },
      },
      deps,
    )
    const updated = addHand(
      game,
      {
        soloPlayerId: null,
        entries: [entry('p1', { closed: true, cleanBurracos: 1, tablePoints: 300 }), entry('p2')],
      },
      deps,
    )
    expect(game.hands).toHaveLength(0)
    expect(updated.hands).toHaveLength(1)
    expect(updated.hands[0].entries[0].closed).toBe(true)
  })

  it('conclude la partita quando si supera l obiettivo', () => {
    const deps = makeDeps()
    let game = createGame(
      {
        mode: 2,
        players: [
          { playerId: 'p1', name: 'Ann' },
          { playerId: 'p2', name: 'Bob' },
        ],
        options: { semipulitoEnabled: true },
      },
      deps,
    )
    game = addHand(
      game,
      { soloPlayerId: null, entries: [entry('p1', { tablePoints: 2005 }), entry('p2')] },
      deps,
    )
    expect(game.status).toBe('completed')
    expect(game.winnerIds).toEqual(['p1'])
  })
})

describe('updateHand e deleteHand', () => {
  it('ricalcola i totali dopo la correzione di una smazzata', () => {
    const deps = makeDeps()
    let game = createGame(
      {
        mode: 2,
        players: [
          { playerId: 'p1', name: 'Ann' },
          { playerId: 'p2', name: 'Bob' },
        ],
        options: { semipulitoEnabled: true },
      },
      deps,
    )
    game = addHand(
      game,
      { soloPlayerId: null, entries: [entry('p1', { tablePoints: 2005 }), entry('p2')] },
      deps,
    )
    expect(game.status).toBe('completed')

    game = updateHand(
      game,
      game.hands[0].id,
      { soloPlayerId: null, entries: [entry('p1', { tablePoints: 205 }), entry('p2')] },
      deps,
    )
    expect(game.status).toBe('in_progress')
    expect(game.winnerIds).toEqual([])
    expect(game.hands).toHaveLength(1)
  })

  it('elimina una smazzata', () => {
    const deps = makeDeps()
    let game = createGame(
      {
        mode: 2,
        players: [
          { playerId: 'p1', name: 'Ann' },
          { playerId: 'p2', name: 'Bob' },
        ],
        options: { semipulitoEnabled: true },
      },
      deps,
    )
    game = addHand(game, { soloPlayerId: null, entries: [entry('p1'), entry('p2')] }, deps)
    const handId = game.hands[0].id
    game = deleteHand(game, handId, deps)
    expect(game.hands).toHaveLength(0)
  })

  it('segnala l errore se la smazzata da modificare non esiste', () => {
    const deps = makeDeps()
    const game = createGame(
      {
        mode: 2,
        players: [
          { playerId: 'p1', name: 'Ann' },
          { playerId: 'p2', name: 'Bob' },
        ],
        options: { semipulitoEnabled: true },
      },
      deps,
    )
    expect(() =>
      updateHand(game, 'inesistente', { soloPlayerId: null, entries: [] }, deps),
    ).toThrow(/smazzata/i)
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/engine/game.test.ts`
Expected: FAIL — modulo non trovato

- [ ] **Step 3: Implementare creazione e mutazioni**

`src/engine/game.ts`:

```ts
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
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test`
Expected: PASS — tutti i test verdi

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(engine): creazione partita e mutazioni immutabili delle smazzate"
```

---

### Task 7: Statistiche per giocatore

**Files:**
- Create: `src/engine/stats.ts`
- Test: `tests/engine/stats.test.ts`

**Interfaces:**
- Consumes: `replayGame` da `src/engine/standings.ts`; tipi da `src/engine/types.ts`
- Produces:
  - `interface PlayerStats { playerId: string; name: string; gamesPlayed: number; gamesWon: number; winRate: number; handsPlayed: number; averageHandPoints: number; bestHandPoints: number }`
  - `computePlayerStats(games: Game[]): PlayerStats[]`
  - da `src/engine/stats.ts`

**Regole implementate qui:**
- Contano solo le partite concluse (`status === 'completed'`).
- A quattro giocatori i punti del singolo sono quelli della sua squadra, unico punteggio esistente in quella modalità.
- `winRate` è una frazione fra 0 e 1; con zero partite vale 0.
- I giocatori sono ordinati per numero di vittorie decrescente, poi per nome.

- [ ] **Step 1: Scrivere i test (falliranno)**

`tests/engine/stats.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computePlayerStats } from '../../src/engine/stats'
import type { Game, Hand, HandEntry } from '../../src/engine/types'

function entry(entityId: string, tablePoints: number): HandEntry {
  return {
    entityId,
    closed: false,
    tookPot: true,
    cleanBurracos: 0,
    semiCleanBurracos: 0,
    dirtyBurracos: 0,
    tablePoints,
    handPoints: 0,
  }
}

function completedTwoPlayerGame(id: string, p1Points: number, p2Points: number): Game {
  const hands: Hand[] = [
    {
      id: `${id}-h1`,
      soloPlayerId: null,
      entries: [entry('p1', p1Points), entry('p2', p2Points)],
      createdAt: '2026-08-19T11:00:00.000Z',
    },
  ]
  return {
    id,
    mode: 2,
    options: { semipulitoEnabled: true },
    targetScore: 2005,
    players: [
      { playerId: 'p1', name: 'Ann', seat: 0 },
      { playerId: 'p2', name: 'Bob', seat: 1 },
    ],
    teams: [],
    hands,
    status: p1Points >= 2005 || p2Points >= 2005 ? 'completed' : 'in_progress',
    winnerIds: p1Points >= 2005 ? ['p1'] : p2Points >= 2005 ? ['p2'] : [],
    createdAt: '2026-08-19T10:00:00.000Z',
    updatedAt: '2026-08-19T12:00:00.000Z',
  }
}

describe('computePlayerStats', () => {
  it('conta partite giocate, vinte e percentuale di vittoria', () => {
    const stats = computePlayerStats([
      completedTwoPlayerGame('g1', 2100, 800),
      completedTwoPlayerGame('g2', 900, 2200),
      completedTwoPlayerGame('g3', 2300, 700),
    ])
    const ann = stats.find((s) => s.playerId === 'p1')!
    expect(ann.gamesPlayed).toBe(3)
    expect(ann.gamesWon).toBe(2)
    expect(ann.winRate).toBeCloseTo(2 / 3)
  })

  it('ignora le partite ancora in corso', () => {
    const stats = computePlayerStats([completedTwoPlayerGame('g1', 300, 200)])
    expect(stats).toEqual([])
  })

  it('calcola media e miglior smazzata', () => {
    const game = completedTwoPlayerGame('g1', 2100, 800)
    game.hands.push({
      id: 'g1-h2',
      soloPlayerId: null,
      entries: [entry('p1', 300), entry('p2', 100)],
      createdAt: '2026-08-19T11:30:00.000Z',
    })
    const stats = computePlayerStats([game])
    const ann = stats.find((s) => s.playerId === 'p1')!
    expect(ann.handsPlayed).toBe(2)
    expect(ann.bestHandPoints).toBe(2100)
    expect(ann.averageHandPoints).toBe(1200)
  })

  it('ordina per vittorie decrescenti', () => {
    const stats = computePlayerStats([
      completedTwoPlayerGame('g1', 2100, 800),
      completedTwoPlayerGame('g2', 2100, 800),
    ])
    expect(stats[0].playerId).toBe('p1')
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/engine/stats.test.ts`
Expected: FAIL — modulo non trovato

- [ ] **Step 3: Implementare le statistiche**

`src/engine/stats.ts`:

```ts
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
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test`
Expected: PASS — tutti i test verdi

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(engine): statistiche per giocatore sulle partite concluse"
```

---

### Task 8: Persistenza su localStorage

**Files:**
- Create: `src/storage/repository.ts`
- Test: `tests/storage/repository.test.ts`

**Interfaces:**
- Consumes: tipi `Game`, `Player` da `src/engine/types.ts`
- Produces:
  - `const STORAGE_KEY = 'puntiburraco.v1'`
  - `interface PersistedState { schemaVersion: 1; players: Player[]; games: Game[] }`
  - `loadState(): PersistedState`
  - `saveState(state: PersistedState): void`
  - `upsertGame(game: Game): PersistedState`
  - `upsertPlayer(name: string, newId: () => string, now: () => string): { state: PersistedState; player: Player }`
  - `getGame(id: string): Game | null`
  - `deleteGame(id: string): PersistedState`
  - da `src/storage/repository.ts`

**Regole implementate qui:**
- Dati assenti, illeggibili o di versione sconosciuta non devono impedire l'avvio: si riparte da uno stato vuoto.
- `upsertPlayer` riusa il giocatore esistente se il nome corrisponde ignorando maiuscole e spazi ai bordi.

- [ ] **Step 1: Scrivere i test (falliranno)**

`tests/storage/repository.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  STORAGE_KEY,
  loadState,
  saveState,
  upsertGame,
  upsertPlayer,
  getGame,
  deleteGame,
} from '../../src/storage/repository'
import type { Game } from '../../src/engine/types'

function makeGame(id: string): Game {
  return {
    id,
    mode: 2,
    options: { semipulitoEnabled: true },
    targetScore: 2005,
    players: [
      { playerId: 'p1', name: 'Ann', seat: 0 },
      { playerId: 'p2', name: 'Bob', seat: 1 },
    ],
    teams: [],
    hands: [],
    status: 'in_progress',
    winnerIds: [],
    createdAt: '2026-08-19T10:00:00.000Z',
    updatedAt: '2026-08-19T10:00:00.000Z',
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('loadState', () => {
  it('restituisce uno stato vuoto se non c è nulla salvato', () => {
    expect(loadState()).toEqual({ schemaVersion: 1, players: [], games: [] })
  })

  it('non esplode se i dati salvati sono corrotti', () => {
    localStorage.setItem(STORAGE_KEY, '{non è json')
    expect(loadState()).toEqual({ schemaVersion: 1, players: [], games: [] })
  })

  it('ignora uno stato con versione di schema sconosciuta', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99, players: [], games: [] }))
    expect(loadState()).toEqual({ schemaVersion: 1, players: [], games: [] })
  })
})

describe('saveState e loadState', () => {
  it('conserva le partite fra un salvataggio e la rilettura', () => {
    saveState({ schemaVersion: 1, players: [], games: [makeGame('g1')] })
    const state = loadState()
    expect(state.games).toHaveLength(1)
    expect(state.games[0].id).toBe('g1')
  })
})

describe('upsertGame', () => {
  it('aggiunge una partita nuova', () => {
    const state = upsertGame(makeGame('g1'))
    expect(state.games.map((g) => g.id)).toEqual(['g1'])
    expect(loadState().games).toHaveLength(1)
  })

  it('sostituisce una partita esistente senza duplicarla', () => {
    upsertGame(makeGame('g1'))
    const updated = { ...makeGame('g1'), status: 'completed' as const }
    const state = upsertGame(updated)
    expect(state.games).toHaveLength(1)
    expect(state.games[0].status).toBe('completed')
  })
})

describe('upsertPlayer', () => {
  it('crea un giocatore nuovo', () => {
    const { player } = upsertPlayer('Ann', () => 'p1', () => '2026-08-19T10:00:00.000Z')
    expect(player).toEqual({ id: 'p1', name: 'Ann', createdAt: '2026-08-19T10:00:00.000Z' })
    expect(loadState().players).toHaveLength(1)
  })

  it('riusa il giocatore esistente ignorando maiuscole e spazi', () => {
    upsertPlayer('Ann', () => 'p1', () => '2026-08-19T10:00:00.000Z')
    const { player, state } = upsertPlayer('  ann ', () => 'p2', () => '2026-08-19T11:00:00.000Z')
    expect(player.id).toBe('p1')
    expect(state.players).toHaveLength(1)
  })
})

describe('getGame e deleteGame', () => {
  it('recupera una partita per identificativo', () => {
    upsertGame(makeGame('g1'))
    expect(getGame('g1')?.id).toBe('g1')
    expect(getGame('assente')).toBeNull()
  })

  it('elimina una partita', () => {
    upsertGame(makeGame('g1'))
    const state = deleteGame('g1')
    expect(state.games).toEqual([])
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/storage/repository.test.ts`
Expected: FAIL — modulo non trovato

- [ ] **Step 3: Implementare il repository**

`src/storage/repository.ts`:

```ts
import type { Game, Player } from '../engine/types'

export const STORAGE_KEY = 'puntiburraco.v1'
const SCHEMA_VERSION = 1

/** Contenuto completo salvato sul dispositivo. */
export interface PersistedState {
  schemaVersion: 1
  players: Player[]
  games: Game[]
}

function emptyState(): PersistedState {
  return { schemaVersion: SCHEMA_VERSION, players: [], games: [] }
}

/** Legge lo stato salvato. Qualsiasi anomalia produce uno stato vuoto invece di un errore. */
export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    if (parsed.schemaVersion !== SCHEMA_VERSION) return emptyState()
    if (!Array.isArray(parsed.players) || !Array.isArray(parsed.games)) return emptyState()
    return { schemaVersion: SCHEMA_VERSION, players: parsed.players, games: parsed.games }
  } catch {
    return emptyState()
  }
}

export function saveState(state: PersistedState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

/** Inserisce o sostituisce una partita, restituendo lo stato aggiornato. */
export function upsertGame(game: Game): PersistedState {
  const state = loadState()
  const index = state.games.findIndex((g) => g.id === game.id)
  const games = index === -1 ? [...state.games, game] : state.games.map((g, i) => (i === index ? game : g))
  const next = { ...state, games }
  saveState(next)
  return next
}

/** Recupera o crea un giocatore in rubrica, confrontando i nomi senza distinzione di maiuscole. */
export function upsertPlayer(
  name: string,
  newId: () => string,
  now: () => string,
): { state: PersistedState; player: Player } {
  const state = loadState()
  const normalized = name.trim().toLocaleLowerCase('it')
  const existing = state.players.find((p) => p.name.trim().toLocaleLowerCase('it') === normalized)
  if (existing) return { state, player: existing }

  const player: Player = { id: newId(), name: name.trim(), createdAt: now() }
  const next = { ...state, players: [...state.players, player] }
  saveState(next)
  return { state: next, player }
}

export function getGame(id: string): Game | null {
  return loadState().games.find((g) => g.id === id) ?? null
}

export function deleteGame(id: string): PersistedState {
  const state = loadState()
  const next = { ...state, games: state.games.filter((g) => g.id !== id) }
  saveState(next)
  return next
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test`
Expected: PASS — tutti i test verdi, inclusi quelli in ambiente jsdom

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(storage): persistenza su localStorage con versione schema e lettura difensiva"
```

---

### Task 9: Struttura dell'interfaccia, routing e tema

**Files:**
- Create: `src/ui/dom.ts`, `src/ui/router.ts`, `src/styles/app.css`
- Modify: `src/main.ts`
- Test: `tests/ui/router.test.ts`

**Interfaces:**
- Consumes: niente dal motore
- Produces:
  - `el<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Partial<HTMLElementTagNameMap[K]> & { class?: string; dataset?: Record<string, string> }, ...children: (Node | string | null)[]): HTMLElementTagNameMap[K]` da `src/ui/dom.ts`
  - `type Screen = (params: Record<string, string>) => HTMLElement`
  - `registerRoute(pattern: string, screen: Screen): void`
  - `startRouter(container: HTMLElement): void`
  - `navigate(path: string): void`
  - `matchRoute(pattern: string, path: string): Record<string, string> | null`
  - da `src/ui/router.ts`

- [ ] **Step 1: Scrivere il test del matching delle rotte (fallirà)**

`tests/ui/router.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { matchRoute } from '../../src/ui/router'

describe('matchRoute', () => {
  it('riconosce una rotta statica', () => {
    expect(matchRoute('/storico', '/storico')).toEqual({})
    expect(matchRoute('/storico', '/giocatori')).toBeNull()
  })

  it('estrae i parametri di una rotta dinamica', () => {
    expect(matchRoute('/partita/:gameId', '/partita/abc')).toEqual({ gameId: 'abc' })
  })

  it('estrae più parametri', () => {
    expect(matchRoute('/partita/:gameId/smazzata/:handId', '/partita/abc/smazzata/h1')).toEqual({
      gameId: 'abc',
      handId: 'h1',
    })
  })

  it('non confonde rotte di lunghezza diversa', () => {
    expect(matchRoute('/partita/:gameId', '/partita/abc/smazzata')).toBeNull()
    expect(matchRoute('/partita/:gameId/smazzata', '/partita/abc')).toBeNull()
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npm test -- tests/ui/router.test.ts`
Expected: FAIL — modulo non trovato

- [ ] **Step 3: Implementare gli helper del DOM**

`src/ui/dom.ts`:

```ts
type ElementProps<K extends keyof HTMLElementTagNameMap> = Partial<
  Omit<HTMLElementTagNameMap[K], 'dataset' | 'style' | 'children'>
> & {
  class?: string
  dataset?: Record<string, string>
  onClick?: (event: MouseEvent) => void
}

/** Crea un elemento con attributi e figli, senza librerie esterne. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps<K> = {},
  ...children: (Node | string | null)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  const { class: className, dataset, onClick, ...rest } = props

  if (className) element.className = className
  if (dataset) for (const [key, value] of Object.entries(dataset)) element.dataset[key] = value
  if (onClick) element.addEventListener('click', onClick)
  Object.assign(element, rest)

  for (const child of children) {
    if (child === null) continue
    element.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return element
}

/** Sostituisce il contenuto di un contenitore. */
export function render(container: HTMLElement, content: HTMLElement): void {
  container.replaceChildren(content)
}
```

- [ ] **Step 4: Implementare il router**

`src/ui/router.ts`:

```ts
import { render } from './dom'

export type Screen = (params: Record<string, string>) => HTMLElement

interface Route {
  pattern: string
  screen: Screen
}

const routes: Route[] = []
let mountPoint: HTMLElement | null = null

/** Confronta una rotta con un percorso, estraendo i parametri con i due punti. */
export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = path.split('/').filter(Boolean)
  if (patternParts.length !== pathParts.length) return null

  const params: Record<string, string> = {}
  for (const [i, part] of patternParts.entries()) {
    if (part.startsWith(':')) {
      params[part.slice(1)] = decodeURIComponent(pathParts[i])
    } else if (part !== pathParts[i]) {
      return null
    }
  }
  return params
}

export function registerRoute(pattern: string, screen: Screen): void {
  routes.push({ pattern, screen })
}

export function navigate(path: string): void {
  window.location.hash = `#${path}`
}

function currentPath(): string {
  const hash = window.location.hash.replace(/^#/, '')
  return hash || '/'
}

function handleRouteChange(): void {
  if (!mountPoint) return
  const path = currentPath()
  for (const route of routes) {
    const params = matchRoute(route.pattern, path)
    if (params) {
      render(mountPoint, route.screen(params))
      window.scrollTo(0, 0)
      return
    }
  }
  navigate('/')
}

export function startRouter(container: HTMLElement): void {
  mountPoint = container
  window.addEventListener('hashchange', handleRouteChange)
  handleRouteChange()
}
```

- [ ] **Step 5: Scrivere gli stili**

`src/styles/app.css`:

```css
:root {
  --bg: #0f172a;
  --surface: #1e293b;
  --surface-alt: #334155;
  --text: #f8fafc;
  --text-muted: #94a3b8;
  --accent: #22c55e;
  --accent-strong: #16a34a;
  --danger: #f87171;
  --radius: 14px;
  --touch: 52px;
  color-scheme: dark;
}

* {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 17px;
  overscroll-behavior-y: contain;
}

#app {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px 16px calc(24px + env(safe-area-inset-bottom));
  min-height: 100vh;
}

h1 { font-size: 1.5rem; margin: 8px 0 20px; }
h2 { font-size: 1.15rem; margin: 24px 0 12px; }

.card {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 12px;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: var(--touch);
  border: 0;
  border-radius: var(--radius);
  background: var(--surface-alt);
  color: var(--text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.btn--primary { background: var(--accent); color: #04210f; }
.btn--danger { background: transparent; color: var(--danger); border: 1px solid var(--danger); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn + .btn { margin-top: 10px; }

.row { display: flex; gap: 10px; align-items: center; }
.row--between { justify-content: space-between; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }

.muted { color: var(--text-muted); font-size: 0.9rem; }
.score { font-variant-numeric: tabular-nums; font-weight: 700; }
.score--big { font-size: 2rem; }

.progress {
  height: 6px;
  border-radius: 3px;
  background: var(--surface-alt);
  overflow: hidden;
}
.progress > span { display: block; height: 100%; background: var(--accent); }

.badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--surface-alt);
  font-size: 0.78rem;
  font-weight: 600;
}
.badge--warn { background: #7f1d1d; color: #fecaca; }

.alert {
  border-radius: var(--radius);
  padding: 12px 14px;
  margin-bottom: 12px;
  background: #7f1d1d;
  color: #fee2e2;
  font-size: 0.92rem;
}
.alert--info { background: var(--surface-alt); color: var(--text); }

.sticky-actions {
  position: sticky;
  bottom: 0;
  padding-top: 12px;
  background: linear-gradient(to top, var(--bg) 70%, transparent);
}

input[type='text'] {
  width: 100%;
  min-height: var(--touch);
  padding: 0 14px;
  border: 1px solid var(--surface-alt);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font: inherit;
}
```

- [ ] **Step 6: Aggiornare il bootstrap**

`src/main.ts`:

```ts
import './styles/app.css'
import { el } from './ui/dom'
import { registerRoute, startRouter } from './ui/router'

registerRoute('/', () => el('div', {}, el('h1', {}, 'Punti Burraco')))

const container = document.querySelector<HTMLDivElement>('#app')
if (!container) throw new Error('Contenitore #app non trovato')
startRouter(container)
```

- [ ] **Step 7: Eseguire i test e verificare che passino**

Run: `npm test`
Expected: PASS — inclusi i quattro test di `matchRoute`

- [ ] **Step 8: Verificare l'avvio dell'app**

Run: `npm run build`
Expected: build completata senza errori TypeScript

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(ui): struttura dell'interfaccia, routing via hash e tema mobile"
```

---

### Task 10: Componenti di input

**Files:**
- Create: `src/ui/components/numpad.ts`, `src/ui/components/stepper.ts`, `src/ui/components/toggle.ts`
- Test: `tests/ui/components.test.ts`

**Interfaces:**
- Consumes: `el` da `src/ui/dom.ts`
- Produces:
  - `createNumpad(options: { label: string; value: number; onChange: (value: number) => void }): HTMLElement` da `src/ui/components/numpad.ts`
  - `createStepper(options: { label: string; value: number; min?: number; max?: number; onChange: (value: number) => void }): HTMLElement` da `src/ui/components/stepper.ts`
  - `createToggle(options: { label: string; checked: boolean; onChange: (checked: boolean) => void }): HTMLElement` da `src/ui/components/toggle.ts`

**Comportamento richiesto:**
- Il tastierino accumula cifre (`285` si compone premendo 2, 8, 5), `⌫` cancella l'ultima cifra, `C` azzera. Ogni variazione chiama `onChange` con il valore numerico corrente.
- Il valore massimo accettato dal tastierino è 9999: cifre ulteriori vengono ignorate.
- Lo stepper non scende sotto `min` (default 0) né sale sopra `max` (default 9).

- [ ] **Step 1: Scrivere i test (falliranno)**

`tests/ui/components.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { createNumpad } from '../../src/ui/components/numpad'
import { createStepper } from '../../src/ui/components/stepper'
import { createToggle } from '../../src/ui/components/toggle'

function click(root: HTMLElement, label: string): void {
  const button = [...root.querySelectorAll('button')].find((b) => b.textContent === label)
  if (!button) throw new Error(`Pulsante "${label}" non trovato`)
  button.click()
}

describe('createNumpad', () => {
  it('compone il numero cifra per cifra', () => {
    const onChange = vi.fn()
    const pad = createNumpad({ label: 'Punti in tavola', value: 0, onChange })
    click(pad, '2')
    click(pad, '8')
    click(pad, '5')
    expect(onChange).toHaveBeenLastCalledWith(285)
    expect(pad.querySelector('[data-role="value"]')?.textContent).toBe('285')
  })

  it('cancella l ultima cifra', () => {
    const onChange = vi.fn()
    const pad = createNumpad({ label: 'Punti', value: 0, onChange })
    click(pad, '1')
    click(pad, '5')
    click(pad, '⌫')
    expect(onChange).toHaveBeenLastCalledWith(1)
  })

  it('azzera il valore', () => {
    const onChange = vi.fn()
    const pad = createNumpad({ label: 'Punti', value: 250, onChange })
    click(pad, 'C')
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('non supera le quattro cifre', () => {
    const onChange = vi.fn()
    const pad = createNumpad({ label: 'Punti', value: 0, onChange })
    for (const digit of ['1', '2', '3', '4', '5']) click(pad, digit)
    expect(onChange).toHaveBeenLastCalledWith(1234)
  })
})

describe('createStepper', () => {
  it('incrementa e decrementa restando nei limiti', () => {
    const onChange = vi.fn()
    const stepper = createStepper({ label: 'Burrachi puliti', value: 0, onChange })
    click(stepper, '−')
    expect(onChange).not.toHaveBeenCalled()
    click(stepper, '+')
    expect(onChange).toHaveBeenLastCalledWith(1)
    click(stepper, '−')
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('rispetta il massimo', () => {
    const onChange = vi.fn()
    const stepper = createStepper({ label: 'Burrachi', value: 9, max: 9, onChange })
    click(stepper, '+')
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('createToggle', () => {
  it('inverte lo stato a ogni pressione', () => {
    const onChange = vi.fn()
    const toggle = createToggle({ label: 'Ha chiuso', checked: false, onChange })
    toggle.querySelector('button')!.click()
    expect(onChange).toHaveBeenLastCalledWith(true)
  })

  it('espone lo stato con aria-pressed', () => {
    const toggle = createToggle({ label: 'Pozzetto preso', checked: true, onChange: () => {} })
    expect(toggle.querySelector('button')?.getAttribute('aria-pressed')).toBe('true')
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/ui/components.test.ts`
Expected: FAIL — moduli non trovati

- [ ] **Step 3: Implementare il tastierino**

`src/ui/components/numpad.ts`:

```ts
import { el } from '../dom'

const MAX_VALUE = 9999

export function createNumpad(options: {
  label: string
  value: number
  onChange: (value: number) => void
}): HTMLElement {
  let value = options.value

  const display = el('div', { class: 'score score--big', dataset: { role: 'value' } }, String(value))

  const setValue = (next: number): void => {
    value = next
    display.textContent = String(value)
    options.onChange(value)
  }

  const digitButton = (digit: string): HTMLElement =>
    el(
      'button',
      {
        class: 'btn',
        type: 'button',
        onClick: () => {
          const next = Number(`${value}${digit}`)
          if (next > MAX_VALUE) return
          setValue(next)
        },
      },
      digit,
    )

  return el(
    'div',
    { class: 'card' },
    el('div', { class: 'muted' }, options.label),
    display,
    el(
      'div',
      { class: 'grid-3' },
      ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digitButton),
      el(
        'button',
        {
          class: 'btn',
          type: 'button',
          onClick: () => setValue(Math.floor(value / 10)),
        },
        '⌫',
      ),
      digitButton('0'),
      el('button', { class: 'btn', type: 'button', onClick: () => setValue(0) }, 'C'),
    ),
  )
}
```

- [ ] **Step 4: Implementare stepper e toggle**

`src/ui/components/stepper.ts`:

```ts
import { el } from '../dom'

export function createStepper(options: {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
}): HTMLElement {
  const min = options.min ?? 0
  const max = options.max ?? 9
  let value = options.value

  const display = el('span', { class: 'score', dataset: { role: 'value' } }, String(value))

  const setValue = (next: number): void => {
    if (next < min || next > max) return
    value = next
    display.textContent = String(value)
    options.onChange(value)
  }

  return el(
    'div',
    { class: 'row row--between' },
    el('span', {}, options.label),
    el(
      'span',
      { class: 'row' },
      el('button', { class: 'btn', type: 'button', onClick: () => setValue(value - 1) }, '−'),
      display,
      el('button', { class: 'btn', type: 'button', onClick: () => setValue(value + 1) }, '+'),
    ),
  )
}
```

`src/ui/components/toggle.ts`:

```ts
import { el } from '../dom'

export function createToggle(options: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}): HTMLElement {
  let checked = options.checked

  const button = el(
    'button',
    {
      class: checked ? 'btn btn--primary' : 'btn',
      type: 'button',
      onClick: () => {
        checked = !checked
        button.className = checked ? 'btn btn--primary' : 'btn'
        button.setAttribute('aria-pressed', String(checked))
        options.onChange(checked)
      },
    },
    options.label,
  )
  button.setAttribute('aria-pressed', String(checked))

  return el('div', {}, button)
}
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `npm test`
Expected: PASS — tutti i test verdi

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): tastierino numerico, stepper e interruttori"
```

---

### Task 11: Schermata iniziale e creazione partita

**Files:**
- Create: `src/ui/deps.ts`, `src/ui/screens/home.ts`, `src/ui/screens/newGame.ts`
- Modify: `src/main.ts`
- Test: `tests/ui/newGame.test.ts`

**Interfaces:**
- Consumes: `createGame` da `src/engine/game.ts`; `replayGame` da `src/engine/standings.ts`; `loadState`, `upsertGame`, `upsertPlayer` da `src/storage/repository.ts`; `el` da `src/ui/dom.ts`; `navigate`, `registerRoute` da `src/ui/router.ts`
- Produces:
  - `appDeps: EngineDeps` da `src/ui/deps.ts`
  - `homeScreen: Screen` da `src/ui/screens/home.ts`
  - da `src/ui/screens/newGame.ts`:
    - `interface NewGameForm { mode: GameMode; names: string[]; teamSplit: [number, number][]; semipulitoEnabled: boolean }`
    - `validateNewGameForm(form: NewGameForm): string[]`
    - `buildGameFromForm(form: NewGameForm, deps: EngineDeps, playerIds: string[]): Game`
    - `newGameScreen: Screen`

**Comportamento richiesto:**
- La home mostra la partita in corso più recente, se esiste, con i punteggi attuali e il pulsante "Riprendi".
- Il wizard chiede in sequenza: numero giocatori, nomi, composizione squadre (solo a 4), variante semipulito.
- I nomi vuoti non sono ammessi; i nomi duplicati nella stessa partita nemmeno.
- Alla conferma i giocatori vengono inseriti in rubrica (o riusati) e la partita salvata; si passa alla schermata partita.

- [ ] **Step 1: Scrivere il test della costruzione partita (fallirà)**

`tests/ui/newGame.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildGameFromForm, validateNewGameForm } from '../../src/ui/screens/newGame'
import type { EngineDeps } from '../../src/engine/game'

function deps(): EngineDeps {
  let counter = 0
  return { newId: () => `id${++counter}`, now: () => '2026-08-19T12:00:00.000Z' }
}

describe('validateNewGameForm', () => {
  it('accetta una configurazione valida a 3 giocatori', () => {
    expect(
      validateNewGameForm({ mode: 3, names: ['Ann', 'Bob', 'Cid'], teamSplit: [], semipulitoEnabled: true }),
    ).toEqual([])
  })

  it('rifiuta i nomi vuoti', () => {
    const errors = validateNewGameForm({
      mode: 2,
      names: ['Ann', '  '],
      teamSplit: [],
      semipulitoEnabled: true,
    })
    expect(errors[0]).toMatch(/nome/i)
  })

  it('rifiuta i nomi duplicati', () => {
    const errors = validateNewGameForm({
      mode: 2,
      names: ['Ann', 'ann'],
      teamSplit: [],
      semipulitoEnabled: true,
    })
    expect(errors[0]).toMatch(/diversi/i)
  })
})

describe('buildGameFromForm', () => {
  it('costruisce una partita a 4 giocatori con le squadre indicate', () => {
    const game = buildGameFromForm(
      {
        mode: 4,
        names: ['Ann', 'Bob', 'Cid', 'Dan'],
        teamSplit: [
          [0, 2],
          [1, 3],
        ],
        semipulitoEnabled: false,
      },
      deps(),
      ['pa', 'pb', 'pc', 'pd'],
    )
    expect(game.mode).toBe(4)
    expect(game.teams[0].playerIds).toEqual(['pa', 'pc'])
    expect(game.teams[1].playerIds).toEqual(['pb', 'pd'])
    expect(game.teams[0].name).toBe('Ann e Cid')
    expect(game.options.semipulitoEnabled).toBe(false)
  })

  it('costruisce una partita a 2 giocatori senza squadre', () => {
    const game = buildGameFromForm(
      { mode: 2, names: ['Ann', 'Bob'], teamSplit: [], semipulitoEnabled: true },
      deps(),
      ['pa', 'pb'],
    )
    expect(game.teams).toEqual([])
    expect(game.players.map((p) => p.name)).toEqual(['Ann', 'Bob'])
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npm test -- tests/ui/newGame.test.ts`
Expected: FAIL — modulo non trovato

- [ ] **Step 3: Implementare le dipendenze applicative**

`src/ui/deps.ts`:

```ts
import type { EngineDeps } from '../engine/game'

/** Dipendenze impure reali usate dall'applicazione. */
export const appDeps: EngineDeps = {
  newId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
}
```

- [ ] **Step 4: Implementare la creazione partita**

`src/ui/screens/newGame.ts`:

```ts
import { createGame, type EngineDeps } from '../../engine/game'
import type { Game, GameMode } from '../../engine/types'
import { upsertGame, upsertPlayer } from '../../storage/repository'
import { appDeps } from '../deps'
import { el } from '../dom'
import { navigate, type Screen } from '../router'

export interface NewGameForm {
  mode: GameMode
  names: string[]
  /** Coppie di indici dei nomi che formano le due squadre; usato solo a 4 giocatori. */
  teamSplit: [number, number][]
  semipulitoEnabled: boolean
}

export function validateNewGameForm(form: NewGameForm): string[] {
  const errors: string[] = []
  const trimmed = form.names.map((n) => n.trim())

  if (trimmed.length !== form.mode || trimmed.some((n) => n.length === 0)) {
    errors.push(`Inserisci il nome di tutti e ${form.mode} i giocatori.`)
    return errors
  }

  const normalized = trimmed.map((n) => n.toLocaleLowerCase('it'))
  if (new Set(normalized).size !== normalized.length) {
    errors.push('I giocatori devono avere nomi diversi fra loro.')
  }

  if (form.mode === 4 && form.teamSplit.length !== 2) {
    errors.push('Componi le due squadre.')
  }

  return errors
}

/** Costruisce la partita a partire dal modulo compilato e dagli identificativi dei giocatori. */
export function buildGameFromForm(
  form: NewGameForm,
  deps: EngineDeps,
  playerIds: string[],
): Game {
  const names = form.names.map((n) => n.trim())
  const players = names.map((name, i) => ({ playerId: playerIds[i], name }))

  const teams =
    form.mode === 4
      ? form.teamSplit.map(([a, b]) => ({
          name: `${names[a]} e ${names[b]}`,
          playerIds: [playerIds[a], playerIds[b]] as [string, string],
        }))
      : undefined

  return createGame({ mode: form.mode, players, teams, options: { semipulitoEnabled: form.semipulitoEnabled } }, deps)
}

/** Schermata a passi per la creazione di una nuova partita. */
export const newGameScreen: Screen = () => {
  const form: NewGameForm = { mode: 4, names: ['', '', '', ''], teamSplit: [[0, 1], [2, 3]], semipulitoEnabled: true }
  const container = el('div', {})

  const setMode = (mode: GameMode): void => {
    form.mode = mode
    form.names = Array.from({ length: mode }, (_, i) => form.names[i] ?? '')
    form.teamSplit = mode === 4 ? [[0, 1], [2, 3]] : []
    draw()
  }

  const rotateTeams = (): void => {
    // Le tre composizioni possibili di due squadre da due giocatori.
    const options: [number, number][][] = [
      [[0, 1], [2, 3]],
      [[0, 2], [1, 3]],
      [[0, 3], [1, 2]],
    ]
    const current = options.findIndex((o) => JSON.stringify(o) === JSON.stringify(form.teamSplit))
    form.teamSplit = options[(current + 1) % options.length]
    draw()
  }

  const start = (): void => {
    const errors = validateNewGameForm(form)
    if (errors.length > 0) {
      draw(errors)
      return
    }
    const playerIds = form.names.map((name) => upsertPlayer(name, appDeps.newId, appDeps.now).player.id)
    const game = buildGameFromForm(form, appDeps, playerIds)
    upsertGame(game)
    navigate(`/partita/${game.id}`)
  }

  function draw(errors: string[] = []): void {
    const modeButtons = ([2, 3, 4] as GameMode[]).map((mode) =>
      el(
        'button',
        {
          class: form.mode === mode ? 'btn btn--primary' : 'btn',
          type: 'button',
          onClick: () => setMode(mode),
        },
        `${mode} giocatori`,
      ),
    )

    const nameInputs = form.names.map((value, index) => {
      const input = el('input', { type: 'text', value, placeholder: `Giocatore ${index + 1}` })
      input.addEventListener('input', () => {
        form.names[index] = input.value
      })
      return el('div', { class: 'card' }, input)
    })

    const teamsSection =
      form.mode === 4
        ? el(
            'div',
            { class: 'card' },
            el('div', { class: 'muted' }, 'Squadre'),
            el(
              'div',
              {},
              ...form.teamSplit.map(([a, b]) =>
                el('div', {}, `${form.names[a] || `Giocatore ${a + 1}`} e ${form.names[b] || `Giocatore ${b + 1}`}`),
              ),
            ),
            el('button', { class: 'btn', type: 'button', onClick: rotateTeams }, 'Cambia accoppiamento'),
          )
        : null

    container.replaceChildren(
      el('h1', {}, 'Nuova partita'),
      ...errors.map((message) => el('div', { class: 'alert' }, message)),
      el('div', { class: 'grid-3' }, ...modeButtons),
      el('h2', {}, 'Giocatori'),
      ...nameInputs,
      teamsSection,
      el('h2', {}, 'Regole'),
      el(
        'div',
        { class: 'card' },
        el(
          'button',
          {
            class: form.semipulitoEnabled ? 'btn btn--primary' : 'btn',
            type: 'button',
            onClick: () => {
              form.semipulitoEnabled = !form.semipulitoEnabled
              draw()
            },
          },
          'Burraco semipulito (150)',
        ),
        el('div', { class: 'muted' }, 'Obiettivo partita: 2005 punti'),
      ),
      el(
        'div',
        { class: 'sticky-actions' },
        el('button', { class: 'btn btn--primary', type: 'button', onClick: start }, 'Inizia la partita'),
        el('button', { class: 'btn', type: 'button', onClick: () => navigate('/') }, 'Annulla'),
      ),
    )
  }

  draw()
  return container
}
```

- [ ] **Step 5: Implementare la schermata iniziale**

`src/ui/screens/home.ts`:

```ts
import { replayGame } from '../../engine/standings'
import { loadState } from '../../storage/repository'
import { el } from '../dom'
import { navigate, type Screen } from '../router'

export const homeScreen: Screen = () => {
  const state = loadState()
  const ongoing = state.games
    .filter((g) => g.status === 'in_progress')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]

  const resumeCard = ongoing
    ? el(
        'div',
        { class: 'card' },
        el('div', { class: 'muted' }, `Partita a ${ongoing.mode} giocatori · ${ongoing.hands.length} smazzate`),
        ...replayGame(ongoing).standings.map((standing) =>
          el(
            'div',
            { class: 'row row--between' },
            el('span', {}, standing.label),
            el('span', { class: 'score' }, String(standing.points)),
          ),
        ),
        el(
          'button',
          { class: 'btn btn--primary', type: 'button', onClick: () => navigate(`/partita/${ongoing.id}`) },
          'Riprendi',
        ),
      )
    : el('div', { class: 'card muted' }, 'Nessuna partita in corso.')

  return el(
    'div',
    {},
    el('h1', {}, 'Punti Burraco'),
    resumeCard,
    el('button', { class: 'btn btn--primary', type: 'button', onClick: () => navigate('/nuova') }, 'Nuova partita'),
    el('button', { class: 'btn', type: 'button', onClick: () => navigate('/storico') }, 'Storico'),
    el('button', { class: 'btn', type: 'button', onClick: () => navigate('/giocatori') }, 'Giocatori'),
  )
}
```

- [ ] **Step 6: Registrare le rotte**

`src/main.ts`:

```ts
import './styles/app.css'
import { registerRoute, startRouter } from './ui/router'
import { homeScreen } from './ui/screens/home'
import { newGameScreen } from './ui/screens/newGame'

registerRoute('/', homeScreen)
registerRoute('/nuova', newGameScreen)

const container = document.querySelector<HTMLDivElement>('#app')
if (!container) throw new Error('Contenitore #app non trovato')
startRouter(container)
```

- [ ] **Step 7: Eseguire i test e la build**

Run: `npm test && npm run build`
Expected: PASS e build completata

- [ ] **Step 8: Verificare a mano nel browser**

Run: `npm run dev`
Verificare: la home mostra "Nessuna partita in corso", il wizard permette di scegliere 2/3/4 giocatori, i nomi vuoti producono un messaggio di errore, e al salvataggio si arriva su una rotta `#/partita/<id>` (schermata ancora assente: verrà nel task successivo).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(ui): schermata iniziale e wizard di creazione partita"
```

---

### Task 12: Schermata della partita in corso

**Files:**
- Create: `src/ui/components/scoreboard.ts`, `src/ui/screens/game.ts`
- Modify: `src/main.ts`
- Test: `tests/ui/scoreboard.test.ts`

**Interfaces:**
- Consumes: `replayGame`, `Standing`, `GameProgress` da `src/engine/standings.ts`; `deleteHand` da `src/engine/game.ts`; `getGame`, `upsertGame` da `src/storage/repository.ts`
- Produces:
  - `createScoreboard(progress: GameProgress, targetScore: number): HTMLElement` da `src/ui/components/scoreboard.ts`
  - `gameScreen: Screen` da `src/ui/screens/game.ts`

**Comportamento richiesto:**
- Il tabellone mostra ogni conto con punteggio e barra di avanzamento verso 2005 (la barra non supera il 100%).
- A tre giocatori compare un badge con la fase corrente: "Fase 1 · uno contro due" oppure "Fase 2 · tutti contro tutti".
- Ogni smazzata è elencata con il punteggio per entità e, a tre giocatori in fase 1, il nome del solista; le smazzate da correggere sono evidenziate con il motivo.
- Le azioni per smazzata sono "Modifica" ed "Elimina" (con conferma esplicita in pagina, non con `confirm()`).
- Se la partita è conclusa, al posto del pulsante "Nuova smazzata" compare l'esito con il vincitore.

- [ ] **Step 1: Scrivere il test del tabellone (fallirà)**

`tests/ui/scoreboard.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createScoreboard } from '../../src/ui/components/scoreboard'
import type { GameProgress } from '../../src/engine/standings'

function progress(points: number[], nextPhase: 1 | 2 = 1): GameProgress {
  return {
    hands: [],
    standings: points.map((p, i) => ({
      accountId: `a${i}`,
      label: `Conto ${i}`,
      kind: 'player' as const,
      playerIds: [`p${i}`],
      points: p,
    })),
    nextPhase,
    finished: false,
    winnerIds: [],
    hasIssues: false,
  }
}

describe('createScoreboard', () => {
  it('mostra i punteggi di tutti i conti', () => {
    const board = createScoreboard(progress([1200, 800]), 2005)
    const scores = [...board.querySelectorAll('[data-role="points"]')].map((n) => n.textContent)
    expect(scores).toEqual(['1200', '800'])
  })

  it('rappresenta l avanzamento in percentuale dell obiettivo', () => {
    const board = createScoreboard(progress([1002]), 2005)
    const bar = board.querySelector<HTMLElement>('.progress > span')
    expect(bar?.style.width).toBe('50%')
  })

  it('non supera il 100 per cento oltre l obiettivo', () => {
    const board = createScoreboard(progress([2400]), 2005)
    expect(board.querySelector<HTMLElement>('.progress > span')?.style.width).toBe('100%')
  })

  it('gestisce i punteggi negativi senza barre negative', () => {
    const board = createScoreboard(progress([-150]), 2005)
    expect(board.querySelector<HTMLElement>('.progress > span')?.style.width).toBe('0%')
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npm test -- tests/ui/scoreboard.test.ts`
Expected: FAIL — modulo non trovato

- [ ] **Step 3: Implementare il tabellone**

`src/ui/components/scoreboard.ts`:

```ts
import type { GameProgress } from '../../engine/standings'
import { el } from '../dom'

export function createScoreboard(progress: GameProgress, targetScore: number): HTMLElement {
  const rows = progress.standings.map((standing) => {
    const ratio = Math.min(100, Math.max(0, Math.round((standing.points / targetScore) * 100)))
    const bar = el('span', {})
    bar.style.width = `${ratio}%`

    return el(
      'div',
      { class: 'card' },
      el(
        'div',
        { class: 'row row--between' },
        el('span', {}, standing.label),
        el('span', { class: 'score', dataset: { role: 'points' } }, String(standing.points)),
      ),
      el('div', { class: 'progress' }, bar),
    )
  })

  return el('div', {}, ...rows)
}
```

- [ ] **Step 4: Implementare la schermata partita**

`src/ui/screens/game.ts`:

```ts
import { deleteHand } from '../../engine/game'
import { replayGame } from '../../engine/standings'
import { getGame, upsertGame } from '../../storage/repository'
import { createScoreboard } from '../components/scoreboard'
import { appDeps } from '../deps'
import { el } from '../dom'
import { navigate, type Screen } from '../router'

export const gameScreen: Screen = (params) => {
  const container = el('div', {})
  let pendingDeleteId: string | null = null

  function draw(): void {
    const game = getGame(params.gameId)
    if (!game) {
      container.replaceChildren(
        el('div', { class: 'alert' }, 'Partita non trovata.'),
        el('button', { class: 'btn', type: 'button', onClick: () => navigate('/') }, 'Torna alla home'),
      )
      return
    }

    const progress = replayGame(game)

    const phaseBadge =
      game.mode === 3
        ? el(
            'span',
            { class: 'badge' },
            progress.nextPhase === 1 ? 'Fase 1 · uno contro due' : 'Fase 2 · tutti contro tutti',
          )
        : null

    const handCards = game.hands.map((hand, index) => {
      const result = progress.hands[index]
      const solista =
        result.phase === 1 && game.mode === 3 && hand.soloPlayerId
          ? game.players.find((p) => p.playerId === hand.soloPlayerId)?.name
          : null

      const detail = result.valid
        ? result.scores.map((score) =>
            el(
              'div',
              { class: 'row row--between' },
              el('span', {}, result.entities.find((e) => e.id === score.entityId)?.label ?? score.entityId),
              el('span', { class: 'score' }, String(score.total)),
            ),
          )
        : [el('div', { class: 'alert' }, result.issue ?? 'Smazzata da correggere')]

      const actions =
        pendingDeleteId === hand.id
          ? [
              el(
                'button',
                {
                  class: 'btn btn--danger',
                  type: 'button',
                  onClick: () => {
                    upsertGame(deleteHand(game, hand.id, appDeps))
                    pendingDeleteId = null
                    draw()
                  },
                },
                'Confermi l eliminazione?',
              ),
              el(
                'button',
                {
                  class: 'btn',
                  type: 'button',
                  onClick: () => {
                    pendingDeleteId = null
                    draw()
                  },
                },
                'Annulla',
              ),
            ]
          : [
              el(
                'div',
                { class: 'grid-2' },
                el(
                  'button',
                  {
                    class: 'btn',
                    type: 'button',
                    onClick: () => navigate(`/partita/${game.id}/smazzata/${hand.id}`),
                  },
                  'Modifica',
                ),
                el(
                  'button',
                  {
                    class: 'btn btn--danger',
                    type: 'button',
                    onClick: () => {
                      pendingDeleteId = hand.id
                      draw()
                    },
                  },
                  'Elimina',
                ),
              ),
            ]

      return el(
        'div',
        { class: 'card' },
        el(
          'div',
          { class: 'row row--between' },
          el('strong', {}, `Smazzata ${index + 1}`),
          solista ? el('span', { class: 'badge' }, `Solo: ${solista}`) : null,
        ),
        ...detail,
        ...actions,
      )
    })

    const footer = game.status === 'completed'
      ? el(
          'div',
          { class: 'card' },
          el('h2', {}, 'Partita conclusa'),
          el(
            'div',
            {},
            `Vince ${progress.standings.find((s) => s.accountId === game.winnerIds[0])?.label ?? ''}`,
          ),
          el('button', { class: 'btn', type: 'button', onClick: () => navigate('/') }, 'Torna alla home'),
        )
      : el(
          'div',
          { class: 'sticky-actions' },
          el(
            'button',
            {
              class: 'btn btn--primary',
              type: 'button',
              onClick: () => navigate(`/partita/${game.id}/smazzata`),
            },
            'Nuova smazzata',
          ),
          el('button', { class: 'btn', type: 'button', onClick: () => navigate('/') }, 'Home'),
        )

    container.replaceChildren(
      el('div', { class: 'row row--between' }, el('h1', {}, 'Partita'), phaseBadge),
      progress.hasIssues
        ? el('div', { class: 'alert' }, 'Alcune smazzate sono da correggere e non sono conteggiate.')
        : null,
      createScoreboard(progress, game.targetScore),
      el('h2', {}, 'Smazzate'),
      ...(handCards.length > 0 ? handCards : [el('div', { class: 'card muted' }, 'Nessuna smazzata registrata.')]),
      footer,
    )
  }

  draw()
  return container
}
```

- [ ] **Step 5: Registrare la rotta**

Aggiungere in `src/main.ts`, dopo le rotte esistenti:

```ts
import { gameScreen } from './ui/screens/game'

registerRoute('/partita/:gameId', gameScreen)
```

- [ ] **Step 6: Eseguire test e build**

Run: `npm test && npm run build`
Expected: PASS e build completata

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ui): schermata della partita con tabellone ed elenco smazzate"
```

---

### Task 13: Inserimento e modifica di una smazzata

**Files:**
- Create: `src/ui/screens/handForm.ts`
- Modify: `src/main.ts`
- Test: `tests/ui/handForm.test.ts`

**Interfaces:**
- Consumes: `resolveEntities` da `src/engine/entities.ts`; `scoreEntry` da `src/engine/scoring.ts`; `validateHandEntries`, `hasBlockingViolations` da `src/engine/validation.ts`; `replayGame` da `src/engine/standings.ts`; `addHand`, `updateHand` da `src/engine/game.ts`; componenti del Task 10
- Produces:
  - `emptyEntry(entityId: string): HandEntry`
  - `handFormScreen: Screen`
  - da `src/ui/screens/handForm.ts`

**Comportamento richiesto:**
- A tre giocatori in fase 1 il primo passo è la scelta del solista; finché non è scelto, i pannelli delle entità non compaiono.
- Un pannello per entità con: interruttore "Ha chiuso", interruttore "Pozzetto preso" (predefinito acceso), stepper per burrachi puliti, semipuliti (solo se la variante è attiva) e sporchi, tastierino per punti in tavola e per punti in mano.
- Il totale della smazzata per ogni entità si aggiorna a ogni modifica.
- Attivare "Ha chiuso" su una entità lo spegne automaticamente sulle altre e azzera i suoi punti in mano.
- Il pulsante di salvataggio è disabilitato finché esistono violazioni bloccanti, elencate in chiaro sopra i pannelli; gli avvisi non bloccanti sono mostrati ma non impediscono il salvataggio.
- Nella fase 1 a tre giocatori il solista non ha l'interruttore del pozzetto: lo ha preso per definizione, quindi il malus di −100 può ricadere solo sulla coppia.
- In modifica, il modulo si apre precompilato con i valori esistenti e salva con `updateHand`.

- [ ] **Step 1: Scrivere il test (fallirà)**

`tests/ui/handForm.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { emptyEntry } from '../../src/ui/screens/handForm'

describe('emptyEntry', () => {
  it('crea una dichiarazione azzerata con il pozzetto preso', () => {
    expect(emptyEntry('p1')).toEqual({
      entityId: 'p1',
      closed: false,
      tookPot: true,
      cleanBurracos: 0,
      semiCleanBurracos: 0,
      dirtyBurracos: 0,
      tablePoints: 0,
      handPoints: 0,
    })
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npm test -- tests/ui/handForm.test.ts`
Expected: FAIL — modulo non trovato

- [ ] **Step 3: Implementare il modulo di inserimento**

`src/ui/screens/handForm.ts`:

```ts
import { resolveEntities } from '../../engine/entities'
import { addHand, updateHand } from '../../engine/game'
import { scoreEntry } from '../../engine/scoring'
import { replayGame } from '../../engine/standings'
import type { HandEntry, ScoringEntity } from '../../engine/types'
import { hasBlockingViolations, validateHandEntries } from '../../engine/validation'
import { getGame, upsertGame } from '../../storage/repository'
import { createNumpad } from '../components/numpad'
import { createStepper } from '../components/stepper'
import { createToggle } from '../components/toggle'
import { appDeps } from '../deps'
import { el } from '../dom'
import { navigate, type Screen } from '../router'

export function emptyEntry(entityId: string): HandEntry {
  return {
    entityId,
    closed: false,
    tookPot: true,
    cleanBurracos: 0,
    semiCleanBurracos: 0,
    dirtyBurracos: 0,
    tablePoints: 0,
    handPoints: 0,
  }
}

export const handFormScreen: Screen = (params) => {
  const container = el('div', {})
  const game = getGame(params.gameId)

  if (!game) {
    container.replaceChildren(
      el('div', { class: 'alert' }, 'Partita non trovata.'),
      el('button', { class: 'btn', type: 'button', onClick: () => navigate('/') }, 'Torna alla home'),
    )
    return container
  }

  const editing = params.handId ? game.hands.find((h) => h.id === params.handId) ?? null : null
  const progress = replayGame(game)
  const phase = editing
    ? progress.hands.find((h) => h.handId === editing.id)?.phase ?? progress.nextPhase
    : progress.nextPhase

  let soloPlayerId: string | null = editing?.soloPlayerId ?? null
  let entries: HandEntry[] = editing ? editing.entries.map((e) => ({ ...e })) : []

  const needsSolo = game.mode === 3 && phase === 1

  function entities(): ScoringEntity[] {
    return resolveEntities(game!, phase, soloPlayerId)
  }

  function syncEntries(): void {
    const ids = entities().map((e) => e.id)
    entries = ids.map((id) => entries.find((e) => e.entityId === id) ?? emptyEntry(id))
  }

  function setClosed(entityId: string, closed: boolean): void {
    entries = entries.map((entry) =>
      entry.entityId === entityId
        ? { ...entry, closed, handPoints: closed ? 0 : entry.handPoints }
        : { ...entry, closed: closed ? false : entry.closed },
    )
    draw()
  }

  function update(entityId: string, patch: Partial<HandEntry>): void {
    entries = entries.map((entry) => (entry.entityId === entityId ? { ...entry, ...patch } : entry))
    refreshTotals()
  }

  const totalNodes = new Map<string, HTMLElement>()

  function refreshTotals(): void {
    for (const entry of entries) {
      const node = totalNodes.get(entry.entityId)
      if (node) node.textContent = String(scoreEntry(entry, game!.options).total)
    }
  }

  function save(): void {
    const input = { soloPlayerId: needsSolo ? soloPlayerId : null, entries }
    const updated = editing
      ? updateHand(game!, editing.id, input, appDeps)
      : addHand(game!, input, appDeps)
    upsertGame(updated)
    navigate(`/partita/${game!.id}`)
  }

  function soloSelector(): HTMLElement {
    return el(
      'div',
      { class: 'card' },
      el('div', { class: 'muted' }, 'Chi ha giocato da solo in questa smazzata?'),
      ...game!.players.map((player) =>
        el(
          'button',
          {
            class: soloPlayerId === player.playerId ? 'btn btn--primary' : 'btn',
            type: 'button',
            onClick: () => {
              soloPlayerId = player.playerId
              entries = []
              draw()
            },
          },
          player.name,
        ),
      ),
    )
  }

  /** Nella fase 1 a tre giocatori il solista è tale perché ha preso per primo il pozzetto. */
  function isSolista(entity: ScoringEntity): boolean {
    return needsSolo && entity.kind === 'player'
  }

  function entityPanel(entity: ScoringEntity): HTMLElement {
    const entry = entries.find((e) => e.entityId === entity.id)!
    if (isSolista(entity) && !entry.tookPot) {
      entry.tookPot = true
    }
    const total = el('span', { class: 'score score--big' }, String(scoreEntry(entry, game!.options).total))
    totalNodes.set(entity.id, total)

    return el(
      'div',
      { class: 'card' },
      el('div', { class: 'row row--between' }, el('h2', {}, entity.label), total),
      createToggle({
        label: 'Ha chiuso',
        checked: entry.closed,
        onChange: (checked) => setClosed(entity.id, checked),
      }),
      isSolista(entity)
        ? el('div', { class: 'muted' }, 'Il solista ha preso il pozzetto da 18 per definizione.')
        : createToggle({
            label: 'Pozzetto preso',
            checked: entry.tookPot,
            onChange: (checked) => update(entity.id, { tookPot: checked }),
          }),
      createStepper({
        label: 'Burrachi puliti',
        value: entry.cleanBurracos,
        onChange: (value) => update(entity.id, { cleanBurracos: value }),
      }),
      game!.options.semipulitoEnabled
        ? createStepper({
            label: 'Burrachi semipuliti',
            value: entry.semiCleanBurracos,
            onChange: (value) => update(entity.id, { semiCleanBurracos: value }),
          })
        : null,
      createStepper({
        label: 'Burrachi sporchi',
        value: entry.dirtyBurracos,
        onChange: (value) => update(entity.id, { dirtyBurracos: value }),
      }),
      createNumpad({
        label: 'Punti carte in tavola',
        value: entry.tablePoints,
        onChange: (value) => update(entity.id, { tablePoints: value }),
      }),
      entry.closed
        ? el('div', { class: 'muted' }, 'Ha chiuso: nessuna carta in mano.')
        : createNumpad({
            label: 'Punti carte in mano',
            value: entry.handPoints,
            onChange: (value) => update(entity.id, { handPoints: value }),
          }),
    )
  }

  function draw(): void {
    totalNodes.clear()

    if (needsSolo && !soloPlayerId) {
      container.replaceChildren(
        el('h1', {}, editing ? 'Modifica smazzata' : 'Nuova smazzata'),
        soloSelector(),
        el('button', { class: 'btn', type: 'button', onClick: () => navigate(`/partita/${game!.id}`) }, 'Annulla'),
      )
      return
    }

    syncEntries()
    const currentEntities = entities()
    const violations = validateHandEntries(entries, currentEntities)
    const blocked = hasBlockingViolations(violations)

    const saveButton = el(
      'button',
      { class: 'btn btn--primary', type: 'button', onClick: save },
      editing ? 'Salva le modifiche' : 'Salva smazzata',
    )
    saveButton.disabled = blocked

    container.replaceChildren(
      el('h1', {}, editing ? 'Modifica smazzata' : 'Nuova smazzata'),
      needsSolo ? soloSelector() : null,
      ...violations.map((v) => el('div', { class: v.blocking ? 'alert' : 'alert alert--info' }, v.message)),
      ...currentEntities.map(entityPanel),
      el(
        'div',
        { class: 'sticky-actions' },
        saveButton,
        el('button', { class: 'btn', type: 'button', onClick: () => navigate(`/partita/${game!.id}`) }, 'Annulla'),
      ),
    )
  }

  draw()
  return container
}
```

Nota per chi implementa: gli interruttori e gli stepper ridisegnano l'intera schermata solo quando cambia la chiusura (che influenza gli altri pannelli). Per le altre modifiche si aggiorna il solo totale, così il tastierino non perde lo stato mentre si digita.

- [ ] **Step 4: Registrare le rotte**

Aggiungere in `src/main.ts`:

```ts
import { handFormScreen } from './ui/screens/handForm'

registerRoute('/partita/:gameId/smazzata', handFormScreen)
registerRoute('/partita/:gameId/smazzata/:handId', handFormScreen)
```

- [ ] **Step 5: Eseguire test e build**

Run: `npm test && npm run build`
Expected: PASS e build completata

- [ ] **Step 6: Verifica manuale del percorso completo**

Run: `npm run dev`

Verificare in ordine:
1. partita a 2 giocatori, prima smazzata: attivando "Ha chiuso" senza burrachi il salvataggio resta disabilitato e appare il messaggio sul burraco;
2. aggiungendo un burraco pulito il salvataggio si sblocca e il totale mostra tavola + 200 + 100;
3. spegnendo "Pozzetto preso" su chi chiude ricompare il blocco;
4. dopo il salvataggio, la schermata partita mostra la smazzata e i punteggi aggiornati;
5. partita a 3 giocatori: la prima schermata chiede il solista e i pannelli sono due (solista e coppia).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ui): inserimento e modifica delle smazzate con validazione in tempo reale"
```

---

### Task 14: Riepilogo di fine smazzata, cambio fase e vittoria

**Files:**
- Create: `src/engine/summary.ts`, `src/ui/screens/handSummary.ts`
- Modify: `src/ui/screens/handForm.ts` (destinazione dopo il salvataggio), `src/main.ts`
- Test: `tests/engine/summary.test.ts`

**Interfaces:**
- Consumes: `replayGame` da `src/engine/standings.ts`; tipi da `src/engine/types.ts`
- Produces:
  - `interface HandSummary { handId: string; index: number; rows: { accountId: string; label: string; delta: number; total: number }[]; phaseChanged: boolean; finished: boolean; winnerLabel: string | null }`
  - `summarizeHand(game: Game, handId: string): HandSummary | null`
  - da `src/engine/summary.ts`
  - `handSummaryScreen: Screen` da `src/ui/screens/handSummary.ts`

**Comportamento richiesto:**
- `summarizeHand` restituisce `null` se la smazzata non esiste.
- `phaseChanged` è vero solo se quella smazzata ha fatto passare la partita a tre dalla fase 1 alla fase 2.
- `finished` e `winnerLabel` riguardano lo stato al termine dell'ultima smazzata registrata.
- Dopo il salvataggio, `handForm` porta al riepilogo invece che direttamente alla partita.

- [ ] **Step 1: Scrivere i test (falliranno)**

`tests/engine/summary.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { summarizeHand } from '../../src/engine/summary'
import type { Game, Hand, HandEntry } from '../../src/engine/types'

function entry(entityId: string, overrides: Partial<HandEntry> = {}): HandEntry {
  return {
    entityId,
    closed: false,
    tookPot: true,
    cleanBurracos: 0,
    semiCleanBurracos: 0,
    dirtyBurracos: 0,
    tablePoints: 0,
    handPoints: 0,
    ...overrides,
  }
}

function hand(id: string, entries: HandEntry[], soloPlayerId: string | null = null): Hand {
  return { id, soloPlayerId, entries, createdAt: '2026-08-19T11:00:00.000Z' }
}

function game(mode: 2 | 3, hands: Hand[], status: 'in_progress' | 'completed' = 'in_progress'): Game {
  const names = ['Ann', 'Bob', 'Cid'].slice(0, mode)
  return {
    id: 'g1',
    mode,
    options: { semipulitoEnabled: true },
    targetScore: 2005,
    players: names.map((name, i) => ({ playerId: `p${i + 1}`, name, seat: i })),
    teams: [],
    hands,
    status,
    winnerIds: [],
    createdAt: '2026-08-19T10:00:00.000Z',
    updatedAt: '2026-08-19T12:00:00.000Z',
  }
}

describe('summarizeHand', () => {
  it('restituisce null se la smazzata non esiste', () => {
    expect(summarizeHand(game(2, []), 'assente')).toBeNull()
  })

  it('riporta il delta della smazzata e il totale raggiunto', () => {
    const g = game(2, [
      hand('h1', [entry('p1', { tablePoints: 300 }), entry('p2', { tablePoints: 100 })]),
      hand('h2', [entry('p1', { tablePoints: 200 }), entry('p2', { tablePoints: 150 })]),
    ])
    const summary = summarizeHand(g, 'h2')!
    expect(summary.index).toBe(1)
    const ann = summary.rows.find((r) => r.accountId === 'p1')!
    expect(ann.delta).toBe(200)
    expect(ann.total).toBe(500)
  })

  it('segnala il passaggio alla fase 2 nella smazzata che lo provoca', () => {
    const g = game(3, [
      hand('h1', [entry('p2', { tablePoints: 400 }), entry('pair:p1-p3', { tablePoints: 100 })], 'p2'),
      hand('h2', [entry('p2', { tablePoints: 700 }), entry('pair:p1-p3', { tablePoints: 100 })], 'p2'),
    ])
    expect(summarizeHand(g, 'h1')!.phaseChanged).toBe(false)
    expect(summarizeHand(g, 'h2')!.phaseChanged).toBe(true)
  })

  it('riporta la vittoria quando la partita è conclusa', () => {
    const g = game(2, [hand('h1', [entry('p1', { tablePoints: 2100 }), entry('p2', { tablePoints: 100 })])])
    const summary = summarizeHand(g, 'h1')!
    expect(summary.finished).toBe(true)
    expect(summary.winnerLabel).toBe('Ann')
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/engine/summary.test.ts`
Expected: FAIL — modulo non trovato

- [ ] **Step 3: Implementare il riepilogo**

`src/engine/summary.ts`:

```ts
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
  }
}
```

- [ ] **Step 4: Implementare la schermata di riepilogo**

`src/ui/screens/handSummary.ts`:

```ts
import { summarizeHand } from '../../engine/summary'
import { getGame } from '../../storage/repository'
import { el } from '../dom'
import { navigate, type Screen } from '../router'

export const handSummaryScreen: Screen = (params) => {
  const game = getGame(params.gameId)
  const summary = game ? summarizeHand(game, params.handId) : null

  if (!game || !summary) {
    return el(
      'div',
      {},
      el('div', { class: 'alert' }, 'Riepilogo non disponibile.'),
      el('button', { class: 'btn', type: 'button', onClick: () => navigate('/') }, 'Torna alla home'),
    )
  }

  const rows = summary.rows.map((row) =>
    el(
      'div',
      { class: 'card' },
      el(
        'div',
        { class: 'row row--between' },
        el('span', {}, row.label),
        el('span', { class: 'score score--big' }, String(row.total)),
      ),
      el('div', { class: 'muted' }, `${row.delta >= 0 ? '+' : ''}${row.delta} in questa smazzata`),
    ),
  )

  return el(
    'div',
    {},
    el('h1', {}, `Smazzata ${summary.index + 1}`),
    summary.phaseChanged
      ? el(
          'div',
          { class: 'alert alert--info' },
          'Superati i 1000 punti: dalla prossima smazzata si gioca tutti contro tutti.',
        )
      : null,
    summary.finished
      ? el('div', { class: 'alert alert--info' }, `Partita conclusa. Vince ${summary.winnerLabel ?? ''}.`)
      : null,
    ...rows,
    el(
      'div',
      { class: 'sticky-actions' },
      summary.finished
        ? el('button', { class: 'btn btn--primary', type: 'button', onClick: () => navigate('/') }, 'Torna alla home')
        : el(
            'button',
            {
              class: 'btn btn--primary',
              type: 'button',
              onClick: () => navigate(`/partita/${game.id}/smazzata`),
            },
            'Nuova smazzata',
          ),
      el('button', { class: 'btn', type: 'button', onClick: () => navigate(`/partita/${game.id}`) }, 'Vedi la partita'),
    ),
  )
}
```

- [ ] **Step 5: Collegare il salvataggio al riepilogo**

In `src/ui/screens/handForm.ts`, sostituire il corpo della funzione `save` con:

```ts
  function save(): void {
    const input = { soloPlayerId: needsSolo ? soloPlayerId : null, entries }
    const updated = editing
      ? updateHand(game!, editing.id, input, appDeps)
      : addHand(game!, input, appDeps)
    upsertGame(updated)
    const savedHandId = editing ? editing.id : updated.hands[updated.hands.length - 1].id
    navigate(`/partita/${updated.id}/riepilogo/${savedHandId}`)
  }
```

Aggiungere in `src/main.ts`:

```ts
import { handSummaryScreen } from './ui/screens/handSummary'

registerRoute('/partita/:gameId/riepilogo/:handId', handSummaryScreen)
```

- [ ] **Step 6: Eseguire test e build**

Run: `npm test && npm run build`
Expected: PASS e build completata

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: riepilogo di fine smazzata con annuncio del cambio fase e della vittoria"
```

---

### Task 15: Storico partite e statistiche giocatori

**Files:**
- Create: `src/ui/screens/history.ts`, `src/ui/screens/players.ts`
- Modify: `src/main.ts`
- Test: nessun test nuovo (la logica è già coperta da `stats.test.ts` e `standings.test.ts`); verifica manuale nello Step 4

**Interfaces:**
- Consumes: `loadState`, `deleteGame` da `src/storage/repository.ts`; `replayGame` da `src/engine/standings.ts`; `computePlayerStats` da `src/engine/stats.ts`
- Produces: `historyScreen: Screen` da `src/ui/screens/history.ts`; `playersScreen: Screen` da `src/ui/screens/players.ts`

**Comportamento richiesto:**
- Lo storico elenca le partite concluse dalla più recente, con data, modalità, vincitore e punteggio finale; da lì si può aprire il dettaglio della partita o eliminarla (con conferma in pagina).
- Le partite in corso compaiono in una sezione separata in cima, per poterle riprendere.
- La schermata giocatori mostra la classifica per vittorie con partite giocate, percentuale di vittoria, media punti a smazzata e miglior smazzata.

- [ ] **Step 1: Implementare lo storico**

`src/ui/screens/history.ts`:

```ts
import { replayGame } from '../../engine/standings'
import { deleteGame, loadState } from '../../storage/repository'
import { el } from '../dom'
import { navigate, type Screen } from '../router'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const historyScreen: Screen = () => {
  const container = el('div', {})
  let pendingDeleteId: string | null = null

  function draw(): void {
    const state = loadState()
    const ongoing = state.games
      .filter((g) => g.status === 'in_progress')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const completed = state.games
      .filter((g) => g.status === 'completed')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    const card = (gameId: string): HTMLElement => {
      const game = state.games.find((g) => g.id === gameId)!
      const progress = replayGame(game)
      const winner = progress.standings.find((s) => game.winnerIds.includes(s.accountId))

      const actions =
        pendingDeleteId === game.id
          ? el(
              'div',
              { class: 'grid-2' },
              el(
                'button',
                {
                  class: 'btn btn--danger',
                  type: 'button',
                  onClick: () => {
                    deleteGame(game.id)
                    pendingDeleteId = null
                    draw()
                  },
                },
                'Elimina davvero',
              ),
              el(
                'button',
                {
                  class: 'btn',
                  type: 'button',
                  onClick: () => {
                    pendingDeleteId = null
                    draw()
                  },
                },
                'Annulla',
              ),
            )
          : el(
              'div',
              { class: 'grid-2' },
              el('button', { class: 'btn', type: 'button', onClick: () => navigate(`/partita/${game.id}`) }, 'Apri'),
              el(
                'button',
                {
                  class: 'btn btn--danger',
                  type: 'button',
                  onClick: () => {
                    pendingDeleteId = game.id
                    draw()
                  },
                },
                'Elimina',
              ),
            )

      return el(
        'div',
        { class: 'card' },
        el(
          'div',
          { class: 'row row--between' },
          el('strong', {}, `${game.mode} giocatori`),
          el('span', { class: 'muted' }, formatDate(game.updatedAt)),
        ),
        winner ? el('div', {}, `Vince ${winner.label} con ${winner.points} punti`) : null,
        ...progress.standings.map((s) =>
          el('div', { class: 'row row--between' }, el('span', { class: 'muted' }, s.label), el('span', { class: 'score' }, String(s.points))),
        ),
        actions,
      )
    }

    container.replaceChildren(
      el('h1', {}, 'Storico'),
      ...(ongoing.length > 0 ? [el('h2', {}, 'In corso'), ...ongoing.map((g) => card(g.id))] : []),
      el('h2', {}, 'Concluse'),
      ...(completed.length > 0
        ? completed.map((g) => card(g.id))
        : [el('div', { class: 'card muted' }, 'Nessuna partita conclusa.')]),
      el('button', { class: 'btn', type: 'button', onClick: () => navigate('/') }, 'Home'),
    )
  }

  draw()
  return container
}
```

- [ ] **Step 2: Implementare la schermata giocatori**

`src/ui/screens/players.ts`:

```ts
import { computePlayerStats } from '../../engine/stats'
import { loadState } from '../../storage/repository'
import { el } from '../dom'
import { navigate, type Screen } from '../router'

export const playersScreen: Screen = () => {
  const stats = computePlayerStats(loadState().games)

  const cards = stats.map((player) =>
    el(
      'div',
      { class: 'card' },
      el(
        'div',
        { class: 'row row--between' },
        el('strong', {}, player.name),
        el('span', { class: 'score' }, `${player.gamesWon}/${player.gamesPlayed}`),
      ),
      el(
        'div',
        { class: 'muted' },
        `Vittorie ${Math.round(player.winRate * 100)}% · media ${player.averageHandPoints} punti a smazzata · miglior smazzata ${player.bestHandPoints}`,
      ),
    ),
  )

  return el(
    'div',
    {},
    el('h1', {}, 'Giocatori'),
    ...(cards.length > 0 ? cards : [el('div', { class: 'card muted' }, 'Nessuna partita conclusa: le statistiche compaiono qui.')]),
    el('button', { class: 'btn', type: 'button', onClick: () => navigate('/') }, 'Home'),
  )
}
```

- [ ] **Step 3: Registrare le rotte**

Aggiungere in `src/main.ts`:

```ts
import { historyScreen } from './ui/screens/history'
import { playersScreen } from './ui/screens/players'

registerRoute('/storico', historyScreen)
registerRoute('/giocatori', playersScreen)
```

- [ ] **Step 4: Verifica manuale**

Run: `npm run dev`

Verificare: giocando una partita fino al superamento dei 2005 punti, la partita compare fra le concluse nello storico e il vincitore appare nella schermata giocatori con una vittoria.

- [ ] **Step 5: Eseguire test e build**

Run: `npm test && npm run build`
Expected: PASS e build completata

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): storico delle partite e statistiche per giocatore"
```

---

### Task 16: PWA installabile e funzionante offline

**Files:**
- Create: `scripts/generate-icons.mjs`, `public/manifest.webmanifest`, `public/sw.js`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`
- Modify: `index.html`, `src/main.ts`, `package.json`
- Test: verifica manuale (Step 5)

**Interfaces:**
- Consumes: niente
- Produces: nessuna API applicativa; l'app diventa installabile e utilizzabile senza rete dopo la prima apertura

**Scelte tecniche:**
- Le icone sono generate da uno script Node senza dipendenze esterne, così il repository resta autosufficiente.
- Il service worker usa una cache runtime: la prima apertura online popola la cache, le successive funzionano anche senza rete. Il nome della cache contiene una versione: cambiarlo invalida la cache precedente.
- Le richieste di navigazione usano rete-prima-poi-cache, così un aggiornamento pubblicato viene raccolto appena c'è connessione.

- [ ] **Step 1: Scrivere il generatore di icone**

`scripts/generate-icons.mjs`:

```js
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

/** Icona: fondo scuro, disco verde, carta bianca al centro. */
function iconPixels(size) {
  const rows = []
  const center = size / 2
  const discRadius = size * 0.42
  const cardWidth = size * 0.22
  const cardHeight = size * 0.32

  for (let y = 0; y < size; y++) {
    const row = [0]
    for (let x = 0; x < size; x++) {
      const dx = x - center
      const dy = y - center
      const insideDisc = dx * dx + dy * dy <= discRadius * discRadius
      const insideCard = Math.abs(dx) <= cardWidth / 2 && Math.abs(dy) <= cardHeight / 2

      if (insideCard) row.push(0xf8, 0xfa, 0xfc, 0xff)
      else if (insideDisc) row.push(0x22, 0xc5, 0x5e, 0xff)
      else row.push(0x0f, 0x17, 0x2a, 0xff)
    }
    rows.push(Buffer.from(row))
  }
  return Buffer.concat(rows)
}

function png(size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(iconPixels(size))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const [size, name] of [
  [192, 'public/icon-192.png'],
  [512, 'public/icon-512.png'],
  [180, 'public/apple-touch-icon.png'],
]) {
  writeFileSync(name, png(size))
  console.log(`Creata ${name}`)
}
```

- [ ] **Step 2: Generare le icone**

Run: `node scripts/generate-icons.mjs`
Expected: tre file PNG creati in `public/`. Aprirli per confermare che si vedano (fondo scuro, disco verde, rettangolo chiaro).

Aggiungere lo script in `package.json`:

```json
"icons": "node scripts/generate-icons.mjs"
```

- [ ] **Step 3: Scrivere manifest e service worker**

`public/manifest.webmanifest`:

```json
{
  "name": "Punti Burraco",
  "short_name": "Burraco",
  "description": "Segnapunti per partite di burraco a 2, 3 o 4 giocatori",
  "start_url": "/puntiBurraco/",
  "scope": "/puntiBurraco/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0f172a",
  "theme_color": "#0f172a",
  "lang": "it",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`public/sw.js`:

```js
const CACHE_NAME = 'punti-burraco-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  // Navigazione: prima la rete, così gli aggiornamenti arrivano; in mancanza di rete, la cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match('./index.html'))),
    )
    return
  }

  // Risorse statiche: prima la cache, poi la rete.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && new URL(request.url).origin === self.location.origin) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})
```

- [ ] **Step 4: Registrare il service worker e completare l'HTML**

Aggiungere in fondo a `src/main.ts`:

```ts
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    })
  })
}
```

Aggiungere in `<head>` di `index.html`, dopo il link al manifest:

```html
<link rel="apple-touch-icon" href="/puntiBurraco/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="description" content="Segnapunti per partite di burraco a 2, 3 o 4 giocatori" />
```

- [ ] **Step 5: Verifica manuale della PWA**

Run: `npm run build && npm run preview`

Verificare nel browser, sulla porta indicata da `preview`:
1. in DevTools → Application il manifest è valido e le icone si vedono;
2. il service worker risulta attivo;
3. ricaricando con la rete disattivata (DevTools → Network → Offline) l'app si apre e la partita in corso è ancora lì.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(pwa): manifest, icone generate e service worker per l'uso offline"
```

---

### Task 17: Pubblicazione su GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`
- Test: verifica del sito pubblicato (Step 5)

**Interfaces:**
- Consumes: niente
- Produces: sito pubblicato su `https://steno983.github.io/puntiBurraco/`

- [ ] **Step 1: Scrivere il workflow di pubblicazione**

`.github/workflows/deploy.yml`:

```yaml
name: Deploy su GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Scrivere il README**

`README.md`:

```markdown
# Punti Burraco

Segnapunti per partite di burraco a 2, 3 o 4 giocatori. Funziona da telefono,
si installa sulla schermata home e tiene le partite sul dispositivo.

**App online:** https://steno983.github.io/puntiBurraco/

## Regole applicate

Regolamento federale italiano, con la variante opzionale del burraco semipulito.
Obiettivo partita: 2005 punti.

| Voce | Punti |
|---|---|
| Jolly | 30 |
| Pinella | 20 |
| Asso | 15 |
| Figure, 10, 9, 8 | 10 |
| Da 7 a 3 | 5 |
| Burraco pulito | 200 |
| Burraco semipulito | 150 |
| Burraco sporco | 100 |
| Chiusura | 100 |
| Pozzetto non preso | −100 |

Per chiudere servono: pozzetto preso, almeno un burraco, nessuna carta in mano.
L'app blocca il salvataggio di una chiusura che non rispetta queste condizioni.

Nella partita a 3 si gioca uno contro due finché un giocatore raggiunge 1000
punti; da lì in poi tutti contro tutti. Il punteggio della coppia si divide a
metà, arrotondato per eccesso.

## Sviluppo

```bash
npm install
npm run dev      # sviluppo
npm test         # test del motore di punteggio
npm run build    # build di produzione
npm run icons    # rigenera le icone della PWA
```

I dati restano nel `localStorage` del browser: svuotare i dati del sito cancella
partite e statistiche.
```

- [ ] **Step 3: Creare il repository e caricare il codice**

```bash
gh repo create puntiBurraco --public --source=. --remote=origin --push
```

- [ ] **Step 4: Abilitare GitHub Pages da GitHub Actions**

```bash
gh api -X POST repos/:owner/puntiBurraco/pages -f build_type=workflow || \
  gh api -X PUT repos/:owner/puntiBurraco/pages -f build_type=workflow
```

Se il comando fallisce, abilitare a mano: Settings → Pages → Source: GitHub Actions.

- [ ] **Step 5: Verificare la pubblicazione**

```bash
gh run watch
```

Poi aprire `https://steno983.github.io/puntiBurraco/` e verificare:
1. l'app si carica e la home compare;
2. si crea una partita e si registra una smazzata;
3. ricaricando la pagina la partita è ancora lì;
4. da telefono, il browser propone l'installazione sulla schermata home.

- [ ] **Step 6: Commit finale**

```bash
git add -A
git commit -m "ci: pubblicazione automatica su GitHub Pages e documentazione"
git push
```

---

## Verifica finale

Prima di considerare il lavoro concluso:

- [ ] `npm test` verde su tutti i file di test
- [ ] `npm run build` senza errori TypeScript
- [ ] partita a 2 giocatori giocata fino alla vittoria, con almeno una chiusura rifiutata dai constraint
- [ ] partita a 3 giocatori portata oltre i 1000 punti, con verifica del passaggio alla fase 2 e del ritorno a tre pannelli individuali
- [ ] partita a 4 giocatori con punteggio di squadra, verificando che non venga diviso
- [ ] correzione di una smazzata passata con ricalcolo dei totali
- [ ] app aperta offline dopo l'installazione, con la partita ancora presente
- [ ] sito raggiungibile su https://steno983.github.io/puntiBurraco/
