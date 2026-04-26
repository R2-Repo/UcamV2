import { BrowserRouter } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { getRouterBasePath } from './shared/lib/basePath'

function App() {
  return (
    <BrowserRouter basename={getRouterBasePath()}>
      <AppShell />
    </BrowserRouter>
  )
}

export default App
