import type { GameProgress } from '../../engine/standings'
import { el } from '../dom'

export function createScoreboard(progress: GameProgress, targetScore: number): HTMLElement {
  const rows = progress.standings.map((standing) => {
    const ratio = Math.min(100, Math.max(0, Math.round((standing.points / targetScore) * 100)))
    const bar = el('span', {})
    bar.style.width = `${ratio}%`

    return el(
      'div',
      { class: 'card' },
      el(
        'div',
        { class: 'row row--between' },
        el('span', {}, standing.label),
        el('span', { class: 'score', dataset: { role: 'points' } }, String(standing.points)),
      ),
      el('div', { class: 'progress' }, bar),
    )
  })

  return el('div', {}, ...rows)
}
