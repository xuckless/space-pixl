/**
 * The app's decision layer: from what the engine measured about a source,
 * which conversions are worth offering and which one to lead with.
 *
 * The engine refuses to make this call ("it depends on the photo, and
 * guessing wrong costs a user their memories"), and its README hands over the
 * measurements this module is built on: one 8 MB JPEG through every sink —
 * JXL repack −19% and bit-exact, AVIF q60 −68%, WebP q80 −59%, JXL distance 1
 * −31%, HEIC +20%, every lossless sink 3–7× larger; a 104 MB 16-bit PNG to
 * AVIF 10-bit −95% and to JXL lossless −37%; a CR2 to DNG −14%. Plus the
 * policies the engine's own notes say belong to the caller: a PNG under 5 MB
 * is not worth converting, HEIC is almost never worth it, effort 9 is a trap.
 *
 * Every expected saving here is a range from those measurements, never a
 * promise; the live preview is what tells the truth for a given file.
 */
import type { Encode, ImageStats, SourceInfo } from './engine-types'
import { defaultPlan, type Plan, type TargetFormat } from './plan'

export type Tier = 'reversible' | 'lossless' | 'visually-lossless' | 'compact'

export interface Candidate {
  id: string
  title: string
  tier: Tier
  plan: Plan
  /** Expected fraction of the file saved, low to high. Negative means it grows. */
  expected: [number, number]
  lossless: boolean
  reversible: boolean
  recommended: boolean
  why: string
  caveats: string[]
}

export type Verdict = 'convert' | 'marginal' | 'skip'

export interface Recommendation {
  verdict: Verdict
  headline: string
  reasons: string[]
  /** Ranked; the recommended one first when there is one. */
  candidates: Candidate[]
  /** What the pixel statistics said, in plain words. */
  observations: string[]
}

const KB = 1024
const MB = 1024 * KB

export const TIER_LABEL: Record<Tier, string> = {
  reversible: 'Reversible',
  lossless: 'Lossless',
  'visually-lossless': 'Visually lossless',
  compact: 'Compact'
}

type Patch = (p: Plan) => void

function plan(base: Plan, target: TargetFormat, ...patches: Patch[]): Plan {
  const p: Plan = structuredClone(base)
  p.target = target
  for (const patch of patches) patch(p)
  return p
}

interface CandidateSpec {
  id: string
  title: string
  tier: Tier
  plan: Plan
  expected: [number, number]
  lossless: boolean
  reversible?: boolean
  why: string
  caveats?: string[]
}

function candidate(spec: CandidateSpec): Candidate {
  return {
    ...spec,
    reversible: spec.reversible ?? false,
    recommended: false,
    caveats: spec.caveats ?? []
  }
}

/** Is a lossy AVIF/WebP/JPEG encode possible for this pixel layout, and what has to change? */
function hasAlpha(info: SourceInfo): boolean {
  return info.channels === 2 || info.channels === 4
}

function isGrey(info: SourceInfo): boolean {
  return info.channels === 1 || info.channels === 2
}

function deep(info: SourceInfo): boolean {
  return info.depth === 'Sixteen'
}

/** AVIF at the settings the README measured: q60 speed 6 for 8-bit, 10-bit 4:4:4 q75 for deep sources. */
function avifPlan(base: Plan, info: SourceInfo, quality: number): Plan {
  return plan(base, 'avif', (p) => {
    p.avif = deep(info)
      ? { quality: Math.max(quality, 75), lossless: false, bitDepth: 10, chroma: 'Full', speed: 6 }
      : { quality, lossless: false, bitDepth: 8, chroma: 'Half', speed: 6 }
    // AVIF writes RGB or RGBA; a grey source has to be expanded.
    if (isGrey(info)) p.pixel.channels = hasAlpha(info) ? 4 : 3
    // An HDR source stays HDR in an HDR-capable sink; nothing to tone map.
    p.color.policy = 'Preserve'
  })
}

function jxlLossy(base: Plan, distance: number, effort = 7): Plan {
  return plan(base, 'jxl-lossy', (p) => {
    p.jxlLossy = { distance, effort }
    p.color.policy = 'Preserve'
  })
}

function jxlLossless(base: Plan, effort = 7): Plan {
  return plan(base, 'jxl-lossless', (p) => {
    p.jxlLossless = { effort }
    p.color.policy = 'Preserve'
  })
}

