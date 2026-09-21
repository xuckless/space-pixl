import { useState } from 'react'
import type { AppError, Inspection, Preview } from '../../../shared/ipc'
import { formatBytes, formatMs, formatPercent, savingFraction } from '../../../shared/format'
import { useObjectUrl } from '../lib/useObjectUrl'
import { errorText } from '../lib/labels'
import { Chip, IconArrow, IconCheck, Info, Pill } from './ui'

type Mode = 'before' | 'split' | 'after'

const MODES: { id: Mode; label: string }[] = [
  { id: 'before', label: 'Before' },
  { id: 'split', label: 'Split' },
  { id: 'after', label: 'After' }
]

export function PreviewPanel({
  inspection,
  preview,
  previewing,
  previewError
}: {
  inspection: Inspection
  preview: Preview | null
  previewing: boolean
  previewError: AppError | null
}): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('split')
  const [split, setSplit] = useState(50)
  const [zoom, setZoom] = useState<'fit' | '100'>('fit')
  const beforeUrl = useObjectUrl(inspection.before)
  const afterUrl = useObjectUrl(preview?.after ?? null)
  const saved = preview ? savingFraction(preview.inputBytes, preview.outputBytes) : null
  const mock = preview?.engine === 'mock' || inspection.engine === 'mock'
  const substitute = Boolean(inspection.before?.substitute || preview?.after?.substitute)
  const ratio =
    inspection.before && inspection.before.width > 0 && inspection.before.height > 0
      ? `${inspection.before.width} / ${inspection.before.height}`
      : '3 / 2'
  const splitPos = mode === 'before' ? 100 : mode === 'after' ? 0 : split
  const savePct = saved === null ? 0 : Math.max(0, Math.min(1, saved)) * 100
  const growPct = saved === null ? 0 : Math.max(0, Math.min(1, -saved)) * 100

  return (
    <section className="card rise d2">
      <div className="card-head">
        <h2 className="title">Preview</h2>
        <div className="tools" style={{ gap: 10 }}>
          {previewing && <Pill tone="ac">encoding…</Pill>}
          <div className="seggroup" role="group" aria-label="Compare">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`seg ${mode === m.id ? 'on' : ''}`}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="seggroup" role="group" aria-label="Zoom">
            <button
              type="button"
              className={`seg ${zoom === 'fit' ? 'on' : ''}`}
              onClick={() => setZoom('fit')}
            >
              Fit
            </button>
            <button
              type="button"
              className={`seg ${zoom === '100' ? 'on' : ''}`}
              onClick={() => setZoom('100')}
            >
              1:1
            </button>
          </div>
          <Info title="Reading the preview" label="About the preview">
            <p>
              Left of the line is your original, right of it is what the conversion would produce.
              Drag the slider to compare, or switch to Before and After to see each on its own.
            </p>
            {substitute && !mock && (
              <p>The preview is a fit-to-screen 8-bit render; judge fine detail at 1:1.</p>
            )}
            <p>
              For a lossless target the two sides are identical by definition — the &quot;bit-exact
              copy&quot; tag below is the real check.
            </p>
          </Info>
        </div>
      </div>

      <div className={`stage ${zoom === '100' ? 'zoom' : ''}`} style={{ aspectRatio: ratio }}>
        {beforeUrl && (mode !== 'after' || !afterUrl) && (
          <img className="layer" src={beforeUrl} alt="source" draggable={false} />
        )}
        {afterUrl && mode !== 'before' && (
          <img
            className="layer"
            src={afterUrl}
            alt="encoded"
            draggable={false}
            style={mode === 'split' ? { clipPath: `inset(0 0 0 ${split}%)` } : undefined}
          />
        )}
        {previewing && <span className="shimmer" />}
        {mode === 'split' && afterUrl && zoom === 'fit' && (
          <>
            <div className="handle" style={{ left: `${split}%` }} />
            <span className="tag l">BEFORE · {formatBytes(inspection.info.bytes)}</span>
            {preview && <span className="tag r">AFTER · {formatBytes(preview.outputBytes)}</span>}
          </>
        )}
        {mode === 'split' && afterUrl && zoom === '100' && (
          <div className="handle" style={{ left: `${split}%` }} />
        )}
        {!beforeUrl && !afterUrl && (
          <div className="stage-empty note">
            {inspection.beforeError ? errorText(inspection.beforeError) : 'No render.'}
          </div>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={splitPos}
        disabled={!afterUrl}
        aria-label="Split position"
        style={{ '--p': `${splitPos}%` } as React.CSSProperties}
        onChange={(e) => {
          setSplit(Number(e.target.value))
          setMode('split')
        }}
      />

      {mock && (
        <p className="note warn">
          Placeholder engine: sizes are estimates from the reference measurements and the
          &quot;after&quot; image is the source, not an encode.
        </p>
      )}
      {previewError && <pre className="error">{errorText(previewError)}</pre>}
      {preview?.afterError && (
        <pre className="error">could not render the output: {errorText(preview.afterError)}</pre>
      )}

      {preview && (
        <div className="result">
          <div className="sizes">
            <div className="lead">
              <span className="in">{formatBytes(preview.inputBytes)}</span>
              <IconArrow />
              <span className="out">{formatBytes(preview.outputBytes)}</span>
              <Pill tone={saved !== null && saved > 0 ? 'ok' : 'err'} lg>
                {saved !== null && saved >= 0
                  ? `−${formatPercent(saved, 1)}`
                  : `+${formatPercent(-(saved ?? 0), 1)}`}
              </Pill>
            </div>
            <span className="spec">
              {formatMs(preview.ms)} total · encode {formatMs(preview.report.encode_ms)}
            </span>
          </div>
          <div className="ratio" aria-hidden="true">
            <div className="keep" style={{ width: `${100 - savePct}%` }} />
            {savePct > 0 && <div className="save" style={{ width: `${savePct}%` }} />}
            {growPct > 0 && <div className="save err" style={{ width: `${growPct}%` }} />}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Chip tone={preview.report.loss.quantisations === 0 ? 'ok' : ''}>
              {preview.report.loss.quantisations === 0 && <IconCheck />}
              {preview.report.loss.quantisations === 0
                ? 'bit-exact copy'
                : `${preview.report.loss.quantisations} rounding${preview.report.loss.quantisations === 1 ? '' : 's'}`}
            </Chip>
            <Chip tone={preview.report.loss.lossy_encoder ? 'warn' : 'ok'}>
              {preview.report.loss.lossy_encoder ? 'lossy encoder' : 'lossless encoder'}
            </Chip>
            {preview.report.loss.chroma_subsampled && <Chip>chroma subsampled</Chip>}
            {preview.report.loss.depth_narrowed && (
              <Chip tone="warn">
                {preview.report.loss.source_bits}→{preview.report.loss.output_bits} bits
              </Chip>
            )}
            {preview.report.loss.resampled && <Chip>resampled</Chip>}
            {preview.report.loss.colour_transformed && <Chip>colour transformed</Chip>}
            {preview.report.color.tone_mapped && (
              <Chip>tone mapped {preview.report.color.tone_mapped.operator}</Chip>
            )}
            <Chip>
              {preview.report.color.space}
              {preview.report.color.icc_written ? ' · ICC' : ''}
              {preview.report.color.cicp_written ? ' · CICP' : ''}
            </Chip>
            <Chip>
              metadata:{' '}
              {(['exif', 'icc', 'xmp', 'iptc'] as const)
                .filter((k) => preview.report.metadata_written[k])
                .join(' ') || 'none'}
            </Chip>
            <Chip>
              {preview.report.width} × {preview.report.height} · {preview.report.channels}ch ·{' '}
              {preview.report.depth === 'Eight' ? 8 : 16}-bit
            </Chip>
          </div>
        </div>
      )}
    </section>
  )
}
