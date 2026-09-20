/**
 * The development placeholder engine. Used only when the native addon cannot
 * load and the host was started in `auto` or `mock` mode (never in a packaged
 * build). It reads real headers where it can, synthesises pixel statistics,
 * and estimates output sizes from the ratios measured in the engine's README.
 *
 * Every number it produces is an estimate and every consumer shows it as
 * such: the engine status carries `flavour: 'mock'`. `convert` to a path
 * writes a copy of the source bytes so a file exists to open and reveal; the
 * reported size is the estimate, not the copy's.
 */
import { copyFileSync, openSync, readSync, closeSync, statSync, readFileSync } from 'fs'
import { extname } from 'path'
import { deflateSync } from 'zlib'
import type {
  AnalyzeRequest,
  ConvertReport,
  ConvertRequest,
  Encode,
  ImageStats,
  InputFormat,
  PixlEngineModule,
  SourceInfo
} from '../../shared/engine-types'
import { encodeVariant } from '../../shared/engine-types'

export const MOCK_VERSION = '0.0.0-mock'

class MockPixlError extends Error {
  readonly name = 'PixlError'
  constructor(
    readonly code: string,
    message: string,
    readonly detail: Record<string, Record<string, unknown>>
  ) {
    super(message)
  }
}

function unsupported(operation: string, detail: string): MockPixlError {
  return new MockPixlError('Unsupported', `unsupported: ${operation} — ${detail}`, {
    Unsupported: { operation, detail }
  })
}

function invalid(field: string, detail: string): MockPixlError {
  return new MockPixlError('InvalidRequest', `invalid request field \`${field}\`: ${detail}`, {
    InvalidRequest: { field, detail }
  })
}

const RAW_EXTENSIONS = new Set(['cr2', 'cr3', 'arw', 'nef', 'dng', 'raf', 'rw2', 'orf', 'pef', 'srw'])

function readHead(path: string, n = 256 * 1024): Buffer {
  const fd = openSync(path, 'r')
  try {
    const buf = Buffer.alloc(n)
    const got = readSync(fd, buf, 0, n, 0)
    return buf.subarray(0, got)
  } finally {
    closeSync(fd)
  }
}

interface Detected {
  format: string
  input: InputFormat
  width: number
  height: number
  channels: number
  bits: number
}

