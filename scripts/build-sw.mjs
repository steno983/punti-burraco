/**
 * Passo di post-build: scrive dentro `dist/sw.js` l'elenco dei file prodotti dalla
 * build, così il service worker li mette in cache già durante l'installazione e
 * l'applicazione funziona senza rete fin dalla prima apertura.
 *
 * I nomi dei file contengono un hash generato da Vite, quindi non si possono
 * scrivere a mano: vanno letti da `dist` a build conclusa. Dall'elenco si ricava
 * anche l'impronta usata come nome della cache, così ogni build nuova invalida la
 * precedente invece di accumularne il contenuto.
 *
 * Usa solo moduli nativi di Node ed è agganciato a `npm run build`.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const distDir = join(root, 'dist')
const swPath = join(distDir, 'sw.js')

/** Percorsi di tutti i file sotto una cartella, relativi a `distDir` e con separatore URL. */
function listFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...listFiles(full))
    else files.push(relative(distDir, full).split(sep).join('/'))
  }
  return files
}

// Il service worker non mette in cache sé stesso (lo aggiorna il browser) e le
// mappe dei sorgenti servono solo al debug.
const assets = listFiles(distDir)
  .filter((file) => file !== 'sw.js' && !file.endsWith('.map'))
  .sort()

// `./` è la pagina servita alla radice dello scope: è la stessa voce che il
// gestore di navigazione cerca in cache quando la rete manca, e corrisponde a
// `index.html`, che quindi non va elencato una seconda volta.
const precache = ['./', ...assets.filter((file) => file !== 'index.html')]

const buildId = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12)

const source = readFileSync(swPath, 'utf8')
const buildIdLine = /^const BUILD_ID = .*$/m
const precacheLine = /^const PRECACHE = .*$/m

if (!buildIdLine.test(source) || !precacheLine.test(source)) {
  throw new Error('sw.js non contiene le righe BUILD_ID e PRECACHE da riscrivere')
}

const patched = source
  .replace(buildIdLine, `const BUILD_ID = ${JSON.stringify(buildId)}`)
  .replace(precacheLine, `const PRECACHE = ${JSON.stringify(precache, null, 2)}`)

writeFileSync(swPath, patched)
console.log(`sw.js: precaricati ${precache.length} file (build ${buildId})`)
