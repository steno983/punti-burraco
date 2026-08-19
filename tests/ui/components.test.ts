import { describe, it, expect, vi } from 'vitest'
import { createNumpad } from '../../src/ui/components/numpad'
import { createStepper } from '../../src/ui/components/stepper'
import { createToggle } from '../../src/ui/components/toggle'

function click(root: HTMLElement, label: string): void {
  const button = [...root.querySelectorAll('button')].find((b) => b.textContent === label)
  if (!button) throw new Error(`Pulsante "${label}" non trovato`)
  button.click()
}

describe('createNumpad', () => {
  it('compone il numero cifra per cifra', () => {
    const onChange = vi.fn()
    const pad = createNumpad({ label: 'Punti in tavola', value: 0, onChange })
    click(pad, '2')
    click(pad, '8')
    click(pad, '5')
    expect(onChange).toHaveBeenLastCalledWith(285)
    expect(pad.querySelector('[data-role="value"]')?.textContent).toBe('285')
  })

  it('cancella l ultima cifra', () => {
    const onChange = vi.fn()
    const pad = createNumpad({ label: 'Punti', value: 0, onChange })
    click(pad, '1')
    click(pad, '5')
    click(pad, '⌫')
    expect(onChange).toHaveBeenLastCalledWith(1)
  })

  it('azzera il valore', () => {
    const onChange = vi.fn()
    const pad = createNumpad({ label: 'Punti', value: 250, onChange })
    click(pad, 'C')
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('non supera le quattro cifre', () => {
    const onChange = vi.fn()
    const pad = createNumpad({ label: 'Punti', value: 0, onChange })
    for (const digit of ['1', '2', '3', '4', '5']) click(pad, digit)
    expect(onChange).toHaveBeenLastCalledWith(1234)
  })
})

describe('createStepper', () => {
  it('incrementa e decrementa restando nei limiti', () => {
    const onChange = vi.fn()
    const stepper = createStepper({ label: 'Burrachi puliti', value: 0, onChange })
    click(stepper, '−')
    expect(onChange).not.toHaveBeenCalled()
    click(stepper, '+')
    expect(onChange).toHaveBeenLastCalledWith(1)
    click(stepper, '−')
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('rispetta il massimo', () => {
    const onChange = vi.fn()
    const stepper = createStepper({ label: 'Burrachi', value: 9, max: 9, onChange })
    click(stepper, '+')
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('createToggle', () => {
  it('inverte lo stato a ogni pressione', () => {
    const onChange = vi.fn()
    const toggle = createToggle({ label: 'Ha chiuso', checked: false, onChange })
    toggle.querySelector('button')!.click()
    expect(onChange).toHaveBeenLastCalledWith(true)
  })

  it('espone lo stato con aria-pressed', () => {
    const toggle = createToggle({ label: 'Pozzetto preso', checked: true, onChange: () => {} })
    expect(toggle.querySelector('button')?.getAttribute('aria-pressed')).toBe('true')
  })
})
