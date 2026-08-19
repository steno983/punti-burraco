import { el } from '../dom'

const MAX_VALUE = 9999

export function createNumpad(options: {
  label: string
  value: number
  onChange: (value: number) => void
}): HTMLElement {
  let value = options.value

  const display = el('div', { class: 'score score--big', dataset: { role: 'value' } }, String(value))

  const setValue = (next: number): void => {
    value = next
    display.textContent = String(value)
    options.onChange(value)
  }

  const digitButton = (digit: string): HTMLElement =>
    el(
      'button',
      {
        class: 'btn',
        type: 'button',
        onClick: () => {
          const next = Number(`${value}${digit}`)
          if (next > MAX_VALUE) return
          setValue(next)
        },
      },
      digit,
    )

  return el(
    'div',
    { class: 'card' },
    el('div', { class: 'muted' }, options.label),
    display,
    el(
      'div',
      { class: 'grid-3' },
      ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digitButton),
      el(
        'button',
        {
          class: 'btn',
          type: 'button',
          onClick: () => setValue(Math.floor(value / 10)),
        },
        '⌫',
      ),
      digitButton('0'),
      el('button', { class: 'btn', type: 'button', onClick: () => setValue(0) }, 'C'),
    ),
  )
}
