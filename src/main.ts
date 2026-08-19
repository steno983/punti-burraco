import './styles/app.css'
import { registerRoute, startRouter } from './ui/router'
import { gameScreen } from './ui/screens/game'
import { handFormScreen } from './ui/screens/handForm'
import { handSummaryScreen } from './ui/screens/handSummary'
import { historyScreen } from './ui/screens/history'
import { homeScreen } from './ui/screens/home'
import { newGameScreen } from './ui/screens/newGame'
import { playersScreen } from './ui/screens/players'

registerRoute('/', homeScreen)
registerRoute('/nuova', newGameScreen)
registerRoute('/partita/:gameId', gameScreen)
registerRoute('/partita/:gameId/smazzata', handFormScreen)
registerRoute('/partita/:gameId/smazzata/:handId', handFormScreen)
registerRoute('/partita/:gameId/riepilogo/:handId', handSummaryScreen)
registerRoute('/storico', historyScreen)
registerRoute('/giocatori', playersScreen)

const container = document.querySelector<HTMLDivElement>('#app')
if (!container) throw new Error('Contenitore #app non trovato')
startRouter(container)
