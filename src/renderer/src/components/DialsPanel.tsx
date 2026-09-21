import type { SourceInfo } from '../../../shared/engine-types'
import {
  TARGETS,
  targetsFor,
  chromaLabel,
  describePlan,
  metadataFor,
  subsamplingLabel,
  type Plan,
  type TargetFormat
} from '../../../shared/plan'
import { Collapsible, Field, GroupHead, IconSliders, Info, Select, Slider, Toggle } from './ui'

type Mutate = (fn: (p: Plan) => void) => void

function EncoderDials({ plan, mutate }: { plan: Plan; mutate: Mutate }): React.JSX.Element | null {
  const bitDepths = [
    { value: '8', label: '8-bit' },
    { value: '10', label: '10-bit' },
    { value: '12', label: '12-bit' }
  ]
  const chromas = (['Half', 'Wide', 'Full'] as const).map((c) => ({
    value: c,
    label: chromaLabel(c)
  }))
  switch (plan.target) {
    case 'jxl-repack':
      return (
        <div className="form">
          <Field label="Effort" hint="1 fast – 9 smallest; 7 is the sweet spot, 9 is a trap">
            <Slider
              label="Effort"
              value={plan.jxlRepack.effort}
              min={1}
              max={9}
              onChange={(v) => mutate((p) => (p.jxlRepack.effort = v))}
            />
          </Field>
        </div>
      )
    case 'jxl-lossy':
      return (
        <div className="form">
          <Field
            label="Distance"
            hint="butteraugli: 0 lossless · 1 visually lossless · higher smaller"
          >
            <Slider
              label="Distance"
              value={plan.jxlLossy.distance}
              min={0}
              max={25}
              step={0.1}
              onChange={(v) => mutate((p) => (p.jxlLossy.distance = v))}
            />
          </Field>
          <Field label="Effort" hint="1 fast – 9 smallest">
            <Slider
              label="Effort"
              value={plan.jxlLossy.effort}
              min={1}
              max={9}
              onChange={(v) => mutate((p) => (p.jxlLossy.effort = v))}
            />
          </Field>
        </div>
      )
    case 'jxl-lossless':
      return (
        <div className="form">
          <Field label="Effort" hint="1 fast – 9 smallest">
            <Slider
              label="Effort"
              value={plan.jxlLossless.effort}
              min={1}
              max={9}
              onChange={(v) => mutate((p) => (p.jxlLossless.effort = v))}
            />
          </Field>
        </div>
      )
    case 'jpeg':
      return (
        <>
          <div className="form">
            <Field label="Quality" hint="1–100">
              <Slider
                label="Quality"
                value={plan.jpeg.quality}
                min={1}
                max={100}
                onChange={(v) => mutate((p) => (p.jpeg.quality = v))}
              />
            </Field>
            <Field label="Chroma">
              <Select
                value={plan.jpeg.subsampling}
                options={(['None', 'Half', 'Quarter', 'Grey'] as const).map((s) => ({
                  value: s,
                  label: subsamplingLabel(s)
                }))}
                onChange={(v) => mutate((p) => (p.jpeg.subsampling = v))}
              />
            </Field>
          </div>
          <div className="checks">
            <Toggle
              label="Optimise Huffman tables (smaller, same pixels)"
              checked={plan.jpeg.optimize}
              onChange={(v) => mutate((p) => (p.jpeg.optimize = v))}
            />
          </div>
        </>
      )
    case 'png':
      return (
        <div className="form">
          <Field label="Compression">
            <Select
              value={plan.png.compression}
              options={(['Fast', 'Balanced', 'Best'] as const).map((s) => ({ value: s, label: s }))}
              onChange={(v) => mutate((p) => (p.png.compression = v))}
            />
          </Field>
          <Field label="Scanline filter">
            <Select
              value={plan.png.filter}
              options={(['Adaptive', 'NoFilter', 'Sub', 'Up', 'Average', 'Paeth'] as const).map(
                (s) => ({ value: s, label: s })
              )}
              onChange={(v) => mutate((p) => (p.png.filter = v))}
            />
          </Field>
        </div>
      )
    case 'avif':
      return (
        <>
          <div className="checks">
            <Toggle
              label="Lossless"
              checked={plan.avif.lossless}
              onChange={(v) => mutate((p) => (p.avif.lossless = v))}
            />
          </div>
          <div className="form">
            <Field label="Quality" hint="1–100">
              <Slider
                label="Quality"
                value={plan.avif.quality}
                min={1}
                max={100}
                disabled={plan.avif.lossless}
                onChange={(v) => mutate((p) => (p.avif.quality = v))}
              />
            </Field>
            <Field label="Speed" hint="0 slowest and smallest – 10 fastest">
              <Slider
                label="Speed"
                value={plan.avif.speed}
                min={0}
                max={10}
                onChange={(v) => mutate((p) => (p.avif.speed = v))}
              />
            </Field>
            <Field label="Bit depth">
              <Select
                value={String(plan.avif.bitDepth)}
                options={bitDepths}
                onChange={(v) => mutate((p) => (p.avif.bitDepth = Number(v) as 8 | 10 | 12))}
              />
            </Field>
            <Field label="Chroma" hint="lossless forces 4:4:4">
              <Select
                value={plan.avif.chroma}
                options={chromas}
                disabled={plan.avif.lossless}
                onChange={(v) => mutate((p) => (p.avif.chroma = v))}
              />
            </Field>
          </div>
        </>
      )
    case 'heic':
      return (
        <>
          <div className="checks">
            <Toggle
              label="Lossless"
              checked={plan.heic.lossless}
              onChange={(v) => mutate((p) => (p.heic.lossless = v))}
            />
          </div>
          <div className="form">
            <Field label="Quality">
              <Slider
                label="Quality"
                value={plan.heic.quality}
                min={1}
                max={100}
                disabled={plan.heic.lossless}
                onChange={(v) => mutate((p) => (p.heic.quality = v))}
              />
            </Field>
            <Field label="Bit depth">
              <Select
                value={String(plan.heic.bitDepth)}
                options={bitDepths}
                onChange={(v) => mutate((p) => (p.heic.bitDepth = Number(v) as 8 | 10 | 12))}
              />
            </Field>
            <Field label="Chroma">
              <Select
                value={plan.heic.chroma}
                options={chromas}
                disabled={plan.heic.lossless}
                onChange={(v) => mutate((p) => (p.heic.chroma = v))}
              />
            </Field>
          </div>
        </>
      )
    case 'webp':
      return (
        <>
          <div className="checks">
            <Toggle
              label="Lossless"
              checked={plan.webp.lossless}
              onChange={(v) => mutate((p) => (p.webp.lossless = v))}
            />
          </div>
          <div className="form">
            <Field label="Quality">
              <Slider
                label="Quality"
                value={plan.webp.quality}
                min={1}
                max={100}
                disabled={plan.webp.lossless}
                onChange={(v) => mutate((p) => (p.webp.quality = v))}
              />
            </Field>
            <Field label="Method" hint="0 fastest – 6 smallest">
              <Slider
                label="Method"
                value={plan.webp.method}
                min={0}
                max={6}
                onChange={(v) => mutate((p) => (p.webp.method = v))}
              />
            </Field>
          </div>
        </>
      )
    case 'tiff':
      return (
        <div className="form">
          <Field label="Compression" hint="all lossless">
            <Select
              value={plan.tiff.compression}
              options={(['Deflate', 'Lzw', 'None'] as const).map((s) => ({ value: s, label: s }))}
              onChange={(v) => mutate((p) => (p.tiff.compression = v))}
            />
          </Field>
        </div>
      )
    case 'dng':
      return (
        <>
          <div className="form">
            <Field label="Compression">
              <Select
                value={plan.dng.compression}
                options={(['Lossless', 'Uncompressed'] as const).map((s) => ({
                  value: s,
                  label: s === 'Lossless' ? 'Lossless JPEG-92' : s
                }))}
                onChange={(v) => mutate((p) => (p.dng.compression = v))}
              />
            </Field>
            <Field label="Crop">
              <Select
                value={plan.dng.crop}
                options={(['Best', 'ActiveArea', 'None'] as const).map((s) => ({
                  value: s,
                  label: s
                }))}
                onChange={(v) => mutate((p) => (p.dng.crop = v))}
              />
            </Field>
          </div>
          <div className="checks">
            <Toggle
              label="Embed the original RAW (larger than the original)"
              checked={plan.dng.embedOriginal}
              onChange={(v) => mutate((p) => (p.dng.embedOriginal = v))}
            />
            <Toggle
              label="Write a preview"
              checked={plan.dng.preview}
              onChange={(v) => mutate((p) => (p.dng.preview = v))}
            />
            <Toggle
              label="Write a thumbnail"
              checked={plan.dng.thumbnail}
              onChange={(v) => mutate((p) => (p.dng.thumbnail = v))}
            />
            <Toggle
              label="Scale black/white levels to full range"
              checked={plan.dng.applyScaling}
              onChange={(v) => mutate((p) => (p.dng.applyScaling = v))}
            />
          </div>
          <div className="form">
            <Field
              label="Predictor"
              hint="Runs from 1 to 7. Stick with 1 for Bayer sensor data — it is the one that is guaranteed safe."
            >
              <Slider
                label="Predictor"
                value={plan.dng.predictor}
                min={1}
                max={7}
                onChange={(v) => mutate((p) => (p.dng.predictor = v))}
              />
            </Field>
          </div>
        </>
      )
    case 'jpeg-from-jxl':
      return <p className="note">No knobs: the original JPEG is restored byte for byte.</p>
  }
}

