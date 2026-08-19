import './styles/app.css'
import { registerRoute, startRouter } from './ui/router'
import { homeScreen } from './ui/screens/home'
import { newGameScreen } from './ui/screens/newGame'

registerRoute('/', homeScreen)
registerRoute('/nuova', newGameScreen)

const container = document.querySelector<HTMLDivElement>('#app')
if (!container) throw new Error('Contenitore #app non trovato')
startRouter(container)
