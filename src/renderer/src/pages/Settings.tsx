import { useState } from 'react'
import type { EngineStatus, UpdateChannel, UpdateState } from '../../../shared/ipc'
import { formatBytes } from '../../../shared/format'
import { engineLabel } from '../lib/labels'
import { Chip } from '../components/ui'

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

export function Settings({
  engine,
  updates,
  onUpdates
}: {
  engine: EngineStatus | undefined
  updates: UpdateState | undefined
  onUpdates: (s: UpdateState) => void
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const el = engineLabel(engine)
  const u = updates
  const ul = u ? updateLabel(u) : { text: '…', tone: '' as const }

  const onCheck = async (): Promise<void> => {
    setBusy(true)
    try {
      onUpdates(await window.spacePixl.updates.check())
    } finally {
      setBusy(false)
    }
  }

  const onChannel = async (channel: UpdateChannel): Promise<void> => {
    onUpdates(await window.spacePixl.updates.setChannel(channel))
  }

  return (
    <div>
      <section className="card">
        <h2>Engine</h2>
        <div className="row">
          <Chip tone={el.tone}>{el.text}</Chip>
          {engine?.reason && <span className="muted small">{engine.reason}</span>}
        </div>
        <p className="muted small">
          The PIXL engine runs in its own process; a crash restarts it without taking the app down.
          A packaged build only ever uses the native engine. In development, when no binary exists
          for this platform, a placeholder stands in so the interface can be exercised — every
          number it reports is an estimate and is marked as such.
        </p>
      </section>

      <section className="card">
        <h2>Updates</h2>
        <div className="row">
          <Chip tone={ul.tone}>{ul.text}</Chip>
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
            onClick={() => void onCheck()}
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
