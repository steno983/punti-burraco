# Punti Burraco — Design

**Data:** 2026-08-19
**Stato:** in revisione
**Deploy target:** https://steno983.github.io/puntiBurraco/

## 1. Obiettivo

Webapp mobile-first per tenere il punteggio di una partita di burraco a 2, 3 o 4
giocatori. Le partite vivono sul dispositivo dell'utente (localStorage), possono
essere interrotte e riprese, e restano consultabili come storico. Distribuzione
via GitHub Pages, installabile come PWA e utilizzabile offline.

L'app **non simula il gioco**: non conosce le carte, non distribuisce, non
valida le combinazioni sul tavolo. Registra ciò che i giocatori dichiarano a
fine smazzata e ne calcola il punteggio applicando le regole.

### Non obiettivi

- Nessun multiplayer, sincronizzazione o backend.
- Nessun account, nessuna rete dopo il primo caricamento.
- Nessun export/import dei dati (scelta esplicita: i dati vivono e muoiono col
  dispositivo).
- Nessuna variante non federale oltre al burraco semipulito.

## 2. Regole implementate

Base: regolamento federale italiano (FIBur/FGB), con l'unica variante
configurabile del burraco semipulito.

### 2.1 Valore delle carte

| Carta | Punti |
|---|---|
| Jolly | 30 |
| Pinella (2) | 20 |
| Asso | 15 |
| K, Q, J, 10, 9, 8 | 10 |
| 7, 6, 5, 4, 3 | 5 |

Le carte calate in tavola si sommano, quelle rimaste in mano si sottraggono.

### 2.2 Bonus e malus

| Voce | Punti | Note |
|---|---|---|
| Burraco pulito | +200 | 7+ carte, nessuna matta |
| Burraco semipulito | +150 | opzionale; se disattivato la categoria non compare |
| Burraco sporco | +100 | 7+ carte con matta |
| Chiusura | +100 | a chi chiude la smazzata |
| Pozzetto non preso | −100 | a chi non lo ha preso a fine smazzata |

Obiettivo partita: **2005 punti**, fisso per tutte le modalità.

### 2.3 Constraint di chiusura

Validi identicamente per 2, 3 e 4 giocatori:

