type ElementProps<K extends keyof HTMLElementTagNameMap> = Partial<
  Omit<HTMLElementTagNameMap[K], 'dataset' | 'style' | 'children'>
> & {
  class?: string
  dataset?: Record<string, string>
  onClick?: (event: MouseEvent) => void
}

/** Crea un elemento con attributi e figli, senza librerie esterne. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps<K> = {},
  ...children: (Node | string | null)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  const { class: className, dataset, onClick, ...rest } = props

  if (className) element.className = className
  if (dataset) for (const [key, value] of Object.entries(dataset)) element.dataset[key] = value
  if (onClick) element.addEventListener('click', onClick as EventListener)
  Object.assign(element, rest)

  for (const child of children) {
    if (child === null) continue
    element.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return element
}

/** Sostituisce il contenuto di un contenitore. */
export function render(container: HTMLElement, content: HTMLElement): void {
  container.replaceChildren(content)
}
