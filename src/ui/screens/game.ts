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
                "Confermi l'eliminazione?",
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
      el('div', { class: 'row row--between' }, el('h1', {}, 'Partita'), ...(phaseBadge ? [phaseBadge] : [])),
      ...(progress.hasIssues
        ? [el('div', { class: 'alert' }, 'Alcune smazzate sono da correggere e non sono conteggiate.')]
        : []),
      createScoreboard(progress, game.targetScore),
      el('h2', {}, 'Smazzate'),
      ...(handCards.length > 0 ? handCards : [el('div', { class: 'card muted' }, 'Nessuna smazzata registrata.')]),
      footer,
    )
  }

  draw()
  return container
}
