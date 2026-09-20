import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildConvertRequest,
  defaultPlan,
  outputFileName,
  planIsLossless,
  targetsFor
} from '../src/shared/plan'
import { source } from './fixtures'

test('the default plan builds the exact shape the binding expects', () => {
  const req = buildConvertRequest(defaultPlan(8), source(), '/p/a.jpg', { Path: '/p/a.jxl' })
  assert.deepEqual(req, {
    source: { Path: '/p/a.jpg' },
    sink: { Path: '/p/a.jxl' },
    input: 'Jpeg',
    resize: 'None',
    resampler: 'Lanczos3',
    pixel: { depth: null, channels: null },
    encode: { JxlLossy: { distance: 1, effort: 7, threads: 8 } },
    metadata: { exif: true, icc: true, xmp: true, iptc: true },
    color: 'Preserve',
    linear_resample: false,
    raw: null,
    upscaler: null,
    grade: null,
    dither: 'None'
  })
})

test('passthrough targets force the fields the engine would refuse', () => {
  const p = defaultPlan()
  p.target = 'jxl-repack'
  p.resize = { mode: 'scale', factor: 0.5, fit: 4096, width: 1, height: 1 }
  p.color.policy = 'ConvertTo'
  p.dither.mode = 'TriangularNoise'
  p.pixel.depth = 'Sixteen'
  const req = buildConvertRequest(p, source(), '/p/a.jpg', 'Bytes')
  assert.equal(req.resize, 'None')
  assert.equal(req.color, 'Preserve')
  assert.equal(req.dither, 'None')
  assert.deepEqual(req.pixel, { depth: null, channels: null })
  assert.deepEqual(req.encode, { JxlJpegRepack: { effort: 7, threads: 4 } })
})

test('fit resize keeps the aspect and never enlarges', () => {
  const p = defaultPlan()
  p.resize.mode = 'fit'
  p.resize.fit = 3000
  const req = buildConvertRequest(p, source(), '/p/a.jpg', 'Bytes')
  assert.deepEqual(req.resize, { Exact: { width: 3000, height: 2000 } })
  p.resize.fit = 9000
  assert.equal(buildConvertRequest(p, source(), '/p/a.jpg', 'Bytes').resize, 'None')
})

test('tone mapping and lossless flags serialise as the engine wants', () => {
  const p = defaultPlan()
  p.target = 'avif'
  p.avif.lossless = true
  p.avif.chroma = 'Half'
  p.color = {
    ...p.color,
    policy: 'ToneMap',
    sourcePeak: 'Nits',
    sourcePeakNits: 1000,
    targetPeakNits: 203
  }
  const req = buildConvertRequest(p, source({ is_hdr: true }), '/p/a.jpg', 'Bytes')
  assert.deepEqual(req.encode, {
    Avif: { quality: 60, lossless: true, bit_depth: 8, chroma: 'Full', speed: 6 }
  })
  assert.deepEqual(req.color, {
    ToneMap: {
      to: 'Srgb',
      operator: 'Bt2390',
      source_peak: { Nits: 1000 },
      target_peak_nits: 203,
      gamut: 'Compress',
      intent: 'Perceptual',
      black_point_compensation: true
    }
  })
  assert.ok(planIsLossless(p))
})

test('targets are filtered by what the source can become', () => {
  assert.ok(targetsFor(source()).includes('jxl-repack'))
  assert.ok(!targetsFor(source()).includes('dng'))
  assert.ok(!targetsFor(source({ input: 'Png' })).includes('jxl-repack'))
  assert.equal(outputFileName('IMG_0042.JPG', 'jxl-repack'), 'IMG_0042.jxl')
  assert.equal(outputFileName('noext', 'avif'), 'noext.avif')
})
