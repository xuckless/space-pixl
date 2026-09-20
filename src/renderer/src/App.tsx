import { useEffect, useState } from 'react'
import type { EngineStatus, UpdateState } from '../../shared/ipc'
import { Optimise } from './pages/Optimise'
import { Stats } from './pages/Stats'
import { Settings } from './pages/Settings'
import { engineLabel } from './lib/labels'

type Page = 'optimise' | 'stats' | 'settings'

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
        <div className="brand">
          <h1>Space Pixl</h1>
          <span className="version">v{appVersion || '…'}</span>
        </div>
        <nav className="tabs">
          {(['optimise', 'stats', 'settings'] as Page[]).map((p) => (
            <button key={p} className={page === p ? 'active' : ''} onClick={() => setPage(p)}>
              {p}
            </button>
          ))}
        </nav>
        <span className={`badge ${el.tone}`} title={engine?.reason}>
          {el.text}
        </span>
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

      <div style={{ display: page === 'optimise' ? 'block' : 'none' }}>
        <Optimise engine={engine} cpus={cpus} />
      </div>
      {page === 'stats' && <Stats active />}
      {page === 'settings' && <Settings engine={engine} updates={updates} onUpdates={setUpdates} />}
    </div>
  )
}

export default App
