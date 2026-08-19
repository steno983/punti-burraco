import './styles/app.css'
import { el } from './ui/dom'
import { registerRoute, startRouter } from './ui/router'

registerRoute('/', () => el('div', {}, el('h1', {}, 'Punti Burraco')))

const container = document.querySelector<HTMLDivElement>('#app')
if (!container) throw new Error('Contenitore #app non trovato')
startRouter(container)
