import { render } from './dom'

export type Screen = (params: Record<string, string>) => HTMLElement

interface Route {
  pattern: string
  screen: Screen
}

const routes: Route[] = []
let mountPoint: HTMLElement | null = null

/** Confronta una rotta con un percorso, estraendo i parametri con i due punti. */
export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = path.split('/').filter(Boolean)
  if (patternParts.length !== pathParts.length) return null

  const params: Record<string, string> = {}
  for (const [i, part] of patternParts.entries()) {
    if (part.startsWith(':')) {
      try {
        params[part.slice(1)] = decodeURIComponent(pathParts[i])
      } catch {
        // Indirizzo malformato (per esempio incollato a metà): la rotta
        // semplicemente non corrisponde, invece di lasciare la pagina bianca.
        return null
      }
    } else if (part !== pathParts[i]) {
      return null
    }
  }
  return params
}

export function registerRoute(pattern: string, screen: Screen): void {
  routes.push({ pattern, screen })
}

export function navigate(path: string): void {
  window.location.hash = `#${path}`
}

function currentPath(): string {
  const hash = window.location.hash.replace(/^#/, '')
  return hash || '/'
}

function handleRouteChange(): void {
  if (!mountPoint) return
  const path = currentPath()
  for (const route of routes) {
    const params = matchRoute(route.pattern, path)
    if (params) {
      render(mountPoint, route.screen(params))
      window.scrollTo(0, 0)
      return
    }
  }
  navigate('/')
}

export function startRouter(container: HTMLElement): void {
  mountPoint = container
  window.addEventListener('hashchange', handleRouteChange)
  handleRouteChange()
}
