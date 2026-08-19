import { createGame, type EngineDeps } from '../../engine/game'
import type { Game, GameMode } from '../../engine/types'
import { getGame, loadState, upsertGame, upsertPlayer } from '../../storage/repository'
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

/** Identificativo dell'elenco di suggerimenti condiviso da tutti i campi del nome. */
const SUGGESTIONS_ID = 'rubrica-giocatori'

/** Nomi già usati in altre partite, in ordine alfabetico. */
export function suggestionNames(players: { name: string }[]): string[] {
  return players.map((p) => p.name).sort((a, b) => a.localeCompare(b, 'it'))
}

/** Schermata a passi per la creazione di una nuova partita. */
export const newGameScreen: Screen = () => {
  const form: NewGameForm = { mode: 4, names: ['', '', '', ''], teamSplit: [[0, 1], [2, 3]], semipulitoEnabled: true }
  const container = el('div', {})

  // La rubrica dei giocatori già usati: la tastiera del telefono propone i nomi
  // senza impedire di scriverne uno nuovo. È la stessa per tutti i campi.
  const suggestions = el(
    'datalist',
    { id: SUGGESTIONS_ID },
    ...suggestionNames(loadState().players).map((name) => el('option', { value: name })),
  )

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
    // Se il dispositivo ha rifiutato il salvataggio l'avviso è già a schermo:
    // restare qui evita di aprire una partita che non esiste.
    if (!getGame(game.id)) return
    navigate(`/partita/${game.id}`)
  }

  // Nodo stabile dell'anteprima squadre, ricreato a ogni draw(): si aggiorna sul
  // posto mentre si digita, senza ricreare i campi di testo (che perderebbero il fuoco).
  let teamsPreview: HTMLElement | null = null

  const teamLabel = (a: number, b: number): string =>
    `${form.names[a].trim() || `Giocatore ${a + 1}`} e ${form.names[b].trim() || `Giocatore ${b + 1}`}`

  function refreshTeamsPreview(): void {
    if (!teamsPreview) return
    teamsPreview.replaceChildren(...form.teamSplit.map(([a, b]) => el('div', {}, teamLabel(a, b))))
  }

  function draw(errors: string[] = []): void {
    teamsPreview = null
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
      const input = el('input', {
        type: 'text',
        value,
        placeholder: `Giocatore ${index + 1}`,
        autocomplete: 'off',
      })
      input.setAttribute('list', SUGGESTIONS_ID)
      input.addEventListener('input', () => {
        form.names[index] = input.value
        refreshTeamsPreview()
      })
      return el('div', { class: 'card' }, input)
    })

    if (form.mode === 4) teamsPreview = el('div', {})
    const teamsSection =
      teamsPreview !== null
        ? el(
            'div',
            { class: 'card' },
            el('div', { class: 'muted' }, 'Squadre'),
            teamsPreview,
            el('button', { class: 'btn', type: 'button', onClick: rotateTeams }, 'Cambia accoppiamento'),
          )
        : null
    refreshTeamsPreview()

    container.replaceChildren(
      el('h1', {}, 'Nuova partita'),
      ...errors.map((message) => el('div', { class: 'alert' }, message)),
      el('div', { class: 'grid-3' }, ...modeButtons),
      el('h2', {}, 'Giocatori'),
      suggestions,
      ...nameInputs,
      ...(teamsSection ? [teamsSection] : []),
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
