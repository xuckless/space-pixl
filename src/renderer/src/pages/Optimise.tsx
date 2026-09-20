import { useEffect, useRef, useState } from 'react'
import type { AppError, Conversion, EngineStatus, Inspection, Preview } from '../../../shared/ipc'
import { defaultPlan, describePlan, planIsLossless, planIsReversible, type Plan } from '../../../shared/plan'
import { formatBytes, formatMs, formatPercent, savingFraction } from '../../../shared/format'
import { AnalysisPanel } from '../components/AnalysisPanel'
import { RecommendationPanel } from '../components/RecommendationPanel'
import { DialsPanel } from '../components/DialsPanel'
import { PreviewPanel } from '../components/PreviewPanel'
import { Chip } from '../components/ui'
import { errorText } from '../lib/labels'

const PREVIEW_DEBOUNCE_MS = 450

export function Optimise({ engine, cpus }: { engine: EngineStatus | undefined; cpus: number }): React.JSX.Element {
  const [inspection, setInspection] = useState<Inspection | null>(null)
  const [inspecting, setInspecting] = useState(false)
  const [inspectError, setInspectError] = useState<AppError | null>(null)
  const [plan, setPlan] = useState<Plan>(() => defaultPlan(cpus))
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewError, setPreviewError] = useState<AppError | null>(null)
  const [converting, setConverting] = useState(false)
  const [conversion, setConversion] = useState<Conversion | null>(null)
  const [convertError, setConvertError] = useState<AppError | null>(null)
  const previewSeq = useRef(0)

  const ready = engine?.status === 'ready'

  const pick = async (): Promise<void> => {
    const picked = await window.spacePixl.files.pick()
    if (!picked.ok) return
    setInspecting(true)
    setInspectError(null)
    setConversion(null)
    setConvertError(null)
    setPreview(null)
    setPreviewError(null)
    try {
      const result = await window.spacePixl.engine.inspect(picked.path)
      if (!result.ok) {
        setInspection(null)
        setInspectError(result.error)
        return
      }
      setInspection(result)
      const lead = result.recommendation.candidates[0]
      setPlan(lead ? { ...lead.plan, threads: cpus } : { ...defaultPlan(cpus) })
    } finally {
      setInspecting(false)
    }
  }

  // The live preview: every plan change re-encodes after a short pause; a
  // stale response (an older sequence number) is dropped, never shown.
  useEffect(() => {
    if (!inspection) return
    const seq = ++previewSeq.current
    const path = inspection.path
    const timer = setTimeout(async () => {
      setPreviewing(true)
      const result = await window.spacePixl.engine.preview(path, plan)
      if (seq !== previewSeq.current) return
      setPreviewing(false)
      if (result.ok) {
        setPreview(result)
        setPreviewError(null)
      } else {
        setPreview(null)
        setPreviewError(result.error)
      }
    }, PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [inspection, plan])

  const convert = async (): Promise<void> => {
    if (!inspection) return
    setConverting(true)
    setConvertError(null)
    try {
      const result = await window.spacePixl.engine.convert(inspection.path, plan)
      if (result.ok) setConversion(result)
      else setConvertError(result.error)
    } finally {
      setConverting(false)
    }
  }

  return (
    <div className="optimise">
      <section className="card">
        <div className="row">
          <button className="primary" onClick={() => void pick()} disabled={!ready || inspecting || converting}>
            {inspecting ? 'Analysing…' : inspection ? 'Choose another image…' : 'Choose an image…'}
          </button>
          {inspection && (
            <>
              <span className="mono">{inspection.fileName}</span>
              <span className="muted small">{formatBytes(inspection.info.bytes)} · analysed in {formatMs(inspection.ms)}</span>
              <button className="link" onClick={() => void window.spacePixl.files.reveal(inspection.path)}>
                reveal
              </button>
            </>
          )}
          {!ready && <span className="muted small">{engine?.reason ?? 'The engine is starting.'}</span>}
        </div>
        {inspectError && <pre className="error">{errorText(inspectError)}</pre>}
      </section>

      {inspection && (
        <div className="columns">
          <div className="column">
            <RecommendationPanel recommendation={inspection.recommendation} bytes={inspection.info.bytes} current={plan} onChoose={setPlan} />
            <DialsPanel plan={plan} info={inspection.info} cpus={cpus} onChange={setPlan} />
            <AnalysisPanel inspection={inspection} />
          </div>
          <div className="column sticky">
            <PreviewPanel inspection={inspection} preview={preview} previewing={previewing} previewError={previewError} />
            <section className="card">
              <h2>Convert</h2>
              <div className="row">
                <span className="small">
                  {describePlan(plan)} <Chip tone={planIsLossless(plan) ? 'ok' : 'warn'}>{planIsReversible(plan) ? 'reversible' : planIsLossless(plan) ? 'lossless' : 'lossy'}</Chip>
                </span>
              </div>
              <div className="row">
                <button className="primary" onClick={() => void convert()} disabled={!ready || converting || previewing || !preview}>
                  {converting ? 'Converting…' : 'Convert beside the original'}
                </button>
                <span className="muted small">The original is never touched.</span>
              </div>
              {convertError && <pre className="error">{errorText(convertError)}</pre>}
              {conversion && (
                <div className="result">
                  <div className="row">
                    <Chip tone={conversion.savedBytes > 0 ? 'ok' : 'err'}>
                      {conversion.savedBytes >= 0 ? `saved ${formatBytes(conversion.savedBytes)} (${formatPercent(savingFraction(conversion.inputBytes, conversion.outputBytes), 1)})` : `grew by ${formatBytes(-conversion.savedBytes)}`}
                    </Chip>
                    <span className="muted small">{formatMs(conversion.ms)}</span>
                    {conversion.engine === 'mock' && <Chip tone="warn">placeholder estimate</Chip>}
                  </div>
                  <div className="row">
                    <span className="mono small">{conversion.outputPath}</span>
                    <button className="link" onClick={() => void window.spacePixl.files.reveal(conversion.outputPath)}>
                      reveal
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {!inspection && !inspecting && (
        <section className="card empty">
          <p>Pick an image. Space Pixl will probe the file, measure its pixels, work out how it was encoded, and recommend a conversion — then show you the real result before writing anything.</p>
          <p className="muted small">Reads JPEG, PNG, HEIC, AVIF, JPEG XL, TIFF, WebP and camera RAW. Writes JPEG XL, AVIF, WebP, JPEG, PNG, TIFF and DNG.</p>
        </section>
      )}
    </div>
  )
}
