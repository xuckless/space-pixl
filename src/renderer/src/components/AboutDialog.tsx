import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import eulaSource from '../../../../legal/EULA.md?raw'
import privacySource from '../../../../legal/PRIVACY.md?raw'
import type { AboutTab, NoticeEntry, Notices } from '../../../shared/ipc'
import { parseMarkdown } from '../lib/markdown'
import { Mark } from './brand/Mark'
import { Wordmark } from './brand/Wordmark'
import { Modal } from './Modal'
import { IconChevron, IconClose, IconExternal, IconSearch } from './ui'

const LEGAL = 'https://space.pixlfoundation.com/legal'
const COPYRIGHT = 'Copyright © 2026 xuckless. All rights reserved.'

const TABS: { id: AboutTab; label: string; online?: string }[] = [
  { id: 'licence', label: 'Licence', online: `${LEGAL}/eula/` },
  { id: 'privacy', label: 'Privacy', online: `${LEGAL}/privacy/` },
  { id: 'third-party', label: 'Third-party', online: `${LEGAL}/third-party/` },
  { id: 'credits', label: 'Credits' }
]

const eula = parseMarkdown(eulaSource)
const privacy = parseMarkdown(privacySource)

/**
 * About Space Pixl: who made it and under what terms. The licence agreement
 * and privacy policy are bundled, so they read offline; the third-party
 * notices come from the file the build generates (scripts/third-party-notices.mjs).
 */
export function AboutDialog({
  open,
  tab,
  onTab,
  onClose,
  appVersion,
  engineVersion
}: {
  open: boolean
  tab: AboutTab
  onTab: (tab: AboutTab) => void
  onClose: () => void
  appVersion: string
  engineVersion?: string
}): React.JSX.Element {
  const current = TABS.find((t) => t.id === tab) ?? TABS[0]
  const draft = eula.meta['draft'] === 'true' || privacy.meta['draft'] === 'true'
  return (
    <Modal open={open} onClose={onClose} labelledBy="about-title" className="about">
      <div className="modal-head hl-b">
        <div className="about-id">
          <Mark size={72} motion={open ? 'idle' : 'still'} glow label="" />
          <div className="who">
            <h2 id="about-title" className="sr-only">
              About Space Pixl
            </h2>
            <Wordmark />
            <div className="facts">
              <span>v{appVersion || '…'}</span>
              <span>PIXL Engine {engineVersion ? `v${engineVersion}` : '—'}</span>
              <span>{COPYRIGHT}</span>
              {draft && <span className="badge">Draft</span>}
            </div>
          </div>
        </div>
        <button type="button" className="close-btn" aria-label="Close" onClick={onClose}>
          <IconClose />
        </button>
      </div>
      <div className="about-tabs">
        <div className="seggroup" role="tablist" aria-label="About">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`about-tab-${t.id}`}
              aria-selected={t.id === tab}
              aria-controls="about-panel"
              className={`seg ${t.id === tab ? 'on' : ''}`}
              onClick={() => onTab(t.id)}
              data-autofocus={t.id === tab ? '' : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
        {current.online && (
          <a className="link row" href={current.online} target="_blank" rel="noreferrer">
            View online <IconExternal />
          </a>
        )}
      </div>
      <div
        className="modal-body"
        id="about-panel"
        role="tabpanel"
        aria-labelledby={`about-tab-${tab}`}
        key={tab}
      >
        {tab === 'licence' && <LegalDoc doc={eula} />}
        {tab === 'privacy' && <LegalDoc doc={privacy} />}
        {tab === 'third-party' && <ThirdParty />}
        {tab === 'credits' && <Credits />}
      </div>
    </Modal>
  )
}

function LegalDoc({ doc }: { doc: ReturnType<typeof parseMarkdown> }): React.JSX.Element {
  return (
    <article className="doc rise">
      <span className="micro ac">Space Pixl · Legal</span>
      <h1>{doc.meta['title']}</h1>
      <p className="meta">
        Last updated {doc.meta['updated']}
        {doc.meta['draft'] === 'true' && ' · draft, not yet in force'}
      </p>
      <hr />
      {doc.body}
    </article>
  )
}