function detect(path: string, head: Buffer): Detected {
  const ext = extname(path).slice(1).toLowerCase()
  const guess = (format: string, input: InputFormat, channels = 3, bits = 8): Detected => ({
    format,
    input,
    width: 4032,
    height: 3024,
    channels,
    bits
  })
  if (head.length >= 4 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    // Walk the markers to the first SOF for geometry and component count.
    let i = 2
    while (i + 9 < head.length) {
      if (head[i] !== 0xff) {
        i++
        continue
      }
      const marker = head[i + 1]
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2
        continue
      }
      const len = head.readUInt16BE(i + 2)
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb)) {
        const height = head.readUInt16BE(i + 5)
        const width = head.readUInt16BE(i + 7)
        const comps = head[i + 9]
        return { format: 'jpeg', input: 'Jpeg', width, height, channels: comps === 1 ? 1 : 3, bits: 8 }
      }
      i += 2 + len
    }
    return guess('jpeg', 'Jpeg')
  }
  if (head.length >= 29 && head.readUInt32BE(0) === 0x89504e47) {
    const width = head.readUInt32BE(16)
    const height = head.readUInt32BE(20)
    const bitDepth = head[24]
    const colorType = head[25]
    const channels = { 0: 1, 2: 3, 3: 3, 4: 2, 6: 4 }[colorType] ?? 3
    return { format: 'png', input: 'Png', width, height, channels, bits: bitDepth }
  }
  if (head.length >= 30 && head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP') {
    const chunk = head.toString('latin1', 12, 16)
    if (chunk === 'VP8X') {
      const width = 1 + (head[24] | (head[25] << 8) | (head[26] << 16))
      const height = 1 + (head[27] | (head[28] << 8) | (head[29] << 16))
      const alpha = (head[20] & 0x10) !== 0
      return { format: 'webp', input: 'WebP', width, height, channels: alpha ? 4 : 3, bits: 8 }
    }
    if (chunk === 'VP8 ') {
      const width = head.readUInt16LE(26) & 0x3fff
      const height = head.readUInt16LE(28) & 0x3fff
      return { format: 'webp', input: 'WebP', width, height, channels: 3, bits: 8 }
    }
    if (chunk === 'VP8L') {
      const b = head.readUInt32LE(21)
      const width = (b & 0x3fff) + 1
      const height = ((b >> 14) & 0x3fff) + 1
      const alpha = ((b >> 28) & 1) === 1
      return { format: 'webp', input: 'WebP', width, height, channels: alpha ? 4 : 3, bits: 8 }
    }
    return guess('webp', 'WebP')
  }
  if (head.length >= 12 && head.toString('latin1', 4, 8) === 'ftyp') {
    const brand = head.toString('latin1', 8, 12)
    if (brand.startsWith('avi')) return guess('avif', 'Heif', 3, 8)
    return guess('heic', 'Heif', 3, 8)
  }
  if (head.length >= 2 && head[0] === 0xff && head[1] === 0x0a) return guess('jxl', 'Jxl')
  if (head.length >= 12 && head.toString('latin1', 4, 12) === 'JXL \r\n\x87\n') return guess('jxl', 'Jxl')
  if (
    head.length >= 4 &&
    ((head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2a) || (head[0] === 0x4d && head[1] === 0x4d && head[3] === 0x2a))
  ) {
    if (RAW_EXTENSIONS.has(ext) || head.toString('latin1', 8, 10) === 'CR') {
      return { ...guess(ext || 'raw', 'Raw', 1, 14), width: 6000, height: 4000 }
    }
    return guess('tiff', 'Tiff', 3, 8)
  }
  if (RAW_EXTENSIONS.has(ext)) return { ...guess(ext, 'Raw', 1, 14), width: 6000, height: 4000 }
  if (ext === 'jpg' || ext === 'jpeg') return guess('jpeg', 'Jpeg')
  if (ext === 'png') return guess('png', 'Png')
  if (ext === 'tif' || ext === 'tiff') return guess('tiff', 'Tiff')
  if (ext === 'jxl') return guess('jxl', 'Jxl')
  if (ext === 'avif') return guess('avif', 'Heif')
  if (ext === 'heic' || ext === 'heif') return guess('heic', 'Heif')
  if (ext === 'webp') return guess('webp', 'WebP')
  return guess('jpeg', 'Jpeg')
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** A tiny seeded PRNG so a given path always analyses the same way. */
function rng(seed: number): () => number {
  let s = seed || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 1_000_000) / 1_000_000
  }
}

