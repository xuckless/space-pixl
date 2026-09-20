import { useEffect, useState } from 'react'
import type { UpdateChannel, UpdateState, EngineStatus } from '../../shared/ipc'
import type { ProbeResult } from '../../preload/index'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function updateLabel(s: UpdateState): { text: string; tone: 'ok' | 'warn' | 'err' | '' } {
  switch (s.phase) {
    case 'disabled':
      return { text: 'Disabled in development', tone: '' }
    case 'idle':
      return { text: 'Not checked yet', tone: '' }
    case 'checking':
      return { text: 'Checking…', tone: '' }
    case 'available':
      return { text: `Update ${s.version} found`, tone: 'warn' }
    case 'not-available':
      return { text: 'Up to date', tone: 'ok' }
    case 'downloading':
      return { text: `Downloading ${s.version}…`, tone: 'warn' }
    case 'downloaded':
      return { text: `${s.version} ready to install`, tone: 'ok' }
    case 'error':
      return { text: 'Update error', tone: 'err' }
  }
}

function engineLabel(e: EngineStatus | undefined): {
  text: string
  tone: 'ok' | 'warn' | 'err' | ''
} {
  if (!e) return { text: '…', tone: '' }
  switch (e.status) {
    case 'starting':
      return { text: 'Starting', tone: '' }
    case 'ready':
      return { text: `Ready · v${e.version}`, tone: 'ok' }
    case 'unavailable':
      return { text: 'Unavailable', tone: 'warn' }
    case 'crashed':
      return { text: `Crashed (${e.restarts} restarts)`, tone: 'err' }
  }
}

function App(): React.JSX.Element {
  const [appVersion, setAppVersion] = useState('')
  const [updates, setUpdates] = useState<UpdateState | undefined>()
  const [engine, setEngine] = useState<EngineStatus | undefined>()
  const [probe, setProbe] = useState<ProbeResult | undefined>()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.spacePixl.app.version().then(setAppVersion)
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

  const onCheck = async (): Promise<void> => {
    setBusy(true)
    try {
      setUpdates(await window.spacePixl.updates.check())
    } finally {
      setBusy(false)
    }
  }

  const onChannel = async (channel: UpdateChannel): Promise<void> => {
    setUpdates(await window.spacePixl.updates.setChannel(channel))
  }

  const onProbe = async (): Promise<void> => {
    setBusy(true)
    try {
      const result = await window.spacePixl.engine.pickAndProbe()
      if (!(result.ok === false && result.cancelled)) setProbe(result)
    } finally {
      setBusy(false)
    }
  }

  const u = updates
  const ul = u ? updateLabel(u) : { text: '…', tone: '' as const }
  const el = engineLabel(engine)

  return (
    <div className="app">
      <div className="header">
        <h1>Space Pixl</h1>
        <span className="version">v{appVersion || '…'}</span>
      </div>

      <section className="card">
        <h2>Engine</h2>
        <div className="row">
          <span className={`badge ${el.tone}`}>{el.text}</span>
          {engine?.reason && <span className="muted">{engine.reason}</span>}
        </div>
        <div className="row">
          <button onClick={onProbe} disabled={busy || engine?.status !== 'ready'}>
            Probe an image…
          </button>
          {probe && 'path' in probe && probe.path && <span className="muted">{probe.path}</span>}
        </div>
        {probe?.ok && <pre>{JSON.stringify(probe.info, null, 2)}</pre>}
        {probe && probe.ok === false && probe.error && (
          <pre className="error">
            {probe.error.code}: {probe.error.message}
            {probe.error.detail ? '\n' + JSON.stringify(probe.error.detail, null, 2) : ''}
          </pre>
        )}
      </section>

      <section className="card">
        <h2>Updates</h2>
        <div className="row">
          <span className={`badge ${ul.tone}`}>{ul.text}</span>
          {u?.error && <span className="muted">{u.error}</span>}
          {u?.lastCheckedAt && (
            <span className="muted">checked {new Date(u.lastCheckedAt).toLocaleTimeString()}</span>
          )}
          <span className="spacer" />
          <label className="muted">
            Channel{' '}
            <select
              value={u?.channel ?? 'latest'}
              onChange={(e) => void onChannel(e.target.value as UpdateChannel)}
            >
              <option value="latest">Stable</option>
              <option value="beta">Beta</option>
            </select>
          </label>
        </div>
        {u?.progress && (
          <div className="row">
            <progress max={100} value={u.progress.percent} />
            <span className="muted">
              {formatBytes(u.progress.transferred)} / {formatBytes(u.progress.total)} ·{' '}
              {formatBytes(u.progress.bytesPerSecond)}/s
            </span>
          </div>
        )}
        <div className="row">
          <button
            onClick={onCheck}
            disabled={
              busy ||
              !u ||
              u.phase === 'disabled' ||
              u.phase === 'checking' ||
              u.phase === 'downloading'
            }
          >
            Check for updates
          </button>
          {u?.phase === 'downloaded' && (
            <button className="primary" onClick={() => void window.spacePixl.updates.install()}>
              Restart to update
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

export default App
