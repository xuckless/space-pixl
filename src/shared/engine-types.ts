/**
 * The PIXL engine's request and report model, in the serde shape the Node
 * binding speaks: externally tagged enums (`{ Variant: { ...fields } }`, unit
 * variants as bare strings), snake_case fields, every field present. Mirrors
 * pixl-engine/src/request.rs, analyze.rs, source_info.rs and color/mod.rs.
 *
 * Nothing here has a default. The engine makes no decisions; the app does,
 * in `plan.ts` and `recommend.ts`.
 */

// ── Sources and sinks ────────────────────────────────────────────────────────

export type Source = { Path: string } | { Bytes: number[] }
export type Sink = { Path: string } | 'Bytes'

export type InputFormat = 'Jpeg' | 'Png' | 'Heif' | 'Jxl' | 'Tiff' | 'WebP' | 'Raw'

export type Depth = 'Eight' | 'Sixteen'

// ── Geometry ─────────────────────────────────────────────────────────────────

export type Resize = 'None' | { Exact: { width: number; height: number } } | { Scale: { factor: number } }

export type Resampler = 'Nearest' | 'Bilinear' | 'CatmullRom' | 'Lanczos3' | 'Ai'

export interface PixelSpec {
  depth: Depth | null
  /** 1 grey, 2 grey+alpha, 3 RGB, 4 RGBA */
  channels: number | null
}

// ── RAW ──────────────────────────────────────────────────────────────────────

export type DngCrop = 'None' | 'ActiveArea' | 'Best'

export type RawMode =
  | {
      Develop: {
        scaling: boolean
        demosaic: boolean
        white_balance: boolean
        calibrate: boolean
        srgb_gamma: boolean
        crop: DngCrop
      }
    }
  | 'EmbeddedPreview'

// ── Encoders ─────────────────────────────────────────────────────────────────

export type Subsampling = 'None' | 'Half' | 'Quarter' | 'Grey'
export type Chroma = 'Half' | 'Wide' | 'Full'
export type PngCompression = 'Fast' | 'Balanced' | 'Best'
export type PngFilter = 'NoFilter' | 'Sub' | 'Up' | 'Average' | 'Paeth' | 'Adaptive'
export type TiffCompression = 'None' | 'Lzw' | 'Deflate'
export type DngCompression = 'Uncompressed' | 'Lossless'

export type Encode =
  | { JxlLossy: { distance: number; effort: number; threads: number } }
  | { JxlLossless: { effort: number; threads: number } }
  | { JxlJpegRepack: { effort: number; threads: number } }
  | 'JpegFromJxl'
  | { Jpeg: { quality: number; subsampling: Subsampling; optimize: boolean } }
  | { Png: { compression: PngCompression; filter: PngFilter } }
  | { Heic: { quality: number; lossless: boolean; bit_depth: number; chroma: Chroma } }
  | {
      Avif: { quality: number; lossless: boolean; bit_depth: number; chroma: Chroma; speed: number }
    }
  | { Tiff: { compression: TiffCompression } }
  | { WebP: { quality: number; lossless: boolean; method: number } }
  | {
      Dng: {
        compression: DngCompression
        embed_original: boolean
        preview: boolean
        thumbnail: boolean
        crop: DngCrop
        apply_scaling: boolean
        predictor: number
        index: number
      }
    }

export type EncodeVariant =
  | 'JxlLossy'
  | 'JxlLossless'
  | 'JxlJpegRepack'
  | 'JpegFromJxl'
  | 'Jpeg'
  | 'Png'
  | 'Heic'
  | 'Avif'
  | 'Tiff'
  | 'WebP'
  | 'Dng'

/** The variant name of an `Encode` value. */
export function encodeVariant(e: Encode): EncodeVariant {
  if (typeof e === 'string') return e
  return Object.keys(e)[0] as EncodeVariant
}

export interface MetadataPolicy {
  exif: boolean
  icc: boolean
  xmp: boolean
  iptc: boolean
}

export type Dither = 'None' | { TriangularNoise: { seed: number } }

// ── Colour ───────────────────────────────────────────────────────────────────

