import { useState } from 'react'
import type { AppError, Inspection, Preview } from '../../../shared/ipc'
import { formatBytes, formatMs, formatPercent, savingFraction } from '../../../shared/format'
import { useObjectUrl } from '../lib/useObjectUrl'
import { errorText } from '../lib/labels'
import { Chip } from './ui'

type Mode = 'after' | 'before' | 'split'

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

  return (
    <section className="card preview">
      <h2>Preview</h2>
      <div className="row">
        <div className="segmented">
          {(['before', 'split', 'after'] as Mode[]).map((m) => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
        <div className="segmented">
          <button className={zoom === 'fit' ? 'active' : ''} onClick={() => setZoom('fit')}>
            fit
          </button>
          <button className={zoom === '100' ? 'active' : ''} onClick={() => setZoom('100')}>
            1:1
          </button>
        </div>
        <span className="spacer" />
        {previewing && <Chip tone="warn">encoding…</Chip>}
      </div>

      <div className={`stage ${zoom === '100' ? 'zoom' : ''}`}>
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
        {mode === 'split' && afterUrl && (
          <div className="split-line" style={{ left: `${split}%` }} />
        )}
        {!beforeUrl && !afterUrl && (
          <div className="muted stage-empty">
            {inspection.beforeError ? errorText(inspection.beforeError) : 'No render.'}
          </div>
        )}
      </div>
      {mode === 'split' && (
        <input
          className="split-range"
          type="range"
          min={0}
          max={100}
          value={split}
          onChange={(e) => setSplit(Number(e.target.value))}
        />
      )}
      {mock && (
        <p className="warn small">
          Placeholder engine: sizes are estimates from the reference measurements and the
          &quot;after&quot; image is the source, not an encode.
        </p>
      )}
      {(inspection.before?.substitute || preview?.after?.substitute) && !mock && (
        <p className="muted small">
          The preview is a fit-to-screen 8-bit render; judge fine detail at 1:1.
        </p>
      )}

      {previewError && <pre className="error">{errorText(previewError)}</pre>}
      {preview?.afterError && (
        <pre className="error">could not render the output: {errorText(preview.afterError)}</pre>
      )}

      {preview && (
        <>
          <div className="sizes">
            <span>{formatBytes(preview.inputBytes)}</span>
            <span className="muted">→</span>
            <strong>{formatBytes(preview.outputBytes)}</strong>
            <Chip tone={saved !== null && saved > 0 ? 'ok' : 'err'}>
              {saved !== null && saved >= 0
                ? `saves ${formatPercent(saved, 1)}`
                : `grows ${formatPercent(-(saved ?? 0), 1)}`}
            </Chip>
            <span className="muted small">
              {formatMs(preview.ms)} total · encode {formatMs(preview.report.encode_ms)}
            </span>
          </div>
          <div className="row report">
            <Chip tone={preview.report.loss.quantisations === 0 ? 'ok' : ''}>
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
              {preview.report.color.space} {preview.report.color.icc_written ? '· ICC' : ''}{' '}
              {preview.report.color.cicp_written ? '· CICP' : ''}
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
        </>
      )}
    </section>
  )
}
