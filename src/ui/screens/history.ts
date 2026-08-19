import { replayGame } from '../../engine/standings'
import { deleteGame, loadState } from '../../storage/repository'
import { el } from '../dom'
import { plural } from '../format'
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
                'Sì, elimina',
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
        winner ? el('div', {}, `Vince ${winner.label} con ${plural(winner.points, 'punto', 'punti')}`) : null,
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