export type ColorSpaceRef =
  | 'Srgb'
  | 'LinearSrgb'
  | 'DisplayP3'
  | 'AdobeRgb'
  | 'Rec2020'
  | 'GenericGray22'
  | { Icc: number[] }

export type RenderingIntent =
  | 'Perceptual'
  | 'RelativeColorimetric'
  | 'Saturation'
  | 'AbsoluteColorimetric'

export type ToneMapOperator = 'Bt2390' | 'Hable' | 'Reinhard' | 'Clip'
export type Peak = 'FromFile' | { Nits: number }
export type GamutMap = 'Clip' | 'Compress'

export type ColorPolicy =
  | 'Preserve'
  | { Assign: { to: ColorSpaceRef } }
  | {
      ConvertTo: { to: ColorSpaceRef; intent: RenderingIntent; black_point_compensation: boolean }
    }
  | {
      ToneMap: {
        to: ColorSpaceRef
        operator: ToneMapOperator
        source_peak: Peak
        target_peak_nits: number
        gamut: GamutMap
        intent: RenderingIntent
        black_point_compensation: boolean
      }
    }

export type ColorSource = 'IccProfile' | 'Cicp' | 'Assumed'

// ── Requests ─────────────────────────────────────────────────────────────────

/**
 * One conversion, fully specified. `grade` and `upscaler` exist in the engine
 * (a colourist's toolkit and a super-resolution model); this app never fills
 * them, so they are typed as `null` here.
 */
export interface ConvertRequest {
  source: Source
  sink: Sink
  input: InputFormat
  resize: Resize
  resampler: Resampler
  pixel: PixelSpec
  encode: Encode
  metadata: MetadataPolicy
  color: ColorPolicy
  linear_resample: boolean
  raw: RawMode | null
  upscaler: null
  grade: null
  dither: Dither
}

export type AnalysisDomain = 'Encoded' | 'Linear'
export type TransparentPixels = 'Include' | 'Exclude'

export interface AnalyzeRequest {
  source: Source
  input: InputFormat
  raw: RawMode | null
  domain: AnalysisDomain
  bins: number
  percentiles: number[]
  clip_low: number
  clip_high: number
  hue_bins: number
  stride: number
  transparent: TransparentPixels
}

// ── Reports ──────────────────────────────────────────────────────────────────

export interface ColorReport {
  space: string
  source: ColorSource
  converted: boolean
  icc_written: boolean
  cicp_written: boolean
  tone_mapped: {
    source_transfer: string
    operator: ToneMapOperator
    source_peak_nits: number
    target_peak_nits: number
    gamut: GamutMap
  } | null
  graded: unknown | null
}

export interface LossReport {
  source_bits: number
  output_bits: number
  quantisations: number
  dither: Dither
  single_float_pass: boolean
  resampled: boolean
  channels_changed: boolean
  depth_narrowed: boolean
  colour_transformed: boolean
  graded: boolean
  lossy_encoder: boolean
  chroma_subsampled: boolean
}

export interface ConvertReport {
  input_bytes: number
  output_bytes: number
  width: number
  height: number
  channels: number
  depth: Depth
  decode_ms: number
  resize_ms: number
  color_ms: number
  encode_ms: number
  /** Present only for a `Bytes` sink. */
  output: number[] | null
  metadata_written: MetadataPolicy
  color: ColorReport
  upscale: unknown | null
  loss: LossReport
}

export interface JpegInfo {
  quality: number | null
  luma_quant_table: number[]
  chroma_quant_table: number[] | null
  subsampling: Subsampling | null
  progressive: boolean
  optimized_huffman: boolean
  restart_interval: number
  components: number
}

export type HeifCodec = 'Hevc' | 'Av1'

export interface HeifInfo {
  codec: HeifCodec
  chroma: Chroma | null
  bit_depth: number
}

export interface PngInfo {
  bit_depth: number
  color_type: string
  interlaced: boolean
  has_palette: boolean
}

export interface WebpInfo {
  lossless: boolean
  has_alpha: boolean
  animated: boolean
}

