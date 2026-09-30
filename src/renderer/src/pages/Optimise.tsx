import { useEffect, useRef, useState } from 'react'
import type { AppError, Conversion, EngineStatus, Inspection, Preview } from '../../../shared/ipc'
import {
  defaultPlan,
  describePlan,
  planIsLossless,
  planIsReversible,
  type Plan
} from '../../../shared/plan'
import { formatBytes, formatMs, formatPercent, savingFraction } from '../../../shared/format'
import { AnalysisPanel } from '../components/AnalysisPanel'
import { RecommendationPanel } from '../components/RecommendationPanel'
import { DialsPanel } from '../components/DialsPanel'
import { PreviewPanel } from '../components/PreviewPanel'
import { Chip, IconDownload, IconImage, IconWave, Info, Pill } from '../components/ui'
import { Ambient } from '../components/brand/Ambient'
import { Loader } from '../components/brand/Loader'
import { Mark } from '../components/brand/Mark'
import { errorText } from '../lib/labels'

const PREVIEW_DEBOUNCE_MS = 450

export function Optimise({
  engine,
  cpus
}: {
  engine: EngineStatus | undefined
  cpus: number
}): React.JSX.Element {
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
  const [dialsOpen, setDialsOpen] = useState(false)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const previewSeq = useRef(0)

  const ready = engine?.status === 'ready'

  const [pickedName, setPickedName] = useState('')

  const pick = async (): Promise<void> => {
    const picked = await window.spacePixl.files.pick()
    if (!picked.ok) return
    setPickedName(picked.path.split(/[\\/]/).pop() ?? '')
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

  const lossless = planIsLossless(plan)
  const reversible = planIsReversible(plan)
  const megapixels = inspection
    ? ((inspection.info.width * inspection.info.height) / 1e6).toFixed(1)
    : null

  return (
    <div className="page">
      {(inspection || inspecting) && (
        <div className="strip rise">
          <button
            type="button"
            className={inspection ? 'btn2 lg' : 'btn'}
            onClick={() => void pick()}
            disabled={!ready || inspecting || converting}
          >
            {inspecting ? (
              <Loader label="Analysing…" />
            ) : inspection ? (
              'Choose another image…'
            ) : (
              'Choose an image…'
            )}
          </button>
          {inspection ? (
            <div className="file">
              <IconImage />
              <span className="name">{inspection.fileName}</span>
              <span className="divider" />
              <span className="fact-inline">{formatBytes(inspection.info.bytes)}</span>
              <span className="fact-inline">
                {inspection.info.width} × {inspection.info.height}
              </span>
              <span className="fact-inline">{megapixels} MP</span>
              <Pill>analysed in {formatMs(inspection.ms)}</Pill>
              <button
                type="button"
                className="link"
                onClick={() => void window.spacePixl.files.reveal(inspection.path)}
              >
                reveal
              </button>
            </div>
          ) : (
            <div className="file">{pickedName && <span className="name">{pickedName}</span>}</div>
          )}
          {inspection && (
            <button
              type="button"
              className={`btn2 ${analysisOpen ? 'on' : ''}`}
              onClick={() => setAnalysisOpen((o) => !o)}
              aria-expanded={analysisOpen}
            >
              <IconWave />
              {analysisOpen ? 'Hide analysis' : 'Show analysis'}
            </button>
          )}
        </div>
      )}
      {inspectError && <pre className="error">{errorText(inspectError)}</pre>}

      {inspecting && !inspection && (
        <section className="card busy-card rise d1">
          <Loader scale="overlay" label="Measuring every pixel" />
          <p className="note">
            Probing the file, sampling its pixels and working out how it was encoded.
          </p>
        </section>
      )}

      {inspection && (
        <div className="split-grid" key={inspection.path}>
          {inspecting && (
            <div className="busy-over" style={{ borderRadius: 14 }}>
              <Loader scale="overlay" label="Analysing" />
            </div>
          )}
          <div className="col scroll">
            <RecommendationPanel
              recommendation={inspection.recommendation}
              bytes={inspection.info.bytes}
              current={plan}
              onChoose={setPlan}
            />
            <DialsPanel
              plan={plan}
              info={inspection.info}
              cpus={cpus}
              onChange={setPlan}
              open={dialsOpen}
              onToggle={() => setDialsOpen((o) => !o)}
            />
            {analysisOpen && <AnalysisPanel inspection={inspection} />}
          </div>

          <div className="col scroll">
            <PreviewPanel
              inspection={inspection}
              preview={preview}
              previewing={previewing}
              previewError={previewError}
            />

            <section className="card rise d3">
              <div className="card-head">
                <div className="lead">
                  <h2 className="title">Convert</h2>
                  <span className="mono small muted">{describePlan(plan)}</span>
                  <Pill tone={lossless ? 'ok' : ''}>
                    {reversible ? 'reversible' : lossless ? 'lossless' : 'lossy'}
                  </Pill>
                </div>
                <Info title="What happens when you convert" label="What happens when you convert">
                  <p>
                    The new file is written next to the original with the same name and a new
                    extension. Your original is never touched, moved or overwritten — delete it
                    yourself once you are happy with the result.
                  </p>
                  <p>
                    The preview above is a real encode with these exact dials, so the size you see
                    there is the size you will get.
                  </p>
                </Info>
              </div>
              <div className="row" style={{ gap: 16 }}>
                <button
                  type="button"
                  className="btn lg"
                  onClick={() => void convert()}
                  disabled={!ready || converting || previewing || !preview}
                >
                  {converting ? (
                    <Loader label="Converting…" />
                  ) : (
                    <>
                      <IconDownload />
                      Convert beside the original
                    </>
                  )}
                </button>
                <span className="note">The original is never touched.</span>
              </div>
              {convertError && <pre className="error">{errorText(convertError)}</pre>}
              {conversion && (
                <div className="result">
                  <div className="row">
                    <Chip tone={conversion.savedBytes > 0 ? 'ok' : 'err'}>
                      {conversion.savedBytes >= 0
                        ? `saved ${formatBytes(conversion.savedBytes)} (${formatPercent(savingFraction(conversion.inputBytes, conversion.outputBytes), 1)})`
                        : `grew by ${formatBytes(-conversion.savedBytes)}`}
                    </Chip>
                    <Chip>{formatMs(conversion.ms)}</Chip>
                    {conversion.engine === 'mock' && <Chip tone="warn">placeholder estimate</Chip>}
                  </div>
                  <div className="row">
                    <span className="path">{conversion.outputPath}</span>
                    <button
                      type="button"
                      className="link"
                      onClick={() => void window.spacePixl.files.reveal(conversion.outputPath)}
                    >
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
        <section className="hero-empty">
          <Ambient />
          <div className="hero-empty-in rise">
            <Mark size={168} motion={ready ? 'idle' : 'busy'} glow label="" />
            <span className="micro ac">{ready ? 'Start here' : 'Waking the engine'}</span>
            <h2 className="hero-title">
              More space. <span>Same pixels.</span>
            </h2>
            <p className="lede">
              Pick an image. Space Pixl probes the file, measures its pixels, works out how it was
              encoded and recommends a conversion, then shows you the real result before writing
              anything.
            </p>
            <div className="row" style={{ gap: 14, justifyContent: 'center' }}>
              <button
                type="button"
                className="btn lg"
                onClick={() => void pick()}
                disabled={!ready}
              >
                <IconImage color="currentColor" />
                Choose an image…
              </button>
              {!ready && (
                <span className="note">{engine?.reason ?? 'The engine is starting.'}</span>
              )}
            </div>
            <div className="rule center" style={{ maxWidth: 420 }} />
            <p className="note formats">
              Reads JPEG, PNG, HEIC, AVIF, JPEG XL, TIFF, WebP and camera RAW. Writes JPEG XL, AVIF,
              WebP, JPEG, PNG, TIFF and DNG. Your original is never touched.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
