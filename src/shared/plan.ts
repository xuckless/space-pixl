/**
 * The app's conversion plan: every dial the UI shows, in a flat shape that is
 * easy to bind to controls, plus the one function that turns it into the
 * engine's `ConvertRequest`. The plan is the app's decision; the request is
 * the engine's contract. Nothing in the engine is defaulted — every default
 * lives here, on purpose, where it can be argued about.
 */
import type {
  Chroma,
  ColorPolicy,
  ColorSpaceRef,
  ConvertRequest,
  Depth,
  DngCompression,
  DngCrop,
  Encode,
  GamutMap,
  InputFormat,
  MetadataPolicy,
  PngCompression,
  PngFilter,
  RawMode,
  RenderingIntent,
  Resampler,
  Resize,
  Sink,
  SourceInfo,
  Subsampling,
  TiffCompression,
  ToneMapOperator
} from './engine-types'

export type TargetFormat =
  | 'jxl-repack'
  | 'jxl-lossy'
  | 'jxl-lossless'
  | 'jpeg-from-jxl'
  | 'avif'
  | 'webp'
  | 'jpeg'
  | 'png'
  | 'heic'
  | 'tiff'
  | 'dng'

export interface TargetInfo {
  id: TargetFormat
  label: string
  extension: string
  /** The decoder the output needs — what `probe` would say about it. */
  decodesAs: InputFormat
  /** Copies a bitstream instead of encoding pixels: no resize, no colour, no dither. */
  passthrough: boolean
  /** The only source this target accepts, when there is one. */
  requiresInput: InputFormat | null
  /** The pixel depths the encoder writes. */
  depths: Depth[]
  /** Channel counts the encoder writes; empty for passthrough. */
  channels: number[]
  hdrCapable: boolean
  /** Whether the shipped engine build can produce it. HEIC needs x265 (GPL), which is excluded. */
  shipped: boolean
}

export const TARGETS: Record<TargetFormat, TargetInfo> = {
  'jxl-repack': {
    id: 'jxl-repack',
    label: 'JPEG XL (bit-exact JPEG repack)',
    extension: 'jxl',
    decodesAs: 'Jxl',
    passthrough: true,
    requiresInput: 'Jpeg',
    depths: ['Eight'],
    channels: [],
    hdrCapable: false,
    shipped: true
  },
  'jxl-lossy': {
    id: 'jxl-lossy',
    label: 'JPEG XL (lossy)',
    extension: 'jxl',
    decodesAs: 'Jxl',
    passthrough: false,
    requiresInput: null,
    depths: ['Eight', 'Sixteen'],
    channels: [1, 2, 3, 4],
    hdrCapable: true,
    shipped: true
  },
  'jxl-lossless': {
    id: 'jxl-lossless',
    label: 'JPEG XL (lossless)',
    extension: 'jxl',
    decodesAs: 'Jxl',
    passthrough: false,
    requiresInput: null,
    depths: ['Eight', 'Sixteen'],
    channels: [1, 2, 3, 4],
    hdrCapable: true,
    shipped: true
  },
  'jpeg-from-jxl': {
    id: 'jpeg-from-jxl',
    label: 'JPEG (restored from JPEG XL)',
    extension: 'jpg',
    decodesAs: 'Jpeg',
    passthrough: true,
    requiresInput: 'Jxl',
    depths: ['Eight'],
    channels: [],
    hdrCapable: false,
    shipped: true
  },
  avif: {
    id: 'avif',
    label: 'AVIF',
    extension: 'avif',
    decodesAs: 'Heif',
    passthrough: false,
    requiresInput: null,
    depths: ['Eight', 'Sixteen'],
    channels: [3, 4],
    hdrCapable: true,
    shipped: true
  },
  webp: {
    id: 'webp',
    label: 'WebP',
    extension: 'webp',
    decodesAs: 'WebP',
    passthrough: false,
    requiresInput: null,
    depths: ['Eight'],
    channels: [3, 4],
    hdrCapable: false,
    shipped: true
  },
  jpeg: {
    id: 'jpeg',
    label: 'JPEG',
    extension: 'jpg',
    decodesAs: 'Jpeg',
    passthrough: false,
    requiresInput: null,
    depths: ['Eight'],
    channels: [1, 3],
    hdrCapable: false,
    shipped: true
  },
  png: {
    id: 'png',
    label: 'PNG',
    extension: 'png',
    decodesAs: 'Png',
    passthrough: false,
    requiresInput: null,
    depths: ['Eight', 'Sixteen'],
    channels: [1, 2, 3, 4],
    hdrCapable: true,
    shipped: true
  },
  heic: {
    id: 'heic',
    label: 'HEIC',
    extension: 'heic',
    decodesAs: 'Heif',
    passthrough: false,
    requiresInput: null,
    depths: ['Eight', 'Sixteen'],
    channels: [3, 4],
    hdrCapable: true,
    shipped: false
  },
  tiff: {
    id: 'tiff',
    label: 'TIFF',
    extension: 'tif',
    decodesAs: 'Tiff',
    passthrough: false,
    requiresInput: null,
    depths: ['Eight', 'Sixteen'],
    channels: [1, 2, 3, 4],
    hdrCapable: false,
    shipped: true
  },
  dng: {
    id: 'dng',
    label: 'DNG (lossless RAW container)',
    extension: 'dng',
    decodesAs: 'Raw',
    passthrough: true,
    requiresInput: 'Raw',
    depths: ['Eight', 'Sixteen'],
    channels: [],
    hdrCapable: false,
    shipped: true
  }
}

