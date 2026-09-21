import { useEffect, useState } from 'react'
import type { EngineStatus, UpdateState } from '../../shared/ipc'
import { Optimise } from './pages/Optimise'
import { Stats } from './pages/Stats'
import { Settings } from './pages/Settings'
import { engineLabel } from './lib/labels'
import { Dot, Logo } from './components/ui'

type Page = 'optimise' | 'stats' | 'settings'

const PAGES: { id: Page; label: string }[] = [
  { id: 'optimise', label: 'Optimise' },
  { id: 'stats', label: 'Stats' },
  { id: 'settings', label: 'Settings' }
]

function App(): React.JSX.Element {
  const [page, setPage] = useState<Page>('optimise')
  const [appVersion, setAppVersion] = useState('')
  const [cpus, setCpus] = useState(4)
  const [updates, setUpdates] = useState<UpdateState | undefined>()
  const [engine, setEngine] = useState<EngineStatus | undefined>()

  useEffect(() => {
    void window.spacePixl.app.version().then(setAppVersion)
    void window.spacePixl.app.cpus().then(setCpus)
    void window.spacePixl.updates.getState().then(setUpdates)
    const off = window.spacePixl.updates.onEvent(setUpdates)
    const poll = (): void => void window.spacePixl.engine.status().then(setEngine)
    poll()
    const timer = setInterval(poll, 2000)
    return () => {
      off()
      clearInterval(timer)
    }
  }, [])

  const el = engineLabel(engine)

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="brand">
            <Logo />
            <h1 className="brand-name">Space Pixl</h1>
            <span className="version">v{appVersion || '…'}</span>
          </div>
          <nav className="tabs" aria-label="Sections">
            {PAGES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`tab ${page === p.id ? 'on' : ''}`}
                onClick={() => setPage(p.id)}
              >
                {p.label}
              </button>
            ))}
          </nav>
        </div>
        <div className={`status ${el.tone}`} title={engine?.reason}>
          <Dot tone={engine ? el.tone : 'idle'} />
          <span>{el.text}</span>
          {el.version && <span className="mono">v{el.version}</span>}
        </div>
      </header>

      {engine?.status === 'ready' && engine.flavour === 'mock' && (
        <div className="banner warn">
          Placeholder engine: {engine.reason ?? 'no native engine for this platform'}. Analysis
          reads real headers; pixel statistics and output sizes are estimates.
        </div>
      )}
      {engine?.status === 'unavailable' && (
        <div className="banner warn">The engine is unavailable: {engine.reason}</div>
      )}
      {engine?.status === 'crashed' && (
        <div className="banner err">The engine crashed: {engine.reason}</div>
      )}

      <div
        style={{
          display: page === 'optimise' ? 'flex' : 'none',
          flexDirection: 'column',
          flexGrow: 1,
          minHeight: 0
        }}
      >
        <Optimise engine={engine} cpus={cpus} />
      </div>
      {page === 'stats' && <Stats active />}
      {page === 'settings' && (
        <Settings
          engine={engine}
          updates={updates}
          onUpdates={setUpdates}
          cpus={cpus}
          appVersion={appVersion}
        />
      )}
    </div>
  )
}

export default App
