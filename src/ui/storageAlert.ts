import { onStorageError } from '../storage/repository'
import { el } from './dom'

/**
 * Mostra un avviso quando il dispositivo rifiuta di salvare: senza di esso il
 * pulsante premuto sembrerebbe semplicemente non fare niente.
 *
 * L'avviso vive fuori dal contenitore delle schermate, così resta visibile anche
 * quando il router sostituisce la pagina. Restituisce come smettere di ascoltare.
 */
export function installStorageAlert(host: HTMLElement): () => void {
  let banner: HTMLElement | null = null

  return onStorageError((message) => {
    // Un solo avviso alla volta: i salvataggi falliti sono spesso a raffica.
    if (banner?.isConnected) return
    const dismiss = el(
      'button',
      {
        class: 'btn',
        type: 'button',
        onClick: () => {
          banner?.remove()
        },
      },
      'Ho capito',
    )
    banner = el('div', { class: 'alert storage-alert' }, message, dismiss)
    host.append(banner)
  })
}
