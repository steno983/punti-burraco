import './styles/app.css'
import { registerRoute, startRouter } from './ui/router'
import { gameScreen } from './ui/screens/game'
import { handFormScreen } from './ui/screens/handForm'
import { homeScreen } from './ui/screens/home'
import { newGameScreen } from './ui/screens/newGame'

registerRoute('/', homeScreen)
registerRoute('/nuova', newGameScreen)
registerRoute('/partita/:gameId', gameScreen)
registerRoute('/partita/:gameId/smazzata', handFormScreen)
registerRoute('/partita/:gameId/smazzata/:handId', handFormScreen)

const container = document.querySelector<HTMLDivElement>('#app')
if (!container) throw new Error('Contenitore #app non trovato')
startRouter(container)