export const TARGET_ORDER: TargetFormat[] = [
  'jxl-repack',
  'jxl-lossy',
  'jxl-lossless',
  'avif',
  'webp',
  'jpeg',
  'png',
  'tiff',
  'heic',
  'dng',
  'jpeg-from-jxl'
]

/** A colour space the UI can name (the `Icc` variant takes a profile blob and is not offered). */
export type NamedColorSpace = Exclude<ColorSpaceRef, { Icc: number[] }>

export interface Plan {
  target: TargetFormat
  /** Encoder threads for the encoders that take them. */
  threads: number
  jxlLossy: { distance: number; effort: number }
  jxlLossless: { effort: number }
  jxlRepack: { effort: number }
  jpeg: { quality: number; subsampling: Subsampling; optimize: boolean }
  avif: { quality: number; lossless: boolean; bitDepth: 8 | 10 | 12; chroma: Chroma; speed: number }
  heic: { quality: number; lossless: boolean; bitDepth: 8 | 10 | 12; chroma: Chroma }
  webp: { quality: number; lossless: boolean; method: number }
  png: { compression: PngCompression; filter: PngFilter }
  tiff: { compression: TiffCompression }
  dng: {
    compression: DngCompression
    embedOriginal: boolean
    preview: boolean
    thumbnail: boolean
    crop: DngCrop
    applyScaling: boolean
    predictor: number
    index: number
  }
  resize: {
    /** `fit` caps the longer edge at `fit` pixels and never enlarges. */
    mode: 'none' | 'fit' | 'scale' | 'exact'
    fit: number
    factor: number
    width: number
    height: number
  }
  resampler: Exclude<Resampler, 'Ai'>
  linearResample: boolean
  pixel: { depth: 'keep' | Depth; channels: 'keep' | 1 | 2 | 3 | 4 }
  metadata: MetadataPolicy
  color: {
    policy: 'Preserve' | 'Assign' | 'ConvertTo' | 'ToneMap'
    to: NamedColorSpace
    intent: RenderingIntent
    blackPointCompensation: boolean
    operator: ToneMapOperator
    sourcePeak: 'FromFile' | 'Nits'
    sourcePeakNits: number
    targetPeakNits: number
    gamut: GamutMap
  }
  raw: {
    mode: 'Develop' | 'EmbeddedPreview'
    scaling: boolean
    demosaic: boolean
    whiteBalance: boolean
    calibrate: boolean
    srgbGamma: boolean
    crop: DngCrop
  }
  dither: { mode: 'None' | 'TriangularNoise'; seed: number }
}

/** Every dial at the app's chosen starting position. */
export function defaultPlan(threads = 4): Plan {
  return {
    target: 'jxl-lossy',
    threads,
    jxlLossy: { distance: 1.0, effort: 7 },
    jxlLossless: { effort: 7 },
    jxlRepack: { effort: 7 },
    jpeg: { quality: 90, subsampling: 'Quarter', optimize: true },
    avif: { quality: 60, lossless: false, bitDepth: 8, chroma: 'Half', speed: 6 },
    heic: { quality: 80, lossless: false, bitDepth: 8, chroma: 'Half' },
    webp: { quality: 80, lossless: false, method: 6 },
    png: { compression: 'Best', filter: 'Adaptive' },
    tiff: { compression: 'Deflate' },
    dng: {
      compression: 'Lossless',
      embedOriginal: false,
      preview: true,
      thumbnail: true,
      crop: 'Best',
      applyScaling: false,
      predictor: 1,
      index: 0
    },
    resize: { mode: 'none', fit: 4096, factor: 0.5, width: 1920, height: 1080 },
    resampler: 'Lanczos3',
    linearResample: false,
    pixel: { depth: 'keep', channels: 'keep' },
    metadata: { exif: true, icc: true, xmp: true, iptc: true },
    color: {
      policy: 'Preserve',
      to: 'Srgb',
      intent: 'Perceptual',
      blackPointCompensation: true,
      operator: 'Bt2390',
      sourcePeak: 'FromFile',
      sourcePeakNits: 1000,
      targetPeakNits: 203,
      gamut: 'Compress'
    },
    raw: {
      mode: 'Develop',
      scaling: true,
      demosaic: true,
      whiteBalance: true,
      calibrate: true,
      srgbGamma: true,
      crop: 'Best'
    },
    dither: { mode: 'None', seed: 1 }
  }
}

