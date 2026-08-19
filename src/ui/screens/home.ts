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
