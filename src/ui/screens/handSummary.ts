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
