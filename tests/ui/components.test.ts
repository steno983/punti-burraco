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

  it('con valore iniziale 0 la prima cifra si comporta come sempre (nessun cambiamento)', () => {
    const onChange = vi.fn()
    const pad = createNumpad({ label: 'Punti', value: 0, onChange })
    click(pad, '2')
    click(pad, '8')
    click(pad, '5')
    expect(onChange).toHaveBeenLastCalledWith(285)
    expect(pad.querySelector('[data-role="value"]')?.textContent).toBe('285')
  })

  it('precompilato: la prima cifra sostituisce il valore mostrato, poi si concatena', () => {
    const onChange = vi.fn()
    const pad = createNumpad({ label: 'Punti', value: 250, onChange })
    click(pad, '3')
    expect(onChange).toHaveBeenLastCalledWith(3)
    expect(pad.querySelector('[data-role="value"]')?.textContent).toBe('3')
    click(pad, '0')
    expect(onChange).toHaveBeenLastCalledWith(30)
    click(pad, '0')
    expect(onChange).toHaveBeenLastCalledWith(300)
  })

  it('precompilato: cancellare esce dallo stato iniziale e la composizione riprende normalmente', () => {
    const onChange = vi.fn()
    const pad = createNumpad({ label: 'Punti', value: 250, onChange })
    click(pad, '⌫')
    expect(onChange).toHaveBeenLastCalledWith(25)
    click(pad, '3')
    expect(onChange).toHaveBeenLastCalledWith(253)
  })

  it('protegge da un valore iniziale non intero o non finito, partendo da 0', () => {
    const onChange = vi.fn()
    const pad = createNumpad({ label: 'Punti', value: Number.NaN, onChange })
    expect(pad.querySelector('[data-role="value"]')?.textContent).toBe('0')
    click(pad, '7')
    expect(onChange).toHaveBeenLastCalledWith(7)
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

  it('normalizza un valore iniziale fuori intervallo (clamp) e resta utilizzabile', () => {
    const onChange = vi.fn()
    const stepper = createStepper({ label: 'Burrachi', value: -5, min: 0, max: 9, onChange })
    expect(stepper.querySelector('[data-role="value"]')?.textContent).toBe('0')
    click(stepper, '−')
    expect(onChange).not.toHaveBeenCalled()
    click(stepper, '+')
    expect(onChange).toHaveBeenLastCalledWith(1)
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