1. chi chiude deve aver preso il pozzetto;
2. chi chiude deve avere almeno un burraco (di qualsiasi tipo);
3. chi chiude deve avere zero punti in mano (cala tutto e scarta l'ultima carta);
4. in una smazzata può chiudere al massimo una entità;
5. una smazzata può terminare senza chiusura (tallone esaurito): nessun bonus
   chiusura, si contano solo tavola, bonus burrachi, carte in mano e malus
   pozzetto.

L'app applica 1–4 come **blocchi** al salvataggio, con messaggio esplicito su
quale condizione manca.

### 2.4 Pozzetti

| Modalità | Pozzetti | Titolarità |
|---|---|---|
| 2 giocatori | 2 × 11 carte | individuale (uno per giocatore) |
| 3 giocatori — fase 1 | 18 + 11 carte | il solista ha il 18, la coppia l'11 |
| 3 giocatori — fase 2 | 3 × 11 carte | individuale |
| 4 giocatori | 2 × 11 carte | uno per squadra |

Nella fase 1 a tre, il solista è tale proprio perché ha preso per primo il
pozzetto da 18: l'app lo considera sempre "pozzetto preso" e il malus −100 può
ricadere solo sulla coppia.

### 2.5 Modalità a 3 giocatori

**Fase 1 — uno contro due.** A ogni smazzata l'utente indica chi ha giocato da
solo. Il punteggio della coppia viene diviso a metà fra i due componenti, con
**arrotondamento per eccesso per entrambi** (es. 305 → 153 e 153). Il solista
prende il proprio punteggio intero.

L'arrotondamento è sempre verso l'alto, anche sui totali negativi: una coppia a
−305 dà −152 a testa, non −153. La regola è coerente (arrotondare verso l'alto
favorisce sempre il giocatore) e non introduce eccezioni nel motore.

**Passaggio di fase.** Quando, a fine smazzata, il punteggio individuale di
almeno un giocatore raggiunge o supera **1000**, dalla smazzata successiva si
gioca in **fase 2**. Il passaggio è definitivo e non reversibile, anche se
successive smazzate negative riportano tutti sotto i 1000.

**Fase 2 — tutti contro tutti.** Tre pozzetti individuali, ogni giocatore conta
per sé. Vince chi raggiunge per primo 2005 punti.

### 2.6 Fine partita

Al termine di una smazzata si valuta chi ha raggiunto o superato 2005: la
squadra a 4 giocatori, il singolo giocatore a 2 e a 3. Se più contendenti sono
oltre la soglia, vince quello col punteggio più alto. In caso di parità esatta
al vertice la partita prosegue con altre smazzate finché il pareggio non si
rompe.

## 3. Architettura

```
src/
  engine/
    cards.ts        valori carte e costanti di punteggio
    rules.ts        configurazione regole per modalità e fase
    scoring.ts      calcolo punteggio di una smazzata
    validation.ts   verifica dei constraint di chiusura
    game.ts         macchina a stati della partita
  storage/
    repository.ts   lettura/scrittura localStorage con versione schema
  ui/
    router.ts
    screens/        home · newGame · game · handForm · history · players
    components/     numpad · stepper · toggle · scoreboard · sheet
  styles/
  main.ts
tests/              specifiche del motore (Vitest)
public/             manifest.webmanifest · icone · service worker
```

Vincolo architetturale: `engine/` è TypeScript puro, non importa nulla da `ui/`
né tocca il DOM o localStorage. Riceve dati, restituisce dati. È l'unico punto
in cui vivono le regole del burraco.

`storage/` è l'unico punto che conosce localStorage. La UI non vi accede mai
direttamente.

## 4. Modello dati

Il concetto centrale è l'**entità di punteggio** (`ScoringEntity`): l'unità a cui
si attribuiscono i punti di una smazzata.

| Modalità | Entità |
|---|---|
| 2 giocatori | 2 entità individuali |
| 3 giocatori fase 1 | 1 entità solista + 1 entità coppia |
| 3 giocatori fase 2 | 3 entità individuali |
| 4 giocatori | 2 entità squadra |

Il motore calcola sempre per entità, poi proietta i punti su chi tiene il
punteggio:

- **2 giocatori e 3 giocatori fase 2** — ogni entità è un giocatore: proiezione
  identica.
- **3 giocatori fase 1** — l'entità coppia si divide fra i due componenti, metà
  arrotondata per eccesso. Serve perché a tre giocatori il punteggio è sempre
  individuale: la coppia è temporanea e cambia a ogni smazzata.
- **4 giocatori** — l'entità squadra è stabile per tutta la partita e il
  punteggio **resta di squadra**: nessuna divisione, nessun punteggio
  individuale.

Le soglie si valutano di conseguenza: 1000 (cambio fase) e 2005 (fine partita)
sui punteggi individuali a 2 e 3 giocatori, sul punteggio di squadra a 4.

Strutture principali:

- `Player` — anagrafica riusabile: `id`, `name`, `createdAt`.
- `Game` — `id`, `mode` (2|3|4), `options` (`semipulitoEnabled`), `targetScore`
  (2005), `players` (riferimenti + ordine), `teams` (solo a 4), `hands`,
  `status` (`in_progress` | `completed`), `winnerPlayerIds`, timestamp.
- `Hand` — `id`, `index`, `phase` (1|2, solo a tre), `soloPlayerId` (solo fase 1
  a tre), `entries`, `createdAt`.
- `HandEntry` — per entità: `entityId`, `closed`, `tookPot`, `cleanBurracos`,
  `semiCleanBurracos`, `dirtyBurracos`, `tablePoints`, `handPoints`.

I totali non vengono persistiti: sono sempre ricalcolati dal motore a partire
dalle smazzate. Questo rende la correzione di una smazzata passata banale e
impedisce che totali e dettaglio divergano.

## 5. Funzioni del motore

- `scoreHand(hand, ruleset)` → punteggio per entità e proiezione per giocatore.
- `validateHand(hand, gameState)` → elenco di violazioni con codice e messaggio
  in italiano; distingue errori bloccanti da avvisi.
- `computeStandings(game)` → punteggi cumulativi per giocatore, ricalcolati da
  zero su tutte le smazzate.
- `resolvePhase(game)` → fase corrente della partita a tre, derivata dallo
  storico dei punteggi.
- `checkGameEnd(game)` → esito della partita e vincitori.

Avviso non bloccante previsto: punti in tavola incoerenti con il numero di
burrachi dichiarati (un burraco vale almeno 35 punti di carte).

## 6. Interfaccia

Mobile-first, pensata per l'uso a una mano sul bordo del tavolo: aree di tocco
grandi, nessun input di testo durante la partita, numeri inseriti da tastierino
a schermo.

**Home.** Se esiste una partita aperta, card in evidenza con punteggi correnti e
azione "Riprendi". Sotto: "Nuova partita", "Storico", "Giocatori".

**Nuova partita.** Wizard: numero giocatori → nomi (con suggerimenti dalla
rubrica dei giocatori già usati) → composizione squadre (solo a 4) → opzione
burraco semipulito → avvio.

**Partita.** Tabellone fisso in alto con punteggi e avanzamento verso 2005; a
tre giocatori un badge indica la fase. Sotto, elenco delle smazzate, ciascuna
espandibile e correggibile. In basso, azione primaria "Nuova smazzata".

**Inserimento smazzata.** Schermata piena. A tre giocatori in fase 1, primo
passo: scelta del solista. Poi un pannello per entità con: toggle "ha chiuso",
toggle "pozzetto preso", stepper per i tre tipi di burraco, tastierino numerico
per punti in tavola e punti in mano. Totale della mano ricalcolato in tempo
reale e sempre visibile. Il salvataggio è bloccato finché ci sono violazioni, con
il motivo scritto in chiaro.

**Dopo il salvataggio.** Riepilogo dei delta. Se scatta il passaggio alla fase 2
a tre giocatori, l'app lo annuncia esplicitamente. Se la partita è finita,
schermata di vittoria e archiviazione automatica nello storico.

**Storico.** Partite concluse con data, modalità, vincitore e punteggio finale;
dettaglio con tutte le smazzate.

**Giocatori e statistiche.** Per ogni giocatore: partite giocate, vittorie,
percentuale di vittoria, media punti a smazzata, miglior smazzata. Nelle partite
a 4 giocatori le statistiche di punteggio del singolo derivano dal punteggio
della sua squadra, che è l'unico esistente in quella modalità.

## 7. Persistenza

Chiave unica `puntiburraco.v1` contenente `{ schemaVersion, players, games }`.
Scrittura a ogni mutazione dello stato: interrompere l'app a metà partita non
perde nulla. Il numero di versione consente migrazioni future senza perdere le
partite già registrate. Lettura difensiva: dati corrotti o illeggibili non
devono impedire l'avvio dell'app.

## 8. PWA e deploy

Manifest con icone e `display: standalone`; service worker che mette in cache
l'intero bundle in fase di install, così dopo la prima apertura l'app funziona
senza rete. Strategia cache-first con aggiornamento in background.

Build con Vite (`base: '/puntiBurraco/'`). GitHub Action che a ogni push sul
branch principale esegue build e pubblica su GitHub Pages.

## 9. Test

Vitest sul motore, scritti prima dell'implementazione. Casi previsti:

- valori carte e somma dei bonus per ciascun tipo di burraco;
- ciascun constraint di chiusura violato singolarmente (pozzetto mancante,
  nessun burraco, punti in mano non nulli, due chiusure nella stessa smazzata);
- smazzata senza chiusura per tallone esaurito;
- malus pozzetto nelle tre modalità, incluso il caso del solista a tre;
- divisione dei punti di coppia con totale dispari e con totale negativo;
- soglia 1000 raggiunta esattamente, e non raggiunta per un punto;
- irreversibilità del passaggio alla fase 2;
- raggiungimento di 2005 e caso di parità al vertice;
- correzione di una smazzata già registrata, con ricalcolo dei totali;
- round trip di salvataggio e rilettura da localStorage.

## 10. Decisioni aperte

Nessuna. Le scelte discusse in fase di brainstorming (base federale + semipulito,
obiettivo 2005, modalità a tre con solista dichiarato e soglia 1000, divisione
per eccesso, tastierino numerico, PWA, nessun export) sono recepite sopra.
