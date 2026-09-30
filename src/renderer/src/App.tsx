import { useEffect, useState } from 'react'
import type { AboutTab, EngineStatus, UpdateState } from '../../shared/ipc'
import { Optimise } from './pages/Optimise'
import { Stats } from './pages/Stats'
import { Settings } from './pages/Settings'
import { engineLabel } from './lib/labels'
import { Dot } from './components/ui'
import { Mark } from './components/brand/Mark'
import { Wordmark } from './components/brand/Wordmark'
import { AboutDialog } from './components/AboutDialog'
import { Splash } from './shell/Splash'

type Page = 'optimise' | 'stats' | 'settings'

const PAGES: { id: Page; label: string }[] = [
  { id: 'optimise', label: 'Optimise' },
  { id: 'stats', label: 'Stats' },
  { id: 'settings', label: 'Settings' }
]

/** Engine status polling: quick while it starts (the splash is waiting), then relaxed. */
const POLL_STARTING_MS = 250
const POLL_MS = 2000

function App(): React.JSX.Element {
  const [page, setPage] = useState<Page>('optimise')
  const [appVersion, setAppVersion] = useState('')
  const [cpus, setCpus] = useState(4)
  const [updates, setUpdates] = useState<UpdateState | undefined>()
  const [engine, setEngine] = useState<EngineStatus | undefined>()
  const [about, setAbout] = useState<{ open: boolean; tab: AboutTab }>({
    open: false,
    tab: 'licence'
  })
  const [markHover, setMarkHover] = useState(false)

  useEffect(() => {
    void window.spacePixl.app.version().then(setAppVersion)
    void window.spacePixl.app.cpus().then(setCpus)
    void window.spacePixl.updates.getState().then(setUpdates)
    const offUpdates = window.spacePixl.updates.onEvent(setUpdates)
    const offAbout = window.spacePixl.app.onOpenAbout((tab) => setAbout({ open: true, tab }))
    const offSettings = window.spacePixl.app.onOpenSettings(() => setPage('settings'))
    return () => {
      offUpdates()
      offAbout()
      offSettings()
    }
  }, [])

  const starting = !engine || engine.status === 'starting'
  useEffect(() => {
    const poll = (): void => void window.spacePixl.engine.status().then(setEngine)
    poll()
    const timer = setInterval(poll, starting ? POLL_STARTING_MS : POLL_MS)
    return () => clearInterval(timer)
  }, [starting])

  const el = engineLabel(engine)
  const openAbout = (tab: AboutTab = 'licence'): void => setAbout({ open: true, tab })

  return (
    <div className="app">
      <Splash engine={engine} />
      <header className="header hl-b">
        <div className="header-left">
          <button
            type="button"
            className="brand"
            onClick={() => openAbout('credits')}
            onMouseEnter={() => setMarkHover(true)}
            onMouseLeave={() => setMarkHover(false)}
            onFocus={() => setMarkHover(true)}
            onBlur={() => setMarkHover(false)}
            aria-label={`About Space Pixl, version ${appVersion}`}
          >
            <Mark size={30} detail="small" motion={markHover ? 'busy' : 'still'} label="" />
            <Wordmark />
            <span className="version">v{appVersion || '…'}</span>
          </button>
          <nav className="tabs" aria-label="Sections">
            {PAGES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`tab ${page === p.id ? 'on' : ''}`}
                aria-current={page === p.id ? 'page' : undefined}
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
          onAbout={openAbout}
        />
      )}

      <AboutDialog
        open={about.open}
        tab={about.tab}
        onTab={(tab) => setAbout({ open: true, tab })}
        onClose={() => setAbout((a) => ({ ...a, open: false }))}
        appVersion={appVersion}
        engineVersion={engine?.version}
      />
    </div>
  )
}

export default App
