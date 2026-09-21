import type { Inspection } from '../../../shared/ipc'
import { formatBytes, formatDimensions, formatMs } from '../../../shared/format'
import { subsamplingLabel, chromaLabel } from '../../../shared/plan'
import { describeEncode, errorText } from '../lib/labels'
import { Chip, GroupHead, Info } from './ui'
import { Histogram, HueBars } from './charts'

function pct(f: number, digits = 2): string {
  return `${(f * 100).toFixed(digits)}%`
}

/** `0.10000000149011612` (a float32 that meant 0.1) → `0.1`; `50` → `50`. */
function pctLabel(p: number): string {
  return String(Number(p.toFixed(2)))
}

function madeRows(info: Inspection['info']): [string, string][] {
  const rows: [string, string][] = []
  if (info.jpeg) {
    const j = info.jpeg
    rows.push([
      'Quality',
      j.quality === null ? 'custom tables (not a libjpeg quality)' : `${j.quality} (libjpeg scale)`
    ])
    rows.push([
      'Chroma',
      j.subsampling ? subsamplingLabel(j.subsampling) : 'unusual (4:4:0 / 4:1:1)'
    ])
    rows.push(['Scan', j.progressive ? 'progressive' : 'baseline'])
    rows.push(['Huffman', j.optimized_huffman ? 'optimised tables' : 'standard tables'])
    rows.push(['Components', String(j.components)])
  }
  if (info.heif) {
    const h = info.heif
    rows.push(['Codec', h.codec === 'Av1' ? 'AV1 (AVIF)' : 'HEVC (HEIC)'])
    rows.push(['Chroma', h.chroma ? chromaLabel(h.chroma) : 'monochrome'])
    rows.push(['Bit depth', `${h.bit_depth}-bit`])
    rows.push(['Quality', 'not recorded by the format'])
  }
  if (info.png) {
    const p = info.png
    rows.push(['Bit depth', `${p.bit_depth}-bit ${p.color_type}`])
    rows.push(['Interlaced', p.interlaced ? 'yes (Adam7)' : 'no'])
    rows.push(['Palette', p.has_palette ? 'yes' : 'no'])
  }
  if (info.webp) {
    const w = info.webp
    rows.push(['Coding', w.lossless ? 'lossless (VP8L)' : 'lossy (VP8)'])
    rows.push(['Alpha', w.has_alpha ? 'yes' : 'no'])
    if (w.animated) rows.push(['Animated', 'yes — not convertible'])
  }
  if (info.jxl) {
    const j = info.jxl
    rows.push([
      'JPEG reconstruction',
      j.has_jpeg_reconstruction ? 'yes — the original JPEG can be restored' : 'no'
    ])
    rows.push([
      'Lossless',
      j.lossless === null ? 'unknown (the file does not say)' : j.lossless ? 'yes' : 'no'
    ])
  }
  if (info.tiff) {
    const t = info.tiff
    rows.push([
      'Compression',
      t.compression ? t.compression : `tag ${t.compression_tag} (not writable by the engine)`
    ])
    rows.push(['Predictor', String(t.predictor)])
    rows.push(['Planar', t.planar ? 'yes' : 'no'])
  }
  if (info.is_raw_mosaic) rows.push(['Pixels', 'undemosaiced sensor mosaic'])
  return rows
}

