import { useState } from 'react'
import type { EngineStatus, UpdateChannel, UpdateState } from '../../../shared/ipc'
import { formatBytes } from '../../../shared/format'
import { engineLabel, type Tone } from '../lib/labels'
import { Dot, Fact, Info, Pill } from '../components/ui'

function updateLabel(s: UpdateState): { text: string; tone: Tone } {
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
  onUpdates,
  cpus,
  appVersion
}: {
  engine: EngineStatus | undefined
  updates: UpdateState | undefined
  onUpdates: (s: UpdateState) => void
  cpus: number
  appVersion: string
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
    <div className="page narrow scroll">
      <section className="card rise" style={{ padding: '22px 24px' }}>
        <div className="card-head">
          <div className="lead" style={{ gap: 14 }}>
            <h2 className="title">Engine</h2>
            <Pill tone={el.tone}>
              <Dot tone={engine ? el.tone : 'idle'} sm />
              {el.text}
              {el.version && ` · v${el.version}`}
            </Pill>
            {engine?.flavour && <Pill>{engine.flavour === 'mock' ? 'placeholder' : 'native'}</Pill>}
          </div>
          <Info title="How the engine runs" label="About the engine" wide>
            <p>
              The PIXL engine runs as its own process, so if it ever crashes it simply restarts
              without taking the app down with it. A packaged build always uses the native engine.
            </p>
            <p>
              In development, if there is no binary for this platform, a stand-in takes its place so
              you can still click around — every number it reports is an estimate, and it is
              labelled as one.
            </p>
          </Info>
        </div>
        {engine?.reason && <p className="note">{engine.reason}</p>}
        <div className="facts">
          <Fact label="Process" value="separate · auto-restart" />
          <Fact label="Threads available" value={cpus} />
          <Fact label="Restarts" value={engine ? `${engine.restarts} this session` : '—'} />
        </div>
      </section>

      <section className="card rise d1" style={{ padding: '22px 24px' }}>
        <div className="card-head">
          <div className="lead" style={{ gap: 14 }}>
            <h2 className="title">Updates</h2>
            <Pill tone={ul.tone}>{ul.text}</Pill>
          </div>
          <div className="tools" style={{ gap: 10 }}>
            <label htmlFor="channel" className="small muted">
              Channel
            </label>
            <select
              id="channel"
              style={{ width: 120 }}
              value={u?.channel ?? 'latest'}
              onChange={(e) => void onChannel(e.target.value as UpdateChannel)}
            >
              <option value="latest">Stable</option>
              <option value="beta">Beta</option>
            </select>
            <Info title="Updates" label="About updates">
              <p>
                Packaged builds check for updates on launch and install them in the background.
                Stable gets tested releases; Beta gets them a few weeks earlier.
              </p>
              <p>In a development build there is nothing to update, so checking is switched off.</p>
            </Info>
          </div>
        </div>
        {u?.error && <p className="note err">{u.error}</p>}
        {u?.progress && (
          <div className="row">
            <progress max={100} value={u.progress.percent} />
            <span className="spec">
              {formatBytes(u.progress.transferred)} / {formatBytes(u.progress.total)} ·{' '}
              {formatBytes(u.progress.bytesPerSecond)}/s
            </span>
          </div>
        )}
        <div className="row" style={{ gap: 14 }}>
          <button
            type="button"
            className="btn2"
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
            <button
              type="button"
              className="btn"
              onClick={() => void window.spacePixl.updates.install()}
            >
              Restart to update
            </button>
          )}
          <span className="spec dimmed">
            Space Pixl v{appVersion || '…'}
            {el.version ? ` · engine v${el.version}` : ''}
            {u?.lastCheckedAt ? ` · checked ${new Date(u.lastCheckedAt).toLocaleTimeString()}` : ''}
          </span>
        </div>
      </section>
    </div>
  )
}
