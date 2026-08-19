import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { STORAGE_ERROR_MESSAGE, upsertGame } from '../../src/storage/repository'
import { installStorageAlert } from '../../src/ui/storageAlert'
import type { Game } from '../../src/engine/types'

function makeGame(id: string): Game {
  return {
    id,
    mode: 2,
    options: { semipulitoEnabled: true },
    targetScore: 2005,
    players: [
      { playerId: 'p1', name: 'Ann', seat: 0 },
      { playerId: 'p2', name: 'Bob', seat: 1 },
    ],
    teams: [],
    hands: [],
    status: 'in_progress',
    winnerIds: [],
    createdAt: '2026-08-19T10:00:00.000Z',
    updatedAt: '2026-08-19T10:00:00.000Z',
  }
}

/** Safari in navigazione privata e lo spazio esaurito si manifestano così. */
function breakSetItem(): void {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('QuotaExceededError')
  })
}

describe('avviso di salvataggio impossibile', () => {
  let stop: () => void
  let host: HTMLElement

  beforeEach(() => {
    localStorage.clear()
    host = document.createElement('div')
    document.body.append(host)
    stop = installStorageAlert(host)
  })

  afterEach(() => {
    stop()
    host.remove()
    vi.restoreAllMocks()
  })

  it("mostra un messaggio comprensibile quando il dispositivo rifiuta il salvataggio", () => {
    breakSetItem()

    expect(() => upsertGame(makeGame('g1'))).not.toThrow()

    expect(host.textContent).toContain(STORAGE_ERROR_MESSAGE)
    expect(STORAGE_ERROR_MESSAGE).toMatch(/navigazione privata/)
    expect(STORAGE_ERROR_MESSAGE).toMatch(/spazio/)
  })

  it('non duplica l avviso se i salvataggi falliscono più volte', () => {
    breakSetItem()

    upsertGame(makeGame('g1'))
    upsertGame(makeGame('g2'))

    expect(host.querySelectorAll('.storage-alert')).toHaveLength(1)
  })

  it('si può chiudere e ricompare al fallimento successivo', () => {
    breakSetItem()
    upsertGame(makeGame('g1'))

    const dismiss = host.querySelector<HTMLButtonElement>('.storage-alert button')!
    dismiss.click()
    expect(host.querySelector('.storage-alert')).toBeNull()

    upsertGame(makeGame('g2'))
    expect(host.querySelector('.storage-alert')).not.toBeNull()
  })

  it('non mostra nulla quando il salvataggio riesce', () => {
    upsertGame(makeGame('g1'))
    expect(host.querySelector('.storage-alert')).toBeNull()
  })
})