/** A 4×4 grey PNG, used when the placeholder cannot decode a format the browser cannot show either. */
export function placeholderPng(): Buffer {
  const w = 4
  const h = 4
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0
    for (let x = 0; x < w; x++) {
      const v = 96 + ((x + y) % 2) * 32
      raw.set([v, v, v], y * (w * 3 + 1) + 1 + x * 3)
    }
  }
  const crcTable = new Uint32Array(256).map((_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf: Buffer): number => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/** Output ÷ input, from the README's measurements, for a source format and an encode. */
function ratioFor(input: InputFormat, encode: Encode, deep: boolean): number {
  const v = encodeVariant(encode)
  const q = (n: number, ref: number, k = 1.4): number => Math.pow(n / ref, k)
  const table: Partial<Record<InputFormat, Partial<Record<string, () => number>>>> = {
    Jpeg: {
      JxlJpegRepack: () => 0.81,
      JxlLossy: () => 0.69 * Math.pow(1 / Math.max(0.2, (encode as { JxlLossy: { distance: number } }).JxlLossy.distance), 0.55),
      JxlLossless: () => 2.85,
      Avif: () => 0.32 * q((encode as { Avif: { quality: number } }).Avif.quality, 60),
      WebP: () => 0.41 * q((encode as { WebP: { quality: number } }).WebP.quality, 80),
      Jpeg: () => 1.0 * q((encode as { Jpeg: { quality: number } }).Jpeg.quality, 90, 1.3),
      Png: () => 4.8,
      Tiff: () => 7.0
    },
    Png: {
      JxlLossless: () => 0.63,
      JxlLossy: () => 0.15,
      Avif: () => (deep ? 0.05 : 0.12) * q((encode as { Avif: { quality: number } }).Avif.quality, 75),
      WebP: () => ((encode as { WebP: { lossless: boolean } }).WebP.lossless ? 0.75 : 0.15),
      Jpeg: () => 0.12,
      Png: () => 0.98,
      Tiff: () => 1.5
    },
    Tiff: {
      JxlLossless: () => 0.5,
      JxlLossy: () => 0.12,
      Avif: () => 0.06,
      WebP: () => 0.12,
      Jpeg: () => 0.1,
      Png: () => 0.7,
      Tiff: () => 0.75
    },
    Raw: {
      Dng: () => 0.86,
      Jpeg: () => 0.15,
      Avif: () => 0.1,
      JxlLossy: () => 0.12,
      JxlLossless: () => 0.8,
      Png: () => 2.0,
      WebP: () => 0.13,
      Tiff: () => 2.5
    },
    Heif: {
      Avif: () => 0.85,
      JxlLossy: () => 1.0,
      JxlLossless: () => 3.5,
      Jpeg: () => 1.3,
      WebP: () => 0.9,
      Png: () => 6.0,
      Tiff: () => 9.0
    },
    WebP: {
      Avif: () => 0.85,
      JxlLossy: () => 1.1,
      JxlLossless: () => 1.1,
      Jpeg: () => 1.4,
      WebP: () => 1.0,
      Png: () => 5.0,
      Tiff: () => 7.0
    },
    Jxl: {
      JpegFromJxl: () => 1.23,
      JxlLossy: () => 1.0,
      JxlLossless: () => 1.0,
      Avif: () => 0.9,
      Jpeg: () => 1.4,
      WebP: () => 1.2,
      Png: () => 5.0,
      Tiff: () => 7.0
    }
  }
  return table[input]?.[v]?.() ?? 1.0
}

function validateLikeTheEngine(req: ConvertRequest): void {
  const v = encodeVariant(req.encode)
  const requires: Partial<Record<string, InputFormat>> = { JxlJpegRepack: 'Jpeg', JpegFromJxl: 'Jxl', Dng: 'Raw' }
  const need = requires[v]
  if (need && req.input !== need) {
    throw unsupported('input format for encoder', `${v} requires a ${need.toLowerCase()} source, got ${req.input.toLowerCase()}`)
  }
  if (v === 'Heic') {
    throw new MockPixlError('EncoderUnavailable', 'encoder `heic` unavailable: libheif was built without an HEVC encoder (x265 is excluded from shipped builds)', {
      EncoderUnavailable: { encoder: 'heic', detail: 'no HEVC encoder in this build' }
    })
  }
  if (req.input === 'Raw' && v !== 'Dng' && req.raw === null) {
    throw invalid('raw', `a RAW source cannot become ${v.toLowerCase()} without a raw mode — set RawMode::Develop or RawMode::EmbeddedPreview`)
  }
  if (req.input !== 'Raw' && req.raw !== null) {
    throw invalid('raw', `a raw mode only applies to a RAW source, but input is ${req.input.toLowerCase()}`)
  }
  const passthrough = v === 'JxlJpegRepack' || v === 'JpegFromJxl' || v === 'Dng'
  if (passthrough && (req.resize !== 'None' || req.color !== 'Preserve' || req.dither !== 'None')) {
    throw unsupported('pixel work on a bitstream copy', `${v} copies a bitstream and never decodes pixels`)
  }
  if (v === 'WebP' && req.pixel.depth === 'Sixteen') {
    throw unsupported('depth for encoder', 'webp takes [Eight], but pixel.depth asks for Sixteen')
  }
  if (v === 'Jpeg' && (req.pixel.channels === 4 || req.pixel.channels === 2)) {
    throw unsupported('channel count for encoder', `jpeg takes [1, 3] channels, but pixel.channels asks for ${req.pixel.channels}`)
  }
}

function sourceBytes(req: ConvertRequest | AnalyzeRequest): { path: string | null; bytes: number } {
  if ('Path' in req.source) {
    return { path: req.source.Path, bytes: statSync(req.source.Path).size }
  }
  return { path: null, bytes: req.source.Bytes.length }
}

function outputGeometry(req: ConvertRequest, w: number, h: number): { width: number; height: number } {
  if (req.resize === 'None') return { width: w, height: h }
  if ('Exact' in req.resize) return { width: req.resize.Exact.width, height: req.resize.Exact.height }
  const f = req.resize.Scale.factor
  return { width: Math.max(1, Math.round(w * f)), height: Math.max(1, Math.round(h * f)) }
}

const BROWSER_SHOWS = new Set<InputFormat>(['Jpeg', 'Png', 'WebP'])

export function createMockEngine(): PixlEngineModule {
  return {
    engineVersion: () => MOCK_VERSION,

    async probe(path: string): Promise<SourceInfo> {
      const bytes = statSync(path).size
      const d = detect(path, readHead(path))
      const isRaw = d.input === 'Raw'
      const seed = hashString(path)
      const deep = d.bits > 8
      return {
        format: d.format,
        input: d.input,
        width: d.width,
        height: d.height,
        channels: d.channels,
        depth: deep ? 'Sixteen' : 'Eight',
        bits: d.bits,
        bytes,
        has_exif: d.input === 'Jpeg' || d.input === 'Heif' || isRaw,
        has_icc: d.input === 'Heif' || d.input === 'Png',
        has_xmp: false,
        has_cicp: d.input === 'Heif',
        has_iptc: false,
        color: d.input === 'Heif' ? 'Display P3' : 'sRGB',
        color_source: d.input === 'Heif' ? 'Cicp' : d.input === 'Png' ? 'IccProfile' : 'Assumed',
        is_hdr: false,
        peak_nits: null,
        orientation: 1,
        is_raw_mosaic: isRaw,
        jpeg:
          d.input === 'Jpeg'
            ? {
                quality: seed % 3 === 0 ? null : 75 + (seed % 20),
                luma_quant_table: [],
                chroma_quant_table: d.channels === 1 ? null : [],
                subsampling: d.channels === 1 ? 'Grey' : 'Quarter',
                progressive: seed % 4 === 0,
                optimized_huffman: seed % 2 === 0,
                restart_interval: 0,
                components: d.channels
              }
            : null,
        heif: d.input === 'Heif' ? { codec: d.format === 'avif' ? 'Av1' : 'Hevc', chroma: 'Half', bit_depth: d.format === 'avif' ? 10 : 8 } : null,
        png:
          d.input === 'Png'
            ? { bit_depth: d.bits, color_type: d.channels === 4 ? 'Rgba' : d.channels === 1 ? 'Grayscale' : 'Rgb', interlaced: false, has_palette: false }
            : null,
        webp: d.input === 'WebP' ? { lossless: false, has_alpha: d.channels === 4, animated: false } : null,
        jxl: d.input === 'Jxl' ? { has_jpeg_reconstruction: true, uses_original_profile: false, lossless: null } : null,
        tiff: d.input === 'Tiff' ? { compression: 'Lzw', compression_tag: 5, predictor: 2, planar: false } : null
      }
    },

    async analyze(req: AnalyzeRequest): Promise<ImageStats> {
      const { path, bytes } = sourceBytes(req)
      const info = path ? await this.probe(path) : null
      if (req.input === 'Raw' && req.raw === null) throw invalid('raw', 'a RAW source needs a raw mode to become pixels')
      const seed = hashString(path ?? String(bytes))
      const r = rng(seed)
      const channels = info?.channels ?? 3
      const colour = channels >= 3 ? 3 : 1
      const bins = req.bins
      const mean = 0.3 + r() * 0.35
      const spread = 0.12 + r() * 0.2
      const gauss = (x: number, m: number, s: number): number => Math.exp(-((x - m) * (x - m)) / (2 * s * s))
      const luma = Array.from({ length: bins }, (_, i) => {
        const x = (i + 0.5) / bins
        const v = gauss(x, mean, spread) + 0.35 * gauss(x, Math.min(0.95, mean + 0.4), 0.06) + 0.02
        return Math.round(v * 100_000)
      })
      const total = luma.reduce((a, b) => a + b, 0)
      const percentiles = req.percentiles.map((p) => {
        let acc = 0
        for (let i = 0; i < bins; i++) {
          acc += luma[i]
          if (acc / total >= p / 100) return { percentile: p, value: (i + 0.5) / bins }
        }
        return { percentile: p, value: 1 }
      })
      const casts = [1 + (r() - 0.5) * 0.2, 1, 1 + (r() - 0.5) * 0.3]
      const channelMean = colour === 1 ? [mean] : casts.map((c) => Math.min(0.98, mean / c))
      const lumaMean = colour === 1 ? mean : 0.2126 * channelMean[0] + 0.7152 * channelMean[1] + 0.0722 * channelMean[2]
      const w = info?.width ?? 4000
      const h = info?.height ?? 3000
      const measured = Math.floor(w / req.stride) * Math.floor(h / req.stride)
      const sat = colour === 1 ? 0 : 0.15 + r() * 0.3
      return {
        width: w,
        height: h,
        channels,
        depth: info?.depth ?? 'Eight',
        domain: req.domain,
        space: req.domain === 'Linear' ? 'linear Rec.2020' : `${info?.color ?? 'sRGB'} (encoded)`,
        pixels_measured: measured,
        histograms: channelMean.map((m) => ({
          counts: Array.from({ length: bins }, (_, i) => Math.round((gauss((i + 0.5) / bins, m, spread) + 0.02) * 100_000))
        })),
        luma_histogram: { counts: luma },
        luma_percentiles: percentiles,
        luma_mean: lumaMean,
        luma_stddev: spread * 1.1,
        channel_mean: channelMean,
        clipped_low: channelMean.map(() => r() * 0.01),
        clipped_high: channelMean.map(() => (r() < 0.3 ? r() * 0.05 : r() * 0.004)),
        grey_world_gain: colour === 1 ? [] : channelMean.map((m) => (m > 0 ? lumaMean / m : null)),
        mean_saturation: sat,
        hue_histogram: Array.from({ length: req.hue_bins }, (_, i) => ({
          hue_start: (360 * i) / req.hue_bins,
          hue_end: (360 * (i + 1)) / req.hue_bins,
          count: Math.round(measured * (0.02 + r() * 0.1)),
          mean_saturation: colour === 1 ? 0 : 0.1 + r() * 0.5
        })),
        neutral_pixels: colour === 1 ? measured : Math.round(measured * (0.05 + r() * 0.3)),
        decode_ms: Math.round(bytes / 400_000) + 4,
        analyze_ms: 1 + Math.round(measured / 4_000_000)
      }
    },

    suggestEncode(info: SourceInfo, threads: number): Encode {
      if (threads < 1) throw invalid('threads', 'must be at least 1')
      if (info.is_raw_mosaic || info.input === 'Raw') {
        throw unsupported('suggest_encode', 'a RAW source has no same-format encoder: nothing outputs RAW. Encode::Dng is the lossless container for a sensor mosaic')
      }
      switch (info.input) {
        case 'Jpeg': {
          const j = info.jpeg
          if (!j || j.quality === null || j.subsampling === null) {
            throw unsupported(
              'suggest_encode',
              "this JPEG's quantisation tables are not a scaling of the Annex K standard tables, so no libjpeg quality reproduces them. Set encode.quality yourself in Encode::Jpeg { quality: <yours>, subsampling: Subsampling::Quarter, optimize: true }"
            )
          }
          return { Jpeg: { quality: j.quality, subsampling: j.subsampling, optimize: true } }
        }
        case 'Png':
          return { Png: { compression: 'Best', filter: 'Adaptive' } }
        case 'Tiff':
          return { Tiff: { compression: info.tiff?.compression ?? 'Deflate' } }
        case 'WebP':
          if (info.webp?.lossless) return { WebP: { quality: 100, lossless: true, method: 6 } }
          throw unsupported('suggest_encode', 'a lossy WebP does not record its quality; set encode.quality yourself in Encode::WebP { quality: <yours>, lossless: false, method: 6 }')
        case 'Jxl':
          if (info.jxl?.lossless) return { JxlLossless: { effort: 9, threads } }
          throw unsupported('suggest_encode', 'a lossy JPEG XL does not record its distance; set encode.distance yourself in Encode::JxlLossy { distance: <yours>, effort: 7, threads }')
        case 'Heif': {
          const h = info.heif
          const codec = h?.codec === 'Av1' ? 'Avif' : 'Heic'
          throw unsupported(
            'suggest_encode',
            `a ${codec.toUpperCase()} never records the quality it was encoded at; the file does say codec=${h?.codec ?? '?'} chroma=${h?.chroma ?? '?'} bit_depth=${h?.bit_depth ?? '?'} — set encode.quality yourself in Encode::${codec} { quality: <yours>, lossless: false, bit_depth: ${h?.bit_depth ?? 8}, chroma: Chroma::${h?.chroma ?? 'Half'}${codec === 'Avif' ? ', speed: 6' : ''} }`
          )
        }
      }
      throw unsupported('suggest_encode', 'nothing outputs RAW')
    },

    async convert(req: ConvertRequest): Promise<ConvertReport> {
      validateLikeTheEngine(req)
      const { path, bytes } = sourceBytes(req)
      const info = path ? await this.probe(path) : null
      const v = encodeVariant(req.encode)
      const w = info?.width ?? 4000
      const h = info?.height ?? 3000
      const geo = outputGeometry(req, w, h)
      const deep = info?.depth === 'Sixteen'
      let ratio = ratioFor(req.input, req.encode, deep)
      const pixelRatio = (geo.width * geo.height) / Math.max(1, w * h)
      if (pixelRatio !== 1) ratio *= Math.pow(pixelRatio, 0.9)
      if (req.pixel.channels === 1 && (info?.channels ?? 3) >= 3) ratio *= 0.55
      const seed = hashString((path ?? '') + v)
      ratio *= 0.97 + ((seed % 100) / 100) * 0.06
      const outputBytes = Math.max(512, Math.round(bytes * ratio))
      const passthrough = v === 'JxlJpegRepack' || v === 'JpegFromJxl' || v === 'Dng'

      let output: number[] | null = null
      if (req.sink === 'Bytes') {
        // What a caller wants from a Bytes sink here is something to display.
        const showable = info && BROWSER_SHOWS.has(info.input)
        const buf = showable && path ? readFileSync(path) : placeholderPng()
        output = Array.from(buf)
      } else if (path) {
        copyFileSync(path, req.sink.Path)
      } else {
        throw unsupported('mock convert', 'the placeholder engine needs a Path source to write a Path sink')
      }

      const lossy = v === 'Jpeg' || v === 'Avif' || v === 'WebP' || (v === 'JxlLossy' && (req.encode as { JxlLossy: { distance: number } }).JxlLossy.distance > 0)
      const ms = Math.round(bytes / (passthrough ? 25_000_000 : 3_000_000) * 1000)
      return {
        input_bytes: bytes,
        output_bytes: outputBytes,
        width: v === 'Dng' ? 0 : geo.width,
        height: v === 'Dng' ? 0 : geo.height,
        channels: req.pixel.channels ?? info?.channels ?? 3,
        depth: req.pixel.depth ?? info?.depth ?? 'Eight',
        decode_ms: passthrough ? 0 : Math.round(ms * 0.2),
        resize_ms: req.resize === 'None' ? 0 : Math.round(ms * 0.1),
        color_ms: req.color === 'Preserve' ? 0 : Math.round(ms * 0.1),
        encode_ms: Math.max(1, Math.round(ms * 0.6)),
        output,
        metadata_written: v === 'Dng' ? { exif: true, icc: false, xmp: false, iptc: false } : { ...req.metadata, iptc: req.metadata.iptc && (v === 'Jpeg' || v === 'Tiff' || v === 'Avif' || v === 'Heic') },
        color: {
          space: info?.color ?? 'sRGB',
          source: info?.color_source ?? 'Assumed',
          converted: typeof req.color !== 'string' && ('ConvertTo' in req.color || 'ToneMap' in req.color),
          icc_written: req.metadata.icc,
          cicp_written: v === 'Avif' || v === 'Heic' || v === 'JxlLossy' || v === 'JxlLossless' || v === 'Png',
          tone_mapped: null,
          graded: null
        },
        upscale: null,
        loss: {
          source_bits: info?.bits ?? 8,
          output_bits: (req.pixel.depth ?? info?.depth) === 'Sixteen' ? 16 : 8,
          quantisations: passthrough ? 0 : 1,
          dither: req.dither,
          single_float_pass: !passthrough,
          resampled: req.resize !== 'None',
          channels_changed: req.pixel.channels !== null && req.pixel.channels !== (info?.channels ?? 3),
          depth_narrowed: deep && req.pixel.depth === 'Eight',
          colour_transformed: typeof req.color !== 'string',
          graded: false,
          lossy_encoder: lossy,
          chroma_subsampled: v === 'Jpeg' || v === 'WebP' || ((v === 'Avif' || v === 'Heic') && (req.encode as { Avif?: { chroma: string }; Heic?: { chroma: string } })[v]?.chroma !== 'Full')
        }
      }
    }
  }
}
