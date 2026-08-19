import { el } from '../dom'

const MAX_VALUE = 9999

export function createNumpad(options: {
  label: string
  value: number
  onChange: (value: number) => void
}): HTMLElement {
  let value = Number.isFinite(options.value) && Number.isInteger(options.value) ? options.value : 0
  // Finché non arriva la prima cifra o cancellazione, il valore mostrato è "selezionato":
  // la prossima cifra lo sostituisce invece di concatenarsi, come su una calcolatrice.
  let isInitial = true

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
          const replacing = isInitial
          isInitial = false
          const next = Number(replacing ? digit : `${value}${digit}`)
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
          onClick: () => {
            isInitial = false
            setValue(Math.floor(value / 10))
          },
        },
        '⌫',
      ),
      digitButton('0'),
      el(
        'button',
        {
          class: 'btn',
          type: 'button',
          onClick: () => {
            isInitial = false
            setValue(0)
          },
        },
        'C',
      ),
    ),
  )
}
