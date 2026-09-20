import type { Inspection } from '../../../shared/ipc'
import { formatBytes, formatDimensions, formatMs } from '../../../shared/format'
import { subsamplingLabel, chromaLabel } from '../../../shared/plan'
import { describeEncode, errorText } from '../lib/labels'
import { Chip } from './ui'
import { Histogram, HueBars } from './charts'

function pct(f: number, digits = 2): string {
  return `${(f * 100).toFixed(digits)}%`
}

function HowItWasMade({ info }: { info: Inspection['info'] }): React.JSX.Element | null {
  const rows: [string, string][] = []
  if (info.jpeg) {
    const j = info.jpeg
    rows.push(['Quality', j.quality === null ? 'custom tables (not a libjpeg quality)' : `${j.quality} (libjpeg scale)`])
    rows.push(['Chroma', j.subsampling ? subsamplingLabel(j.subsampling) : 'unusual (4:4:0 / 4:1:1)'])
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
    rows.push(['JPEG reconstruction', j.has_jpeg_reconstruction ? 'yes — the original JPEG can be restored' : 'no'])
    rows.push(['Lossless', j.lossless === null ? 'unknown (the file does not say)' : j.lossless ? 'yes' : 'no'])
  }
  if (info.tiff) {
    const t = info.tiff
    rows.push(['Compression', t.compression ? t.compression : `tag ${t.compression_tag} (not writable by the engine)`])
    rows.push(['Predictor', String(t.predictor)])
    rows.push(['Planar', t.planar ? 'yes' : 'no'])
  }
  if (info.is_raw_mosaic) rows.push(['Pixels', 'undemosaiced sensor mosaic'])
  if (rows.length === 0) return null
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function AnalysisPanel({ inspection }: { inspection: Inspection }): React.JSX.Element {
  const { info, stats } = inspection
  const colourChannels = stats ? Math.min(stats.channel_mean.length, 3) : 0
  const channelNames = colourChannels === 1 ? ['Grey'] : ['Red', 'Green', 'Blue']
  const channelColours = colourChannels === 1 ? ['var(--muted)'] : ['#e5484d', '#30a46c', '#3e63dd']
  return (
    <section className="card">
      <h2>Analysis</h2>
      <div className="analysis-grid">
        <div>
          <h3>The file</h3>
          <dl className="kv">
            <div>
              <dt>Format</dt>
              <dd>
                {info.format.toUpperCase()} <span className="muted">({info.input})</span>
              </dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{formatBytes(info.bytes)}</dd>
            </div>
            <div>
              <dt>Pixels</dt>
              <dd>{formatDimensions(info.width, info.height)}</dd>
            </div>
            <div>
              <dt>Samples</dt>
              <dd>
                {info.channels} channel{info.channels === 1 ? '' : 's'} · {info.bits}-bit in file · decodes to {info.depth === 'Eight' ? 8 : 16}-bit
              </dd>
            </div>
            <div>
              <dt>Colour</dt>
              <dd>
                {info.color}{' '}
                <span className="muted">
                  {info.color_source === 'IccProfile' ? '(embedded ICC profile)' : info.color_source === 'Cicp' ? '(CICP code points)' : '(nothing in the file said; assumed)'}
                </span>
              </dd>
            </div>
            {info.is_hdr && (
              <div>
                <dt>HDR</dt>
                <dd>PQ/HLG transfer{info.peak_nits ? ` · peak ${info.peak_nits} cd/m²` : ' · no peak recorded'}</dd>
              </div>
            )}
            <div>
              <dt>Orientation</dt>
              <dd>{info.orientation === 0 ? 'none' : `EXIF ${info.orientation}`}</dd>
            </div>
            <div>
              <dt>Metadata</dt>
              <dd className="row">
                <Chip tone={info.has_exif ? 'ok' : ''}>EXIF</Chip>
                <Chip tone={info.has_icc ? 'ok' : ''}>ICC</Chip>
                <Chip tone={info.has_cicp ? 'ok' : ''}>CICP</Chip>
                <Chip tone={info.has_xmp ? 'ok' : ''}>XMP</Chip>
                <Chip tone={info.has_iptc ? 'ok' : ''}>IPTC</Chip>
              </dd>
            </div>
          </dl>
          <h3>How it was made</h3>
          <HowItWasMade info={info} />
          <p className="muted small">
            {inspection.suggested
              ? `Same-format re-encode the engine can reproduce: ${describeEncode(inspection.suggested)}.`
              : inspection.suggestError
                ? `No same-format encode: ${inspection.suggestError.message}`
                : ''}
          </p>
        </div>
        <div>
          <h3>The pixels</h3>
          {!stats && inspection.statsError && <pre className="error">{errorText(inspection.statsError)}</pre>}
          {stats && (
            <>
              <div className="muted small">
                {stats.space} · {stats.pixels_measured.toLocaleString()} pixels measured · decode {formatMs(stats.decode_ms)} · analyse {formatMs(stats.analyze_ms)}
              </div>
              <Histogram counts={stats.luma_histogram.counts} />
              <div className="percentiles">
                {stats.luma_percentiles.map((p) => (
                  <span key={p.percentile} title={`p${p.percentile}`}>
                    <span className="muted">p{p.percentile}</span> {p.value.toFixed(3)}
                  </span>
                ))}
              </div>
              <dl className="kv">
                <div>
                  <dt>Luma</dt>
                  <dd>
                    mean {stats.luma_mean.toFixed(3)} · σ {stats.luma_stddev.toFixed(3)}
                  </dd>
                </div>
                <div>
                  <dt>Saturation</dt>
                  <dd>
                    mean {stats.mean_saturation.toFixed(3)} · {stats.neutral_pixels.toLocaleString()} neutral pixels
                  </dd>
                </div>
              </dl>
              <table className="table compact">
                <thead>
                  <tr>
                    <th></th>
                    <th>Mean</th>
                    <th>Clipped low</th>
                    <th>Clipped high</th>
                    <th>Grey-world gain</th>
                  </tr>
                </thead>
                <tbody>
                  {channelNames.map((name, i) => (
                    <tr key={name}>
                      <td>
                        <span className="swatch" style={{ background: channelColours[i] }} /> {name}
                      </td>
                      <td>{stats.channel_mean[i]?.toFixed(3)}</td>
                      <td>{pct(stats.clipped_low[i] ?? 0)}</td>
                      <td>{pct(stats.clipped_high[i] ?? 0)}</td>
                      <td>{stats.grey_world_gain[i] == null ? '—' : stats.grey_world_gain[i]!.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="channel-histograms">
                {stats.histograms.slice(0, colourChannels).map((h, i) => (
                  <Histogram key={i} counts={h.counts} color={channelColours[i]} height={40} />
                ))}
              </div>
              {stats.hue_histogram.length > 0 && <HueBars bins={stats.hue_histogram} neutral={stats.neutral_pixels} measured={stats.pixels_measured} />}
            </>
          )}
          {inspection.recommendation.observations.length > 0 && (
            <ul className="observations">
              {inspection.recommendation.observations.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