export interface JxlInfo {
  has_jpeg_reconstruction: boolean
  uses_original_profile: boolean
  lossless: boolean | null
}

export interface TiffInfo {
  compression: TiffCompression | null
  compression_tag: number
  predictor: number
  planar: boolean
}

/** What a source actually is. Returned by `probe`. */
export interface SourceInfo {
  format: string
  input: InputFormat
  width: number
  height: number
  channels: number
  depth: Depth
  bits: number
  bytes: number
  has_exif: boolean
  has_icc: boolean
  has_xmp: boolean
  has_cicp: boolean
  has_iptc: boolean
  color: string
  color_source: ColorSource
  is_hdr: boolean
  peak_nits: number | null
  orientation: number
  is_raw_mosaic: boolean
  jpeg: JpegInfo | null
  heif: HeifInfo | null
  png: PngInfo | null
  webp: WebpInfo | null
  jxl: JxlInfo | null
  tiff: TiffInfo | null
}

export interface Histogram {
  counts: number[]
}

export interface Percentile {
  percentile: number
  value: number
}

export interface HueBin {
  hue_start: number
  hue_end: number
  count: number
  mean_saturation: number
}

/** What the pixels look like. Returned by `analyze`. */
export interface ImageStats {
  width: number
  height: number
  channels: number
  depth: Depth
  domain: AnalysisDomain
  space: string
  pixels_measured: number
  histograms: Histogram[]
  luma_histogram: Histogram
  luma_percentiles: Percentile[]
  luma_mean: number
  luma_stddev: number
  channel_mean: number[]
  clipped_low: number[]
  clipped_high: number[]
  grey_world_gain: (number | null)[]
  mean_saturation: number
  hue_histogram: HueBin[]
  neutral_pixels: number
  decode_ms: number
  analyze_ms: number
}

// ── Errors ───────────────────────────────────────────────────────────────────

export type PixlErrorCode =
  | 'Io'
  | 'InvalidRequest'
  | 'FormatMismatch'
  | 'Decode'
  | 'Unsupported'
  | 'EncoderUnavailable'
  | 'Encode'
  | 'Metadata'
  | 'Color'
  | 'Upscale'
  | 'Grade'
  | 'NotImplemented'
  | 'Serialize'

/** The serialised `PixlError` enum: `{ <Variant>: { ...fields } }`. */
export type PixlErrorDetail = Record<string, Record<string, unknown>>

/** What an engine error looks like once it crosses into JS. */
export interface EngineErrorShape {
  message: string
  /** A `PixlErrorCode`, or one of the app's own: EngineUnavailable, EngineCrashed, BadRequest, Unknown. */
  code: string
  detail?: PixlErrorDetail
}

// ── The binding ──────────────────────────────────────────────────────────────

/** The contract the Node binding fulfils. Everything async except the version. */
export interface PixlEngineModule {
  engineVersion(): string
  probe(path: string): Promise<SourceInfo>
  convert(request: ConvertRequest): Promise<ConvertReport>
  analyze(request: AnalyzeRequest): Promise<ImageStats>
  suggestEncode(info: SourceInfo, threads: number): Encode | Promise<Encode>
}

export type EngineMethod = keyof PixlEngineModule

/** Which implementation the host loaded. */
export type EngineFlavour = 'native' | 'mock'

/** How the host should choose: only the native addon, only the mock, or native with a mock fallback. */
export type EngineMode = 'native' | 'mock' | 'auto'

// ── Host ↔ main messages ─────────────────────────────────────────────────────

export interface EngineRequestMessage {
  kind: 'request'
  id: number
  method: EngineMethod
  args: unknown[]
}

export interface EngineHelloMessage {
  kind: 'hello'
  status: 'ready' | 'unavailable'
  flavour?: EngineFlavour
  version?: string
  reason?: string
}

export interface EngineResponseMessage {
  kind: 'response'
  id: number
  ok: boolean
  result?: unknown
  error?: EngineErrorShape
}

export type HostToMain = EngineHelloMessage | EngineResponseMessage
export type MainToHost = EngineRequestMessage