export function DialsPanel({
  plan,
  info,
  cpus,
  onChange,
  open,
  onToggle
}: {
  plan: Plan
  info: SourceInfo
  cpus: number
  onChange: (p: Plan) => void
  open: boolean
  onToggle: () => void
}): React.JSX.Element {
  const mutate: Mutate = (fn) => {
    const next = structuredClone(plan)
    fn(next)
    onChange(next)
  }
  const target = TARGETS[plan.target]
  const passthrough = target.passthrough
  const allowed = targetsFor(info)
  const targetOptions = allowed.map((t) => ({
    value: t,
    label: TARGETS[t].shipped ? TARGETS[t].label : `${TARGETS[t].label} — not in this build`,
    disabled: !TARGETS[t].shipped
  }))
  const depthOptions = [
    { value: 'keep', label: 'keep source' },
    ...target.depths.map((d) => ({ value: d, label: d === 'Eight' ? '8-bit' : '16-bit' }))
  ]
  const channelLabels: Record<number, string> = {
    1: 'grey',
    2: 'grey + alpha',
    3: 'RGB',
    4: 'RGBA'
  }
  const channelOptions = [
    { value: 'keep', label: 'keep source' },
    ...target.channels.map((c) => ({ value: String(c), label: channelLabels[c] }))
  ]
  const spaces = (
    ['Srgb', 'DisplayP3', 'AdobeRgb', 'Rec2020', 'LinearSrgb', 'GenericGray22'] as const
  ).map((s) => ({
    value: s,
    label: {
      Srgb: 'sRGB',
      DisplayP3: 'Display P3',
      AdobeRgb: 'Adobe RGB (1998)',
      Rec2020: 'Rec.2020 (SDR)',
      LinearSrgb: 'Linear sRGB',
      GenericGray22: 'Grey, gamma 2.2'
    }[s]
  }))
  const intents = (
    ['Perceptual', 'RelativeColorimetric', 'Saturation', 'AbsoluteColorimetric'] as const
  ).map((s) => ({ value: s, label: s.replace(/([A-Z])/g, ' $1').trim() }))
  const showRaw = info.input === 'Raw' && plan.target !== 'dng'
  const sdrTarget = !target.hdrCapable
  // The metadata that will actually be written. A DNG fixes the whole policy;
  // a RAW source has nothing but EXIF to copy, so the other switches are
  // locked off rather than left as a click that would do nothing.
  const metadata = metadataFor(plan, info)
  const dngTarget = plan.target === 'dng'
  const rawSource = info.input === 'Raw'
  const metadataLocked = {
    exif: dngTarget || (rawSource && !info.has_exif),
    icc: dngTarget || (rawSource && !(info.has_icc || info.has_cicp)),
    xmp: dngTarget || (rawSource && !info.has_xmp),
    iptc: dngTarget || (rawSource && !info.has_iptc)
  }
  const unused = passthrough ? ' · not used by this target' : ''

  return (
    <Collapsible
      className="rise d6"
      icon={<IconSliders />}
      title="Dials"
      summary={`${describePlan(plan)} · ${plan.threads} thread${plan.threads === 1 ? '' : 's'}`}
      open={open}
      onToggle={onToggle}
    >
      {/* ── Output ─────────────────────────────────────────────────────── */}
      <div className="group">
        <GroupHead
          info={
            passthrough ? (
              <Info title="Why some dials are greyed out" label="About the output target">
                <p>
                  This target copies the file&apos;s bitstream as-is, so no pixel is ever decoded.
                  That is why resize, pixel, colour and dither settings do not apply here — they
                  only matter once pixels exist.
                </p>
              </Info>
            ) : undefined
          }
        >
          Output
        </GroupHead>
        <div className="form">
          <Field label="Format">
            <Select
              value={plan.target}
              options={targetOptions}
              onChange={(v) => mutate((p) => (p.target = v as TargetFormat))}
            />
          </Field>
        </div>
        {!target.shipped && (
          <p className="note warn">
            HEIC needs an HEVC encoder (x265, GPL), which shipped builds exclude. The engine will
            refuse with EncoderUnavailable.
          </p>
        )}
        {info.is_hdr && sdrTarget && plan.color.policy !== 'ToneMap' && !passthrough && (
          <p className="note warn">
            HDR source into an SDR format: the engine refuses unless Colour is set to Tone map.
          </p>
        )}
        <EncoderDials plan={plan} mutate={mutate} />
        <div className="form">
          <Field
            label="Threads"
            hint={`This machine has ${cpus}. Using them all is fastest; dial it down if you want to keep the rest of the computer responsive while a batch runs.`}
          >
            <Slider
              label="Threads"
              value={plan.threads}
              min={1}
              max={Math.max(1, cpus)}
              onChange={(v) => mutate((p) => (p.threads = v))}
            />
          </Field>
        </div>
      </div>

      {/* ── Size & pixels ──────────────────────────────────────────────── */}
      <div className={`group ${passthrough ? 'dim' : ''}`}>
        <GroupHead>Size &amp; pixels{unused}</GroupHead>
        <div className="form">
          <Field label="Resize">
            <Select
              value={plan.resize.mode}
              disabled={passthrough}
              options={[
                { value: 'none', label: 'keep' },
                { value: 'fit', label: 'fit longer edge' },
                { value: 'scale', label: 'scale by factor' },
                { value: 'exact', label: 'exact size' }
              ]}
              onChange={(v) => mutate((p) => (p.resize.mode = v))}
            />
          </Field>
          {plan.resize.mode === 'fit' && (
            <Field label="Longer edge, px" hint="never enlarges">
              <Slider
                label="Longer edge"
                value={plan.resize.fit}
                min={256}
                max={16384}
                step={64}
                disabled={passthrough}
                onChange={(v) => mutate((p) => (p.resize.fit = v))}
              />
            </Field>
          )}
          {plan.resize.mode === 'scale' && (
            <Field label="Factor">
              <Slider
                label="Factor"
                value={plan.resize.factor}
                min={0.05}
                max={4}
                step={0.05}
                disabled={passthrough}
                onChange={(v) => mutate((p) => (p.resize.factor = v))}
              />
            </Field>
          )}
          {plan.resize.mode === 'exact' && (
            <>
              <Field label="Width">
                <input
                  type="number"
                  className="wide"
                  min={1}
                  value={plan.resize.width}
                  disabled={passthrough}
                  aria-label="Width"
                  onChange={(e) =>
                    mutate((p) => (p.resize.width = Math.max(1, Number(e.target.value) || 1)))
                  }
                />
              </Field>
              <Field label="Height">
                <input
                  type="number"
                  className="wide"
                  min={1}
                  value={plan.resize.height}
                  disabled={passthrough}
                  aria-label="Height"
                  onChange={(e) =>
                    mutate((p) => (p.resize.height = Math.max(1, Number(e.target.value) || 1)))
                  }
                />
              </Field>
            </>
          )}
          {plan.resize.mode !== 'none' && (
            <Field label="Resampler">
              <Select
                value={plan.resampler}
                disabled={passthrough}
                options={(['Lanczos3', 'CatmullRom', 'Bilinear', 'Nearest'] as const).map((s) => ({
                  value: s,
                  label: s
                }))}
                onChange={(v) => mutate((p) => (p.resampler = v))}
              />
            </Field>
          )}
          <Field label="Depth">
            <Select
              value={plan.pixel.depth}
              options={depthOptions}
              disabled={passthrough}
              onChange={(v) => mutate((p) => (p.pixel.depth = v as Plan['pixel']['depth']))}
            />
          </Field>
          <Field label="Channels">
            <Select
              value={String(plan.pixel.channels)}
              options={channelOptions}
              disabled={passthrough}
              onChange={(v) =>
                mutate(
                  (p) => (p.pixel.channels = v === 'keep' ? 'keep' : (Number(v) as 1 | 2 | 3 | 4))
                )
              }
            />
          </Field>
        </div>
        {plan.resize.mode !== 'none' && (
          <div className="checks">
            <Toggle
              label="Resample in linear light (correct, slower)"
              checked={plan.linearResample}
              disabled={passthrough}
              onChange={(v) => mutate((p) => (p.linearResample = v))}
            />
          </div>
        )}
      </div>

      {/* ── Metadata ───────────────────────────────────────────────────── */}
      <div className="group">
        <GroupHead
          info={
            <Info title="Metadata" label="About metadata">
              {dngTarget ? (
                <p>
                  A DNG always carries the camera&apos;s EXIF and nothing else; the engine refuses
                  any other policy, so these are set for you.
                </p>
              ) : rawSource ? (
                <p>
                  A RAW file carries only the camera&apos;s EXIF that can be copied across; there is
                  no ICC, XMP or IPTC to keep, so those switches are off.
                </p>
              ) : (
                <>
                  <p>Whatever you tick is copied across exactly as it is — never rewritten.</p>
                  <p>
                    Be careful with ICC on a wide-gamut photo: turn it off and the result will look
                    wrong just about everywhere it is opened.
                  </p>
                </>
              )}
            </Info>
          }
        >
          Metadata
        </GroupHead>
        <div className="checks inline">
          <Toggle
            label="EXIF"
            checked={metadata.exif}
            disabled={metadataLocked.exif}
            onChange={(v) => mutate((p) => (p.metadata.exif = v))}
          />
          <Toggle
            label="ICC / CICP"
            checked={metadata.icc}
            disabled={metadataLocked.icc}
            onChange={(v) => mutate((p) => (p.metadata.icc = v))}
          />
          <Toggle
            label="XMP"
            checked={metadata.xmp}
            disabled={metadataLocked.xmp}
            onChange={(v) => mutate((p) => (p.metadata.xmp = v))}
          />
          <Toggle
            label="IPTC"
            checked={metadata.iptc}
            disabled={metadataLocked.iptc}
            onChange={(v) => mutate((p) => (p.metadata.iptc = v))}
          />
        </div>
        {dngTarget ? (
          <p className="note">A DNG carries the camera&apos;s EXIF and nothing else.</p>
        ) : rawSource ? (
          <p className="note">Only the camera&apos;s EXIF can be copied from a RAW file.</p>
        ) : (
          <p className="note">Copied verbatim, never rewritten.</p>
        )}
      </div>

      {/* ── Colour & rounding ──────────────────────────────────────────── */}
      <div className={`group ${passthrough ? 'dim' : ''}`}>
        <GroupHead>Colour &amp; rounding{unused}</GroupHead>
        <div className="form">
          <Field label="Policy">
            <Select
              value={plan.color.policy}
              disabled={passthrough}
              options={[
                {
                  value: 'Preserve',
                  label: 'Preserve — keep the description, never touch a pixel'
                },
                { value: 'ConvertTo', label: 'Convert to — transform the pixels into a space' },
                {
                  value: 'Assign',
                  label: 'Assign — re-label without transforming (for files that lie)'
                },
                { value: 'ToneMap', label: 'Tone map — HDR down to SDR' }
              ]}
              onChange={(v) => mutate((p) => (p.color.policy = v))}
            />
          </Field>
          {plan.color.policy !== 'Preserve' && (
            <Field label="Target space">
              <Select
                value={plan.color.to}
                options={spaces}
                disabled={passthrough}
                onChange={(v) => mutate((p) => (p.color.to = v))}
              />
            </Field>
          )}
          {(plan.color.policy === 'ConvertTo' || plan.color.policy === 'ToneMap') && (
            <Field label="Intent">
              <Select
                value={plan.color.intent}
                options={intents}
                disabled={passthrough}
                onChange={(v) => mutate((p) => (p.color.intent = v))}
              />
            </Field>
          )}
          {plan.color.policy === 'ToneMap' && (
            <>
              <Field label="Operator">
                <Select
                  value={plan.color.operator}
                  options={[
                    { value: 'Bt2390', label: 'BT.2390 — broadcast roll-off' },
                    { value: 'Hable', label: 'Hable — filmic shoulder' },
                    { value: 'Reinhard', label: 'Reinhard — gentle' },
                    { value: 'Clip', label: 'Clip — hard' }
                  ]}
                  onChange={(v) => mutate((p) => (p.color.operator = v))}
                />
              </Field>
              <Field label="Source peak">
                <Select
                  value={plan.color.sourcePeak}
                  options={[
                    {
                      value: 'FromFile',
                      label: info.peak_nits
                        ? `from the file (${info.peak_nits} cd/m²)`
                        : 'from the file (this one records none — will fail)'
                    },
                    { value: 'Nits', label: 'stated below' }
                  ]}
                  onChange={(v) => mutate((p) => (p.color.sourcePeak = v))}
                />
              </Field>
              {plan.color.sourcePeak === 'Nits' && (
                <Field label="Source peak, cd/m²">
                  <Slider
                    label="Source peak"
                    value={plan.color.sourcePeakNits}
                    min={100}
                    max={10000}
                    step={10}
                    onChange={(v) => mutate((p) => (p.color.sourcePeakNits = v))}
                  />
                </Field>
              )}
              <Field
                label="Target white, cd/m²"
                hint="100 reference SDR · 203 BT.2408 graphics white"
              >
                <Slider
                  label="Target white"
                  value={plan.color.targetPeakNits}
                  min={80}
                  max={400}
                  onChange={(v) => mutate((p) => (p.color.targetPeakNits = v))}
                />
              </Field>
              <Field label="Out of gamut">
                <Select
                  value={plan.color.gamut}
                  options={[
                    { value: 'Compress', label: 'Compress — desaturate toward the edge' },
                    { value: 'Clip', label: 'Clip — per channel' }
                  ]}
                  onChange={(v) => mutate((p) => (p.color.gamut = v))}
                />
              </Field>
            </>
          )}
          <Field
            label="Dither"
            hint="Only comes into play on float paths — a resize in linear light, a colour transform, a tone map. For a straight copy it does nothing."
          >
            <Select
              value={plan.dither.mode}
              disabled={passthrough}
              options={[
                { value: 'None', label: 'Round to nearest' },
                { value: 'TriangularNoise', label: 'Triangular noise, ±1 step' }
              ]}
              onChange={(v) => mutate((p) => (p.dither.mode = v))}
            />
          </Field>
          {plan.dither.mode === 'TriangularNoise' && (
            <Field label="Seed" hint="The same seed gives the same file.">
              <input
                type="number"
                className="wide"
                min={0}
                value={plan.dither.seed}
                aria-label="Dither seed"
                onChange={(e) =>
                  mutate((p) => (p.dither.seed = Math.max(0, Number(e.target.value) || 0)))
                }
              />
            </Field>
          )}
        </div>
        {(plan.color.policy === 'ConvertTo' || plan.color.policy === 'ToneMap') && (
          <div className="checks">
            <Toggle
              label="Black point compensation"
              checked={plan.color.blackPointCompensation}
              disabled={passthrough}
              onChange={(v) => mutate((p) => (p.color.blackPointCompensation = v))}
            />
          </div>
        )}
      </div>

      {/* ── RAW development ────────────────────────────────────────────── */}
      {showRaw && (
        <div className="group">
          <GroupHead>RAW development</GroupHead>
          <div className="form">
            <Field label="Mode">
              <Select
                value={plan.raw.mode}
                options={[
                  { value: 'Develop', label: 'Develop the sensor data' },
                  { value: 'EmbeddedPreview', label: "Use the camera's embedded JPEG" }
                ]}
                onChange={(v) => mutate((p) => (p.raw.mode = v))}
              />
            </Field>
            {plan.raw.mode === 'Develop' && (
              <Field label="Crop">
                <Select
                  value={plan.raw.crop}
                  options={(['Best', 'ActiveArea', 'None'] as const).map((s) => ({
                    value: s,
                    label: s
                  }))}
                  onChange={(v) => mutate((p) => (p.raw.crop = v))}
                />
              </Field>
            )}
          </div>
          {plan.raw.mode === 'Develop' && (
            <div className="checks">
              <Toggle
                label="Scale black/white levels"
                checked={plan.raw.scaling}
                onChange={(v) => mutate((p) => (p.raw.scaling = v))}
              />
              <Toggle
                label="Demosaic (off gives the raw mosaic as grey)"
                checked={plan.raw.demosaic}
                onChange={(v) => mutate((p) => (p.raw.demosaic = v))}
              />
              <Toggle
                label="Camera colour matrix"
                checked={plan.raw.calibrate}
                onChange={(v) => mutate((p) => (p.raw.calibrate = v))}
              />
              <Toggle
                label="As-shot white balance (needs the colour matrix)"
                checked={plan.raw.whiteBalance}
                disabled={!plan.raw.calibrate}
                onChange={(v) => mutate((p) => (p.raw.whiteBalance = v))}
              />
              <Toggle
                label="sRGB curve (off leaves linear light)"
                checked={plan.raw.srgbGamma}
                onChange={(v) => mutate((p) => (p.raw.srgbGamma = v))}
              />
            </div>
          )}
        </div>
      )}
    </Collapsible>
  )
}
