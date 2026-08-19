import { el } from '../dom'

export function createStepper(options: {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
}): HTMLElement {
  const min = options.min ?? 0
  const max = options.max ?? 9
  let value = options.value

  const display = el('span', { class: 'score', dataset: { role: 'value' } }, String(value))

  const setValue = (next: number): void => {
    if (next < min || next > max) return
    value = next
    display.textContent = String(value)
    options.onChange(value)
  }

  return el(
    'div',
    { class: 'row row--between' },
    el('span', {}, options.label),
    el(
      'span',
      { class: 'row' },
      el('button', { class: 'btn', type: 'button', onClick: () => setValue(value - 1) }, '−'),
      display,
      el('button', { class: 'btn', type: 'button', onClick: () => setValue(value + 1) }, '+'),
    ),
  )
}
