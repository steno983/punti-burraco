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

/**
 * Avviso mostrato quando le dichiarazioni salvate non corrispondono più alle
 * entità della fase corrente: succede correggendo una smazzata passata, che può
 * spostare il confine di fase. Senza dirlo, i valori sparirebbero in silenzio.
 */
export const DISCARDED_ENTRIES_MESSAGE =
  'Alcuni punti già inseriti in questa smazzata riguardavano una composizione diversa dei giocatori e sono stati azzerati: controllali e reinseriscili prima di salvare.'

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
  let discardedEntries = false

  const needsSolo = game.mode === 3 && phase === 1

  function entities(): ScoringEntity[] {
    return resolveEntities(game!, phase, soloPlayerId)
  }

  /** Una dichiarazione che contiene qualcosa: scartarla in silenzio perderebbe dati. */
  function hasData(entry: HandEntry): boolean {
    return (
      entry.closed ||
      !entry.tookPot ||
      entry.cleanBurracos > 0 ||
      entry.semiCleanBurracos > 0 ||
      entry.dirtyBurracos > 0 ||
      entry.tablePoints > 0 ||
      entry.handPoints > 0
    )
  }

  function syncEntries(): void {
    const ids = entities().map((e) => e.id)
    // Una volta segnalata, la perdita resta a schermo finché si sta su questa smazzata.
    if (entries.some((entry) => !ids.includes(entry.entityId) && hasData(entry))) {
      discardedEntries = true
    }
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

  const totalNodes = new Map<string, HTMLElement>()
  // Nodi stabili creati in draw(): update() li aggiorna sul posto senza ridisegnare
  // i pannelli, così i tastierini non perdono lo stato mentre si digita.
  let violationsContainer: HTMLElement | null = null
  let saveButton: HTMLButtonElement | null = null

  function refreshTotals(): void {
    for (const entry of entries) {
      const node = totalNodes.get(entry.entityId)
      if (node) node.textContent = String(scoreEntry(entry, game!.options).total)
    }
  }

  /** Rivaluta le violazioni sullo stato corrente e aggiorna avvisi e pulsante di salvataggio. */
  function refreshValidation(): void {
    if (!violationsContainer || !saveButton) return
    const violations = validateHandEntries(entries, entities())
    violationsContainer.replaceChildren(
      ...violations.map((v) => el('div', { class: v.blocking ? 'alert' : 'alert alert--info' }, v.message)),
    )
    saveButton.disabled = hasBlockingViolations(violations)
  }

  function update(entityId: string, patch: Partial<HandEntry>): void {
    entries = entries.map((entry) => (entry.entityId === entityId ? { ...entry, ...patch } : entry))
    refreshTotals()
    refreshValidation()
  }

  function save(): void {
    const input = { soloPlayerId: needsSolo ? soloPlayerId : null, entries }
    const updated = editing
      ? updateHand(game!, editing.id, input, appDeps)
      : addHand(game!, input, appDeps)
    upsertGame(updated)
    const savedHandId = editing ? editing.id : updated.hands[updated.hands.length - 1].id
    navigate(`/partita/${updated.id}/riepilogo/${savedHandId}`)
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
              if (soloPlayerId === player.playerId) return
              soloPlayerId = player.playerId
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
    let entry = entries.find((e) => e.entityId === entity.id)!
    if (isSolista(entity) && !entry.tookPot) {
      entry = { ...entry, tookPot: true }
      entries = entries.map((e) => (e.entityId === entity.id ? entry : e))
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
    violationsContainer = null
    saveButton = null

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

    violationsContainer = el('div', {})
    saveButton = el(
      'button',
      { class: 'btn btn--primary', type: 'button', onClick: save },
      editing ? 'Salva le modifiche' : 'Salva smazzata',
    )

    container.replaceChildren(
      el('h1', {}, editing ? 'Modifica smazzata' : 'Nuova smazzata'),
      ...(needsSolo ? [soloSelector()] : []),
      ...(discardedEntries ? [el('div', { class: 'alert' }, DISCARDED_ENTRIES_MESSAGE)] : []),
      violationsContainer,
      ...currentEntities.map(entityPanel),
      el(
        'div',
        { class: 'sticky-actions' },
        saveButton,
        el('button', { class: 'btn', type: 'button', onClick: () => navigate(`/partita/${game!.id}`) }, 'Annulla'),
      ),
    )

    refreshValidation()
  }

  draw()
  return container
}
