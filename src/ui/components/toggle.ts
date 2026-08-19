import { el } from '../dom'

export function createToggle(options: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}): HTMLElement {
  let checked = options.checked

  const button = el(
    'button',
    {
      class: checked ? 'btn btn--primary' : 'btn',
      type: 'button',
      onClick: () => {
        checked = !checked
        button.className = checked ? 'btn btn--primary' : 'btn'
        button.setAttribute('aria-pressed', String(checked))
        options.onChange(checked)
      },
    },
    options.label,
  )
  button.setAttribute('aria-pressed', String(checked))

  return el('div', {}, button)
}
