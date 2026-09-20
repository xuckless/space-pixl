/**
 * The app's three caller functions over the engine's four calls:
 *
 *   inspect(path)          probe + analyze + suggestEncode + recommend, and a render of the source
 *   preview(path, plan)    the real encode to a temp file, then that output rendered back for display
 *   convert(path, plan)    the real encode beside the source, recorded in the store
 *
 * Batching, progress and cancellation are the caller's, says the engine; for
 * this pass "the caller" is one file at a time.
 */
import { mkdtempSync, rmSync, existsSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { basename, dirname, join } from 'path'
import log from 'electron-log/main'
import type { AnalyzeRequest, ConvertReport, ConvertRequest, Encode, InputFormat, RawMode, SourceInfo } from '../shared/engine-types'
import type { AppError, Conversion, Inspection, Preview, RenderedImage } from '../shared/ipc'
import { buildConvertRequest, describePlan, outputFileName, planIsLossless, planIsReversible, TARGETS, type Plan } from '../shared/plan'
import { recommend } from '../shared/recommend'
import { EngineClient, EngineError } from './engine/client'
import type { Store } from './db'

/** Longest edge of a preview render. Enough to judge artefacts on a laptop screen without shipping the whole image. */
const PREVIEW_EDGE = 1600

export function toAppError(err: unknown): AppError {
  if (err instanceof EngineError) return { message: err.message, code: err.code, detail: err.detail }
  if (err instanceof Error) return { message: err.message, code: 'Unknown' }
  return { message: String(err), code: 'Unknown' }
}

function sniffMime(bytes: Uint8Array): string {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes.length > 12 && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'image/webp'
  if (bytes.length > 12 && String.fromCharCode(...bytes.subarray(4, 8)) === 'ftyp') return 'image/avif'
  return 'application/octet-stream'
}

/** The RAW mode a render uses when it has to decode a mosaic and the user has not said how. */
const RENDER_RAW: RawMode = { Develop: { scaling: true, demosaic: true, white_balance: true, calibrate: true, srgb_gamma: true, crop: 'Best' } }

export class Pipeline {
  private infoCache = new Map<string, SourceInfo>()

  constructor(
    private readonly engine: EngineClient,
    private readonly store: Store
  ) {}

  /** Everything about one file. Each step that can fail independently reports its own error rather than failing the whole. */
  async inspect(path: string): Promise<Inspection> {
    const t0 = Date.now()
    const info = await this.engine.probe(path)
    this.infoCache.set(path, info)
    const flavour = this.engine.flavour()
    this.store.recordInspection(path, info.format, info.bytes, flavour)

    const analyzeReq: AnalyzeRequest = {
      source: { Path: path },
      input: info.input,
      raw: info.input === 'Raw' ? RENDER_RAW : null,
      domain: 'Encoded',
      bins: 64,
      percentiles: [0.1, 1, 5, 50, 95, 99, 99.9],
      clip_low: 5 / 255,
      clip_high: 250 / 255,
      hue_bins: 12,
      // Every 4th pixel on each axis: a 24 MP image is measured from 1.5 M samples.
      stride: Math.max(1, Math.round(Math.sqrt((info.width * info.height) / 1_500_000))),
      transparent: 'Exclude'
    }

    const [statsRes, suggestRes, beforeRes] = await Promise.allSettled([
      this.engine.analyze(analyzeReq),
      this.engine.suggestEncode(info, 4),
      this.render(path, info.input, info.input === 'Raw' ? RENDER_RAW : null)
    ])

    const stats = statsRes.status === 'fulfilled' ? statsRes.value : null
    const suggested: Encode | null = suggestRes.status === 'fulfilled' ? suggestRes.value : null
    const recommendation = recommend(info, stats, suggested)

    return {
      path,
      fileName: basename(path),
      info,
      stats,
      statsError: statsRes.status === 'rejected' ? toAppError(statsRes.reason) : null,
      suggested,
      suggestError: suggestRes.status === 'rejected' ? toAppError(suggestRes.reason) : null,
      recommendation,
      before: beforeRes.status === 'fulfilled' ? beforeRes.value : null,
      beforeError: beforeRes.status === 'rejected' ? toAppError(beforeRes.reason) : null,
      engine: flavour,
      ms: Date.now() - t0
    }
  }

  /** The real encode to a temp file, then the output decoded back to a PNG the renderer can show. */
  async preview(path: string, plan: Plan): Promise<Preview> {
    const t0 = Date.now()
    const info = await this.info(path)
    const dir = mkdtempSync(join(tmpdir(), 'space-pixl-preview-'))
    try {
      const out = join(dir, outputFileName(basename(path), plan.target))
      const request = buildConvertRequest(plan, info, path, { Path: out })
      const report = await this.engine.convert(request)
      const target = TARGETS[plan.target]
      let after: RenderedImage | null = null
      let afterError: AppError | null = null
      try {
        after = await this.render(out, target.decodesAs, target.decodesAs === 'Raw' ? RENDER_RAW : null)
      } catch (err) {
        afterError = toAppError(err)
      }
      return {
        plan,
        report,
        inputBytes: report.input_bytes,
        outputBytes: report.output_bytes,
        after,
        afterError,
        engine: this.engine.flavour(),
        ms: Date.now() - t0
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  /** The real encode, beside the source, never overwriting, recorded whether it succeeds or not. */
  async convert(path: string, plan: Plan): Promise<Conversion> {
    const info = await this.info(path)
    const outputPath = freePath(join(dirname(path), outputFileName(basename(path), plan.target)))
    const flavour = this.engine.flavour()
    const id = this.store.startConversion({
      sourcePath: path,
      inputFormat: info.format,
      target: plan.target,
      description: describePlan(plan),
      inputBytes: info.bytes,
      lossless: planIsLossless(plan),
      reversible: planIsReversible(plan),
      engine: flavour
    })
    const t0 = Date.now()
    let report: ConvertReport
    try {
      report = await this.engine.convert(buildConvertRequest(plan, info, path, { Path: outputPath }))
    } catch (err) {
      const e = toAppError(err)
      this.store.finishConversion(id, { outputPath: null, outputBytes: null, durationMs: Date.now() - t0, status: 'error', error: `${e.code}: ${e.message}` })
      // A failed encode must not leave a half-written file beside the original.
      if (existsSync(outputPath)) rmSync(outputPath, { force: true })
      throw err
    }
    const ms = Date.now() - t0
    // The native engine's report is the file's size; the placeholder's is an estimate, and its copy on disk is not.
    const outputBytes = flavour === 'native' && existsSync(outputPath) ? statSync(outputPath).size : report.output_bytes
    this.store.finishConversion(id, { outputPath, outputBytes, durationMs: ms, status: 'ok', error: null })
    log.info('converted', { path, outputPath, in: info.bytes, out: outputBytes, ms, engine: flavour })
    return { id, outputPath, report, inputBytes: info.bytes, outputBytes, savedBytes: info.bytes - outputBytes, ms, engine: flavour }
  }

  private async info(path: string): Promise<SourceInfo> {
    const cached = this.infoCache.get(path)
    if (cached) return cached
    const info = await this.engine.probe(path)
    this.infoCache.set(path, info)
    return info
  }

  /** Decode any file the engine reads into a fit-to-screen 8-bit PNG, colour description carried along. */
  private async render(path: string, input: InputFormat, raw: RawMode | null): Promise<RenderedImage> {
    const request: ConvertRequest = {
      source: { Path: path },
      sink: 'Bytes',
      input,
      resize: 'None',
      resampler: 'CatmullRom',
      pixel: { depth: 'Eight', channels: null },
      encode: { Png: { compression: 'Fast', filter: 'Sub' } },
      metadata: { exif: false, icc: true, xmp: false, iptc: false },
      color: 'Preserve',
      linear_resample: false,
      raw,
      upscaler: null,
      grade: null,
      dither: 'None'
    }
    // Fit the longer edge without a second probe: the first attempt asks the engine for geometry via the report.
    const probe = this.infoCache.get(path) ?? (await this.engine.probe(path))
    const longer = Math.max(probe.width, probe.height)
    if (longer > PREVIEW_EDGE) {
      const s = PREVIEW_EDGE / longer
      request.resize = { Exact: { width: Math.max(1, Math.round(probe.width * s)), height: Math.max(1, Math.round(probe.height * s)) } }
    }
    const report = await this.engine.convert(request)
    const bytes = new Uint8Array(report.output ?? [])
    const mime = sniffMime(bytes)
    return {
      bytes,
      mime,
      width: report.width,
      height: report.height,
      substitute: this.engine.flavour() === 'mock'
    }
  }
}

/** `photo.jxl`, or `photo (1).jxl` when that exists, and so on. Never overwrites. */
export function freePath(candidate: string): string {
  if (!existsSync(candidate)) return candidate
  const dir = dirname(candidate)
  const name = basename(candidate)
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  for (let i = 1; i < 10_000; i++) {
    const next = join(dir, `${stem} (${i})${ext}`)
    if (!existsSync(next)) return next
  }
  throw new Error(`no free name for ${candidate}`)
}