export function AnalysisPanel({ inspection }: { inspection: Inspection }): React.JSX.Element {
  const { info, stats } = inspection
  const colourChannels = stats ? Math.min(stats.channel_mean.length, 3) : 0
  const channelNames = colourChannels === 1 ? ['Grey'] : ['Red', 'Green', 'Blue']
  const channelColours =
    colourChannels === 1 ? ['var(--muted)'] : ['var(--red)', 'var(--green)', 'var(--blue)']
  const made = madeRows(info)
  const encodeNote = inspection.suggested
    ? `Same-format re-encode the engine can reproduce: ${describeEncode(inspection.suggested)}.`
    : inspection.suggestError
      ? `No same-format encode: ${inspection.suggestError.message}`
      : ''
  const observations = inspection.recommendation.observations

  return (
    <section className="card rise" style={{ gap: 20 }}>
      <div className="card-head">
        <h2 className="title sm">Analysis</h2>
        {stats && (
          <span className="spec">
            decode {formatMs(stats.decode_ms)} · analyse {formatMs(stats.analyze_ms)}
          </span>
        )}
      </div>

      {/* ── The file ───────────────────────────────────────────────────── */}
      <div className="group" style={{ gap: 10 }}>
        <GroupHead
          info={
            <Info title="How it was made" label="About how this file was made">
              {made.length > 0 && (
                <ul>
                  {made.map(([k, v]) => (
                    <li key={k}>
                      {k}: {v}
                    </li>
                  ))}
                </ul>
              )}
              {encodeNote ? (
                <p>{encodeNote}</p>
              ) : (
                <p>The engine could not say how this file was encoded.</p>
              )}
            </Info>
          }
        >
          The file
        </GroupHead>
        <dl className="kv">
          <dt>Format</dt>
          <dd>
            {info.format.toUpperCase()} <span className="muted-2">({info.input})</span>
          </dd>
          <dt>Size</dt>
          <dd>{formatBytes(info.bytes)}</dd>
          <dt>Pixels</dt>
          <dd>{formatDimensions(info.width, info.height)}</dd>
          <dt>Samples</dt>
          <dd>
            {info.channels} channel{info.channels === 1 ? '' : 's'} · {info.bits}-bit in file ·
            decodes to {info.depth === 'Eight' ? 8 : 16}-bit
          </dd>
          <dt>Colour</dt>
          <dd>
            {info.color}{' '}
            <span className="muted-2">
              {info.color_source === 'IccProfile'
                ? '(embedded ICC profile)'
                : info.color_source === 'Cicp'
                  ? '(CICP code points)'
                  : '(assumed — the file does not say)'}
            </span>
          </dd>
          {info.is_hdr && (
            <>
              <dt>HDR</dt>
              <dd>
                PQ/HLG transfer
                {info.peak_nits ? ` · peak ${info.peak_nits} cd/m²` : ' · no peak recorded'}
              </dd>
            </>
          )}
          <dt>Orientation</dt>
          <dd>{info.orientation === 0 ? 'none' : `EXIF ${info.orientation}`}</dd>
          <dt>Metadata</dt>
          <dd>
            <div className="row" style={{ gap: 6 }}>
              <Chip tone={info.has_exif ? 'ok' : ''} off={!info.has_exif}>
                EXIF
              </Chip>
              <Chip tone={info.has_icc ? 'ok' : ''} off={!info.has_icc}>
                ICC
              </Chip>
              <Chip tone={info.has_cicp ? 'ok' : ''} off={!info.has_cicp}>
                CICP
              </Chip>
              <Chip tone={info.has_xmp ? 'ok' : ''} off={!info.has_xmp}>
                XMP
              </Chip>
              <Chip tone={info.has_iptc ? 'ok' : ''} off={!info.has_iptc}>
                IPTC
              </Chip>
            </div>
          </dd>
        </dl>
      </div>

      {/* ── How it was made ────────────────────────────────────────────── */}
      {(made.length > 0 || encodeNote) && (
        <div className="group" style={{ gap: 10 }}>
          <GroupHead>How it was made</GroupHead>
          {made.length > 0 && (
            <dl className="kv">
              {made.map(([k, v]) => (
                <div key={k} style={{ display: 'contents' }}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {encodeNote && <p className="note">{encodeNote}</p>}
        </div>
      )}

      {/* ── The pixels ─────────────────────────────────────────────────── */}
      <div className="group" style={{ gap: 10 }}>
        <GroupHead
          info={
            stats ? (
              <Info title="What was measured" label="About the pixel measurements">
                <p>
                  {stats.pixels_measured.toLocaleString()} pixels sampled in {stats.space}. The
                  histogram is log-scaled so shadows and highlights both read.
                </p>
                {observations.length > 0 && (
                  <ul>
                    {observations.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                )}
              </Info>
            ) : undefined
          }
        >
          The pixels
        </GroupHead>
        {!stats && inspection.statsError && (
          <pre className="error">{errorText(inspection.statsError)}</pre>
        )}
        {stats && (
          <>
            <Histogram counts={stats.luma_histogram.counts} label="Luminance histogram" />
            <div className="percentiles">
              {stats.luma_percentiles.map((p) => (
                <span key={p.percentile} title={`p${pctLabel(p.percentile)}`}>
                  p{pctLabel(p.percentile)} <b>{p.value.toFixed(3)}</b>
                </span>
              ))}
            </div>
            <dl className="kv">
              <dt>Luma</dt>
              <dd>
                mean {stats.luma_mean.toFixed(3)} · σ {stats.luma_stddev.toFixed(3)}
              </dd>
              <dt>Saturation</dt>
              <dd>
                mean {stats.mean_saturation.toFixed(3)} · {stats.neutral_pixels.toLocaleString()}{' '}
                neutral pixels
              </dd>
              <dt>Sampled</dt>
              <dd>
                {stats.space} · {stats.pixels_measured.toLocaleString()} pixels
              </dd>
            </dl>
            <div className="channel-table">
              <span />
              <span className="head">Mean</span>
              <span className="head">Clipped low</span>
              <span className="head">Clipped high</span>
              <span className="head">Grey-world gain</span>
              {channelNames.map((name, i) => (
                <div key={name} style={{ display: 'contents' }}>
                  <span className="name">
                    <span className="swatch" style={{ background: channelColours[i] }} />
                    {name}
                  </span>
                  <span className="mono">{stats.channel_mean[i]?.toFixed(3)}</span>
                  <span className="mono">{pct(stats.clipped_low[i] ?? 0)}</span>
                  <span className="mono">{pct(stats.clipped_high[i] ?? 0)}</span>
                  <span className="mono">
                    {stats.grey_world_gain[i] == null ? '—' : stats.grey_world_gain[i]!.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
            <div className="channel-histograms">
              {stats.histograms.slice(0, colourChannels).map((h, i) => (
                <Histogram
                  key={i}
                  counts={h.counts}
                  color={channelColours[i]}
                  height={40}
                  label={`${channelNames[i]} histogram`}
                />
              ))}
            </div>
            {stats.hue_histogram.length > 0 && (
              <HueBars
                bins={stats.hue_histogram}
                neutral={stats.neutral_pixels}
                measured={stats.pixels_measured}
              />
            )}
          </>
        )}
        {observations.map((o) => (
          <p key={o} className="note">
            {o}
          </p>
        ))}
      </div>
    </section>
  )
}
