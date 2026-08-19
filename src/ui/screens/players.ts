import { computePlayerStats } from '../../engine/stats'
import { loadState } from '../../storage/repository'
import { el } from '../dom'
import { plural } from '../format'
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
        `Vittorie ${Math.round(player.winRate * 100)}% · media ${plural(
          player.averageHandPoints,
          'punto',
          'punti',
        )} a smazzata · miglior smazzata ${player.bestHandPoints}`,
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