/** The engine `Encode` for the plan's target. */
export function planEncode(plan: Plan): Encode {
  const t = plan.threads
  switch (plan.target) {
    case 'jxl-repack':
      return { JxlJpegRepack: { effort: plan.jxlRepack.effort, threads: t } }
    case 'jxl-lossy':
      return { JxlLossy: { distance: plan.jxlLossy.distance, effort: plan.jxlLossy.effort, threads: t } }
    case 'jxl-lossless':
      return { JxlLossless: { effort: plan.jxlLossless.effort, threads: t } }
    case 'jpeg-from-jxl':
      return 'JpegFromJxl'
    case 'jpeg':
      return { Jpeg: { ...plan.jpeg } }
    case 'png':
      return { Png: { ...plan.png } }
    case 'heic':
      return {
        Heic: {
          quality: plan.heic.quality,
          lossless: plan.heic.lossless,
          bit_depth: plan.heic.bitDepth,
          chroma: plan.heic.lossless ? 'Full' : plan.heic.chroma
        }
      }
    case 'avif':
      return {
        Avif: {
          quality: plan.avif.quality,
          lossless: plan.avif.lossless,
          bit_depth: plan.avif.bitDepth,
          chroma: plan.avif.lossless ? 'Full' : plan.avif.chroma,
          speed: plan.avif.speed
        }
      }
    case 'tiff':
      return { Tiff: { ...plan.tiff } }
    case 'webp':
      return { WebP: { ...plan.webp } }
    case 'dng':
      return {
        Dng: {
          compression: plan.dng.compression,
          embed_original: plan.dng.embedOriginal,
          preview: plan.dng.preview,
          thumbnail: plan.dng.thumbnail,
          crop: plan.dng.crop,
          apply_scaling: plan.dng.applyScaling,
          predictor: plan.dng.predictor,
          index: plan.dng.index
        }
      }
  }
}

/** Whether the plan's encoder discards nothing. */
export function planIsLossless(plan: Plan): boolean {
  switch (plan.target) {
    case 'jxl-repack':
    case 'jxl-lossless':
    case 'jpeg-from-jxl':
    case 'png':
    case 'tiff':
    case 'dng':
      return true
    case 'jxl-lossy':
      return plan.jxlLossy.distance === 0
    case 'avif':
      return plan.avif.lossless
    case 'heic':
      return plan.heic.lossless
    case 'webp':
      return plan.webp.lossless
    case 'jpeg':
      return false
  }
}

/** Whether the original file can be reconstructed byte for byte from the output. */
export function planIsReversible(plan: Plan): boolean {
  return plan.target === 'jxl-repack' || plan.target === 'jpeg-from-jxl'
}

/** A one-line description of the encoder settings, for lists and history. */
export function describePlan(plan: Plan): string {
  switch (plan.target) {
    case 'jxl-repack':
      return `JXL repack · effort ${plan.jxlRepack.effort}`
    case 'jxl-lossy':
      return `JXL · distance ${plan.jxlLossy.distance} · effort ${plan.jxlLossy.effort}`
    case 'jxl-lossless':
      return `JXL lossless · effort ${plan.jxlLossless.effort}`
    case 'jpeg-from-jxl':
      return 'JPEG restored from JXL'
    case 'jpeg':
      return `JPEG · q${plan.jpeg.quality} · ${subsamplingLabel(plan.jpeg.subsampling)}`
    case 'png':
      return `PNG · ${plan.png.compression.toLowerCase()}`
    case 'heic':
      return plan.heic.lossless
        ? `HEIC lossless · ${plan.heic.bitDepth}-bit`
        : `HEIC · q${plan.heic.quality} · ${plan.heic.bitDepth}-bit ${chromaLabel(plan.heic.chroma)}`
    case 'avif':
      return plan.avif.lossless
        ? `AVIF lossless · ${plan.avif.bitDepth}-bit`
        : `AVIF · q${plan.avif.quality} · speed ${plan.avif.speed} · ${plan.avif.bitDepth}-bit ${chromaLabel(plan.avif.chroma)}`
    case 'tiff':
      return `TIFF · ${plan.tiff.compression.toLowerCase()}`
    case 'webp':
      return plan.webp.lossless ? 'WebP lossless' : `WebP · q${plan.webp.quality} · method ${plan.webp.method}`
    case 'dng':
      return `DNG · ${plan.dng.compression.toLowerCase()}`
  }
}