function webpPlan(base: Plan, info: SourceInfo, quality: number, lossless: boolean): Plan {
  return plan(base, 'webp', (p) => {
    p.webp = { quality: lossless ? 100 : quality, lossless, method: 6 }
    if (deep(info)) p.pixel.depth = 'Eight'
    if (isGrey(info)) p.pixel.channels = hasAlpha(info) ? 4 : 3
  })
}

/** Observations from the pixel statistics. Advisory; the app does not grade. */
export function observe(stats: ImageStats | null): string[] {
  if (!stats) return []
  const out: string[] = []
  const pct = (f: number): string => `${(f * 100).toFixed(1)}%`
  const clippedHigh = Math.max(0, ...stats.clipped_high)
  const clippedLow = Math.max(0, ...stats.clipped_low)
  if (clippedHigh > 0.02) out.push(`${pct(clippedHigh)} of pixels clip to white — detail there is already gone, so a lossy encoder spends nothing on it.`)
  if (clippedLow > 0.05) out.push(`${pct(clippedLow)} of pixels sit at black.`)
  if (stats.luma_stddev < 0.12) out.push('Low contrast, flat tones: this compresses better than the averages below suggest.')
  if (stats.luma_stddev > 0.3) out.push('High contrast with fine tonal range: expect savings at the low end of each range.')
  if (stats.channels >= 3) {
    if (stats.mean_saturation < 0.06) {
      out.push('Almost no colour: a greyscale JPEG (1 channel) or JXL would store the same picture in less space.')
    }
    const gains = stats.grey_world_gain.filter((g): g is number => g !== null)
    if (gains.length === 3) {
      const [r, , b] = gains
      const cast = b - r
      if (cast > 0.12) out.push(`Cool cast (blue gain ${b.toFixed(2)}): the scene reads overcast or shaded.`)
      else if (cast < -0.12) out.push(`Warm cast (red gain ${r.toFixed(2)}): tungsten light or golden hour.`)
    }
    if (stats.pixels_measured > 0 && stats.neutral_pixels / stats.pixels_measured > 0.4) {
      out.push('Mostly neutral pixels: chroma subsampling costs nothing visible here.')
    }
  }
  if (stats.luma_mean < 0.2) out.push('Dark image: keep lossy quality above 60 or shadow noise turns to blocks.')
  return out
}

/** Bump a range's high end for content that compresses well, and the low end for content that does not. */
function adjust(range: [number, number], stats: ImageStats | null): [number, number] {
  if (!stats) return range
  let [lo, hi] = range
  if (stats.luma_stddev < 0.12) hi = Math.min(0.98, hi + 0.05)
  if (stats.luma_stddev > 0.3) lo = Math.max(-1, lo - 0.05)
  return [lo, hi]
}