function ThirdParty(): React.JSX.Element {
  const [notices, setNotices] = useState<Notices | null | undefined>()
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim().toLowerCase())
  const [openKey, setOpenKey] = useState<string | null>(null)

  useEffect(() => {
    void window.spacePixl.app.notices().then(setNotices)
  }, [])

  const groups = useMemo(() => {
    if (!notices) return []
    const match = (e: NoticeEntry): boolean =>
      !q || `${e.name} ${e.license} ${e.use ?? ''}`.toLowerCase().includes(q)
    return [
      { id: 'native', title: 'Native components', items: notices.native.filter(match) },
      { id: 'npm', title: 'npm packages', items: notices.packages.filter(match) }
    ]
  }, [notices, q])

  if (notices === undefined) return <p className="note">Loading the notices…</p>
  if (notices === null)
    return (
      <div className="doc">
        <p>
          The third-party notices haven’t been generated for this build. Run{' '}
          <code>pnpm notices</code> after <code>electron-vite build</code>, or read them online.
        </p>
      </div>
    )

  const total = notices.native.length + notices.packages.length
  const shown = groups.reduce((n, g) => n + g.items.length, 0)
  return (
    <div className="rise">
      <div className="notices-tools">
        <label className="search">
          <IconSearch />
          <input
            type="search"
            placeholder="Filter by name or licence"
            aria-label="Filter the third-party notices"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="note mono">
          {shown === total ? `${total} components` : `${shown} of ${total}`}
        </span>
      </div>
      <p className="note" style={{ marginBottom: 14, maxWidth: '72ch' }}>
        Space Pixl includes the open-source software below, each under its own licence. Components
        under the GNU LGPL ship as separate shared libraries you may replace, except where noted;
        their source is at the address given, or on request from hello@pixlfoundation.com for three
        years from when you received this copy.
      </p>
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <section key={g.id} className="notice-group">
              <span className="micro">{g.title}</span>
              {g.items.map((e) => {
                const key = `${g.id}:${e.name}@${e.version ?? ''}`
                const open = openKey === key
                const body =
                  e.text ??
                  e.licenseIds
                    .map((id) => notices.texts[id])
                    .filter(Boolean)
                    .join('\n\n')
                return (
                  <div key={key} className={`notice ${open ? 'open' : ''}`}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenKey(open ? null : key)}
                    >
                      <span className="name">
                        {e.name}
                        {e.version && <span className="v">{e.version}</span>}
                        {e.use && <span className="note-line">{e.use}</span>}
                      </span>
                      <span className={`pill ${/LGPL|GPL/.test(e.license) ? 'warn' : ''}`}>
                        {e.license}
                      </span>
                      <IconChevron />
                    </button>
                    {open && (
                      <div className="stack tight" style={{ padding: '0 4px 4px' }}>
                        {e.copyright && <span className="note">{e.copyright}</span>}
                        {e.dynamic && (
                          <span className="note">
                            Shipped as a separate shared library, loaded at run time.
                          </span>
                        )}
                        {e.note && <span className="note warn">{e.note}</span>}
                        <a className="link" href={e.source} target="_blank" rel="noreferrer">
                          {e.source}
                        </a>
                        {body && <pre>{body}</pre>}
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          )
      )}
      {shown === 0 && <p className="note">Nothing matches “{query}”.</p>}
    </div>
  )
}

function Credits(): React.JSX.Element {
  return (
    <div className="stack loose rise">
      <div className="credits">
        <div className="credit">
          <span className="micro ac">The core</span>
          <span className="who">PIXL Engine</span>
          <p>
            The imaging core Space Pixl runs on, shared with Pixl Playroom: Rust, in its own
            process, so it can restart without taking the app down with it.
          </p>
        </div>
        <div className="credit">
          <span className="micro ac">The maker</span>
          <span className="who">PIXL Foundation</span>
          <p>Design, brand and apps. Space Pixl is one of the PIXL family, with Pixl Playroom.</p>
        </div>
        <div className="credit">
          <span className="micro">Type</span>
          <span className="who">Space Grotesk · Manrope · JetBrains Mono</span>
          <p>
            By Florian Karsten, Mikhail Sharanda and JetBrains, each under the SIL Open Font License
            1.1 (see Third-party).
          </p>
        </div>
        <div className="credit">
          <span className="micro">Runtime</span>
          <span className="who">Electron · React</span>
          <p>The app shell and its interface, under the MIT licence (see Third-party).</p>
        </div>
      </div>
      <div className="rule" />
      <p className="note" style={{ maxWidth: '72ch' }}>
        The source code of Space Pixl is published for reference only; see the LICENSE file in its
        repository. The Space Pixl name and mark are the PIXL Foundation’s.
      </p>
    </div>
  )
}