export function subsamplingLabel(s: Subsampling): string {
  return { None: '4:4:4', Half: '4:2:2', Quarter: '4:2:0', Grey: 'greyscale' }[s]
}

export function chromaLabel(c: Chroma): string {
  return { Half: '4:2:0', Wide: '4:2:2', Full: '4:4:4' }[c]
}

/** Which targets a given source can go to at all, in display order. */
export function targetsFor(info: SourceInfo): TargetFormat[] {
  return TARGET_ORDER.filter((t) => {
    const req = TARGETS[t].requiresInput
    if (req && req !== info.input) return false
    if (info.input === 'Raw' && t === 'jpeg-from-jxl') return false
    return true
  })
}

function resizeFor(plan: Plan, info: SourceInfo): Resize {
  switch (plan.resize.mode) {
    case 'none':
      return 'None'
    case 'scale':
      return { Scale: { factor: plan.resize.factor } }
    case 'exact':
      return { Exact: { width: plan.resize.width, height: plan.resize.height } }
    case 'fit': {
      const longer = Math.max(info.width, info.height)
      if (!longer || longer <= plan.resize.fit) return 'None'
      const s = plan.resize.fit / longer
      return {
        Exact: {
          width: Math.max(1, Math.round(info.width * s)),
          height: Math.max(1, Math.round(info.height * s))
        }
      }
    }
  }
}

function colorFor(plan: Plan): ColorPolicy {
  const c = plan.color
  switch (c.policy) {
    case 'Preserve':
      return 'Preserve'
    case 'Assign':
      return { Assign: { to: c.to } }
    case 'ConvertTo':
      return { ConvertTo: { to: c.to, intent: c.intent, black_point_compensation: c.blackPointCompensation } }
    case 'ToneMap':
      return {
        ToneMap: {
          to: c.to,
          operator: c.operator,
          source_peak: c.sourcePeak === 'FromFile' ? 'FromFile' : { Nits: c.sourcePeakNits },
          target_peak_nits: c.targetPeakNits,
          gamut: c.gamut,
          intent: c.intent,
          black_point_compensation: c.blackPointCompensation
        }
      }
  }
}

function rawFor(plan: Plan): RawMode {
  if (plan.raw.mode === 'EmbeddedPreview') return 'EmbeddedPreview'
  const r = plan.raw
  return {
    Develop: {
      scaling: r.scaling,
      demosaic: r.demosaic,
      white_balance: r.whiteBalance,
      calibrate: r.calibrate,
      srgb_gamma: r.srgbGamma,
      crop: r.crop
    }
  }
}

/**
 * The engine request for one plan against one probed source. Pure. The
 * passthrough targets force the fields the engine would refuse anyway
 * (resize, pixel, colour, dither) to their inert values, so a plan built
 * for a lossy target can be switched to a repack without a validation error.
 */
export function buildConvertRequest(
  plan: Plan,
  info: SourceInfo,
  sourcePath: string,
  sink: Sink
): ConvertRequest {
  const target = TARGETS[plan.target]
  const passthrough = target.passthrough
  return {
    source: { Path: sourcePath },
    sink,
    input: info.input,
    resize: passthrough ? 'None' : resizeFor(plan, info),
    resampler: plan.resampler,
    pixel: passthrough
      ? { depth: null, channels: null }
      : {
          depth: plan.pixel.depth === 'keep' ? null : plan.pixel.depth,
          channels: plan.pixel.channels === 'keep' ? null : plan.pixel.channels
        },
    encode: planEncode(plan),
    metadata: { ...plan.metadata },
    color: passthrough ? 'Preserve' : colorFor(plan),
    linear_resample: passthrough ? false : plan.linearResample,
    raw: info.input === 'Raw' && plan.target !== 'dng' ? rawFor(plan) : null,
    upscaler: null,
    grade: null,
    dither: passthrough ? 'None' : plan.dither.mode === 'None' ? 'None' : { TriangularNoise: { seed: plan.dither.seed } }
  }
}

/** The output file name for a source path: same stem, the target's extension. */
export function outputFileName(sourceFileName: string, target: TargetFormat): string {
  const dot = sourceFileName.lastIndexOf('.')
  const stem = dot > 0 ? sourceFileName.slice(0, dot) : sourceFileName
  return `${stem}.${TARGETS[target].extension}`
}
