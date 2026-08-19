# Punti Burraco

Segnapunti per partite di burraco a 2, 3 o 4 giocatori. Funziona da telefono,
si installa sulla schermata home e tiene le partite sul dispositivo.

**App online:** https://steno983.github.io/punti-burraco/

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

L'app non conta le carte: i punti di tavola e di mano si inseriscono già sommati,
e la tabella qui sopra serve da promemoria per farlo.

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