export function recommend(
  info: SourceInfo,
  stats: ImageStats | null,
  suggested: Encode | null,
  base: Plan = defaultPlan()
): Recommendation {
  const reasons: string[] = []
  const observations = observe(stats)
  let candidates: Candidate[] = []
  let verdict: Verdict = 'convert'
  let headline = ''
  const size = info.bytes
  const hdrCaveat = info.is_hdr
    ? 'HDR (PQ/HLG) source: it stays HDR in this format. An SDR target needs tone mapping, under Colour in the dials.'
    : null

  switch (info.input) {
    case 'Jpeg': {
      candidates.push(
        candidate({
          id: 'jpeg-repack',
          title: 'JPEG XL repack',
          tier: 'reversible',
          plan: plan(base, 'jxl-repack', (p) => (p.jxlRepack.effort = 7)),
          expected: [0.15, 0.22],
          lossless: true,
          reversible: true,
          why: 'No pixel is decoded: the JPEG bitstream is re-packed into a JXL container and can be restored byte for byte. The one conversion that needs no conversation.',
          caveats: ['Viewers that cannot open JPEG XL need the file restored first (this app can).']
        }),
        candidate({
          id: 'jpeg-avif',
          title: 'AVIF',
          tier: 'compact',
          plan: avifPlan(base, info, 60),
          expected: adjust([0.5, 0.7], stats),
          lossless: false,
          why: 'The biggest saving measured: 68% on the reference photo at quality 60. Opens everywhere modern.',
          caveats: ['The JPEG is already lossy; re-encoding compounds the loss. Check the preview at 100%.']
        }),
        candidate({
          id: 'jpeg-webp',
          title: 'WebP',
          tier: 'compact',
          plan: webpPlan(base, info, 80, false),
          expected: adjust([0.5, 0.62], stats),
          lossless: false,
          why: '59% smaller on the reference photo at quality 80; the most widely supported of the modern formats.',
          caveats: ['Always 4:2:0 chroma and 8-bit; no side may exceed 16383 pixels.']
        }),
        candidate({
          id: 'jpeg-jxl',
          title: 'JPEG XL, distance 1',
          tier: 'visually-lossless',
          plan: jxlLossy(base, 1.0),
          expected: adjust([0.25, 0.35], stats),
          lossless: false,
          why: 'Butteraugli distance 1 is the threshold of visible difference; 31% smaller on the reference photo.',
          caveats: ['A second generation of loss, however small. The repack above is free and reversible.']
        })
      )
      if (suggested && typeof suggested !== 'string' && 'Jpeg' in suggested) {
        reasons.push(`This JPEG was written at libjpeg quality ${suggested.Jpeg.quality} (${suggested.Jpeg.subsampling} chroma); a same-format re-encode would only lose detail.`)
      }
      if (size < 150 * KB) {
        verdict = 'marginal'
        headline = 'Small JPEG — the saving will be a few kilobytes.'
        reasons.push('Under 150 KB, even a 68% saving is less than one second of video.')
      } else {
        headline = 'Repack to JPEG XL for a free, reversible 15–20%; go AVIF for the biggest saving.'
      }
      break
    }

    case 'Png': {
      const lossy = deep(info) ? 'AVIF, 10-bit 4:4:4' : 'AVIF'
      candidates.push(
        candidate({
          id: 'png-jxl-lossless',
          title: 'JPEG XL lossless',
          tier: 'lossless',
          plan: jxlLossless(base, 7),
          expected: adjust([0.3, 0.45], stats),
          lossless: true,
          why: 'Every pixel kept; 37% smaller than PNG on the reference 16-bit image. Alpha and 16-bit survive.',
          caveats: info.png?.has_palette ? ['A palette PNG is stored as truecolour: same pixels, but a tiny palette file can grow.'] : []
        }),
        candidate({
          id: 'png-avif',
          title: lossy,
          tier: 'compact',
          plan: avifPlan(base, info, 75),
          expected: adjust(deep(info) ? [0.9, 0.96] : [0.75, 0.9], stats),
          lossless: false,
          why: deep(info)
            ? 'The reference 104 MB 16-bit PNG became 4.9 MB at quality 75 in 10-bit 4:4:4 — a 95% saving.'
            : 'Photographic PNGs are huge for what they show; AVIF at quality 75 keeps the look at a fraction of the size.',
          caveats: ['Not for screenshots, line art or anything with text: lossy encoders smear sharp edges. Use the lossless option for those.']
        }),
        candidate({
          id: 'png-jxl',
          title: 'JPEG XL, distance 1',
          tier: 'visually-lossless',
          plan: jxlLossy(base, 1.0),
          expected: adjust([0.8, 0.9], stats),
          lossless: false,
          why: 'Visually lossless and far smaller than PNG; keeps 16-bit and alpha, which AVIF 8-bit does not.'
        })
      )
      if (!hasAlpha(info) && !deep(info)) {
        candidates.push(
          candidate({
            id: 'png-webp-lossless',
            title: 'WebP lossless',
            tier: 'lossless',
            plan: webpPlan(base, info, 100, true),
            expected: adjust([0.2, 0.35], stats),
            lossless: true,
            why: 'Lossless and widely supported; usually a little smaller than PNG.'
          })
        )
      }
      if (size < 5 * MB) {
        verdict = 'marginal'
        headline = 'A PNG under 5 MB is rarely worth converting.'
        reasons.push('The engine notes say it plainly: a PNG under 5 MB is not worth converting. Lossless gains are small and a lossy encode changes pixels people chose PNG to keep.')
      } else {
        headline = deep(info)
          ? 'A 16-bit PNG: JPEG XL lossless keeps everything; AVIF 10-bit saves over 90%.'
          : 'JPEG XL lossless keeps every pixel; AVIF saves the most if it is a photograph.'
      }
      break
    }

    case 'Heif': {
      const isAvif = info.heif?.codec === 'Av1'
      if (isAvif) {
        verdict = 'skip'
        headline = 'Already AVIF — one of the most efficient formats there is.'
        reasons.push('Re-encoding an AVIF only loses detail. JPEG XL lossless would keep the pixels but the file would grow.')
        candidates.push(
          candidate({
            id: 'avif-jxl-lossless',
            title: 'JPEG XL lossless',
            tier: 'lossless',
            plan: jxlLossless(base, 7),
            expected: [-3, -0.5],
            lossless: true,
            why: 'Only if you need the pixels in JPEG XL; expect the file to grow several times.'
          })
        )
      } else {
        headline = 'HEIC: AVIF is smaller at the same look, but the quality has to be guessed.'
        reasons.push('A HEIC never records the quality it was encoded at, so no same-format re-encode exists; the engine refuses to guess and so does this app — quality 70 is a starting point, check the preview.')
        candidates.push(
          candidate({
            id: 'heic-avif',
            title: 'AVIF',
            tier: 'compact',
            plan: avifPlan(base, info, 70),
            expected: adjust([0.05, 0.3], stats),
            lossless: false,
            why: 'AV1 packs tighter than HEVC at the same look; the reference photo was 20% bigger as HEIC than as JPEG and 68% smaller as AVIF.',
            caveats: ['A second generation of lossy encoding.', ...(hdrCaveat ? [hdrCaveat] : [])]
          }),
          candidate({
            id: 'heic-jxl',
            title: 'JPEG XL, distance 1',
            tier: 'visually-lossless',
            plan: jxlLossy(base, 1.0),
            expected: adjust([-0.1, 0.2], stats),
            lossless: false,
            why: 'Keeps the look and the bit depth; the saving is uncertain because HEIC is already compact.',
            caveats: hdrCaveat ? [hdrCaveat] : []
          })
        )
      }
      break
    }

    case 'Jxl': {
      verdict = 'skip'
      headline = 'Already JPEG XL — nothing to gain.'
      if (info.jxl?.has_jpeg_reconstruction) {
        reasons.push('This file carries JPEG reconstruction data: the original JPEG can be restored byte for byte, which is not a saving but is sometimes what you need.')
        candidates.push(
          candidate({
            id: 'jxl-restore',
            title: 'Restore the original JPEG',
            tier: 'reversible',
            plan: plan(base, 'jpeg-from-jxl'),
            expected: [-0.25, -0.15],
            lossless: true,
            reversible: true,
            why: 'Undoes a repack. The JPEG comes back bit for bit, and about 19% larger.'
          })
        )
      } else {
        reasons.push('JPEG XL is the most efficient format this engine writes; re-encoding it can only lose detail.')
      }
      break
    }

    case 'WebP': {
      if (info.webp?.animated) {
        verdict = 'skip'
        headline = 'Animated WebP — the engine does not convert animations.'
        break
      }
      if (info.webp?.lossless) {
        headline = 'Lossless WebP: JPEG XL lossless is usually smaller.'
        candidates.push(
          candidate({
            id: 'webp-jxl-lossless',
            title: 'JPEG XL lossless',
            tier: 'lossless',
            plan: jxlLossless(base, 7),
            expected: adjust([0.15, 0.35], stats),
            lossless: true,
            why: 'Same pixels, a better entropy coder.'
          })
        )
      } else {
        verdict = 'marginal'
        headline = 'Lossy WebP is already compact; AVIF might shave a little more.'
        reasons.push('A lossy WebP does not record its quality, so the AVIF quality below is a guess.')
        candidates.push(
          candidate({
            id: 'webp-avif',
            title: 'AVIF',
            tier: 'compact',
            plan: avifPlan(base, info, 65),
            expected: adjust([0.05, 0.3], stats),
            lossless: false,
            why: 'AV1 is a generation newer than VP8.',
            caveats: ['A second generation of lossy encoding.']
          })
        )
      }
      break
    }

    case 'Tiff': {
      const uncompressed = info.tiff?.compression_tag === 1
      headline = 'TIFF: JPEG XL lossless keeps every bit and halves the size or better.'
      candidates.push(
        candidate({
          id: 'tiff-jxl-lossless',
          title: 'JPEG XL lossless',
          tier: 'lossless',
          plan: jxlLossless(base, 7),
          expected: adjust(uncompressed ? [0.55, 0.75] : [0.35, 0.55], stats),
          lossless: true,
          why: uncompressed
            ? 'This TIFF is uncompressed; any entropy coder wins, and JXL Modular wins by the most.'
            : 'JXL Modular out-compresses LZW and Deflate on photographic data.'
        }),
        candidate({
          id: 'tiff-avif',
          title: deep(info) ? 'AVIF, 10-bit 4:4:4' : 'AVIF',
          tier: 'compact',
          plan: avifPlan(base, info, 75),
          expected: adjust([0.85, 0.96], stats),
          lossless: false,
          why: 'For a TIFF that only needs to be looked at, not edited again.',
          caveats: ['Not for scans of documents or anything with text.']
        }),
        candidate({
          id: 'tiff-jxl',
          title: 'JPEG XL, distance 1',
          tier: 'visually-lossless',
          plan: jxlLossy(base, 1.0),
          expected: adjust([0.8, 0.92], stats),
          lossless: false,
          why: 'Visually lossless, keeps 16-bit and alpha.'
        })
      )
      break
    }

    case 'Raw': {
      headline = 'RAW: DNG keeps the sensor data losslessly; developing it gives a photo at a tenth of the size.'
      reasons.push('A RAW file is not an image but a grid of sensor readings. Turning it into pixels is a rendering, and one this app makes only when told which.')
      candidates.push(
        candidate({
          id: 'raw-dng',
          title: 'DNG (lossless)',
          tier: 'lossless',
          plan: plan(base, 'dng', (p) => {
            p.dng = { ...p.dng, compression: 'Lossless', crop: 'Best', embedOriginal: false }
          }),
          expected: [0.1, 0.16],
          lossless: true,
          why: 'The reference CR2 became a DNG 14% smaller in half a second, mosaic preserved bit for bit, camera metadata written by rawler.',
          caveats: ['The vendor RAW file itself is not embedded unless you turn that on in the dials (which makes the DNG larger than the original).']
        }),
        candidate({
          id: 'raw-jpeg',
          title: 'Develop to JPEG q92',
          tier: 'compact',
          plan: plan(base, 'jpeg', (p) => {
            p.jpeg = { quality: 92, subsampling: 'Quarter', optimize: true }
            p.raw.mode = 'Develop'
            p.pixel.depth = 'Eight'
          }),
          expected: [0.8, 0.9],
          lossless: false,
          why: "Demosaic with the camera's white balance and colour matrix, then JPEG at quality 92: 35.7 MB became 5.4 MB on the reference file.",
          caveats: ['A rendering, not the sensor data. Keep the RAW if you might edit it later.']
        }),
        candidate({
          id: 'raw-preview',
          title: "Camera's embedded preview → JPEG",
          tier: 'compact',
          plan: plan(base, 'jpeg', (p) => {
            p.jpeg = { quality: 92, subsampling: 'Quarter', optimize: true }
            p.raw.mode = 'EmbeddedPreview'
            p.pixel.depth = 'Eight'
          }),
          expected: [0.8, 0.88],
          lossless: false,
          why: 'Twice as fast and looks exactly as the camera screen did. Its size and rendering are the camera’s call.'
        }),
        candidate({
          id: 'raw-avif',
          title: 'Develop to AVIF, 10-bit',
          tier: 'compact',
          plan: plan(base, 'avif', (p) => {
            p.avif = { quality: 75, lossless: false, bitDepth: 10, chroma: 'Full', speed: 6 }
            p.raw.mode = 'Develop'
          }),
          expected: [0.85, 0.94],
          lossless: false,
          why: '10-bit AVIF keeps more of the sensor’s tonal range than an 8-bit JPEG in less space.'
        })
      )
      break
    }
  }

  if (size < 100 * KB && verdict === 'convert') {
    verdict = 'marginal'
    reasons.push('Under 100 KB there is little to save.')
  }

  // Rank: the recommendation first, then by the middle of the expected range.
  const preferred = leadCandidate(info, candidates)
  candidates = candidates
    .map((c) => ({ ...c, recommended: c.id === preferred }))
    .sort((a, b) => {
      if (a.recommended !== b.recommended) return a.recommended ? -1 : 1
      const ma = (a.expected[0] + a.expected[1]) / 2
      const mb = (b.expected[0] + b.expected[1]) / 2
      return mb - ma
    })

  if (!headline) headline = candidates.length ? 'Options below.' : 'Nothing to do.'
  return { verdict, headline, reasons, candidates, observations }
}

/** Which candidate leads: the free lunch when there is one, else lossless for deep or alpha sources, else the compact option. */
function leadCandidate(info: SourceInfo, candidates: Candidate[]): string | null {
  if (candidates.length === 0) return null
  const ids = new Set(candidates.map((c) => c.id))
  if (ids.has('jpeg-repack')) return 'jpeg-repack'
  if (ids.has('raw-dng')) return 'raw-dng'
  if (info.input === 'Png' && info.bytes < 5 * MB) return 'png-jxl-lossless'
  if (ids.has('png-jxl-lossless') && (hasAlpha(info) || info.png?.has_palette)) return 'png-jxl-lossless'
  if (ids.has('tiff-jxl-lossless')) return 'tiff-jxl-lossless'
  if (ids.has('png-avif')) return 'png-avif'
  if (ids.has('heic-avif')) return 'heic-avif'
  if (ids.has('webp-jxl-lossless')) return 'webp-jxl-lossless'
  return candidates[0].id
}
