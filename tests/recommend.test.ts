import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recommend } from '../src/shared/recommend'
import { buildConvertRequest } from '../src/shared/plan'
import { source } from './fixtures'

test('a JPEG leads with the reversible repack and offers AVIF for the biggest saving', () => {
  const r = recommend(source(), null, {
    Jpeg: { quality: 85, subsampling: 'Quarter', optimize: true }
  })
  assert.equal(r.verdict, 'convert')
  assert.equal(r.candidates[0].id, 'jpeg-repack')
  assert.ok(r.candidates[0].recommended && r.candidates[0].reversible)
  assert.ok(r.candidates.some((c) => c.id === 'jpeg-avif' && c.plan.target === 'avif'))
  assert.ok(r.reasons.some((x) => x.includes('quality 85')))
})

test('a small PNG is marginal and leads with lossless JXL', () => {
  const r = recommend(
    source({
      input: 'Png',
      format: 'png',
      bytes: 2_000_000,
      jpeg: null,
      png: { bit_depth: 8, color_type: 'Rgba', interlaced: false, has_palette: false },
      channels: 4
    }),
    null,
    null
  )
  assert.equal(r.verdict, 'marginal')
  assert.equal(r.candidates[0].id, 'png-jxl-lossless')
})

test('a 16-bit PNG over 5 MB leads with AVIF 10-bit 4:4:4', () => {
  const info = source({
    input: 'Png',
    format: 'png',
    bytes: 104_000_000,
    depth: 'Sixteen',
    bits: 16,
    jpeg: null,
    png: { bit_depth: 16, color_type: 'Rgb', interlaced: false, has_palette: false }
  })
  const r = recommend(info, null, null)
  assert.equal(r.verdict, 'convert')
  const avif = r.candidates.find((c) => c.id === 'png-avif')!
  assert.ok(avif.recommended)
  assert.deepEqual(avif.plan.avif, {
    quality: 75,
    lossless: false,
    bitDepth: 10,
    chroma: 'Full',
    speed: 6
  })
})

test('an AVIF is left alone, a JXL with reconstruction data offers the restore', () => {
  const avif = recommend(
    source({
      input: 'Heif',
      format: 'avif',
      jpeg: null,
      heif: { codec: 'Av1', chroma: 'Half', bit_depth: 10 }
    }),
    null,
    null
  )
  assert.equal(avif.verdict, 'skip')
  const jxl = recommend(
    source({
      input: 'Jxl',
      format: 'jxl',
      jpeg: null,
      jxl: { has_jpeg_reconstruction: true, uses_original_profile: false, lossless: null }
    }),
    null,
    null
  )
  assert.equal(jxl.verdict, 'skip')
  assert.equal(jxl.candidates[0].plan.target, 'jpeg-from-jxl')
})

test('RAW leads with DNG and every candidate builds a valid request shape', () => {
  const info = source({
    input: 'Raw',
    format: 'cr2',
    is_raw_mosaic: true,
    channels: 1,
    depth: 'Sixteen',
    bits: 14,
    bytes: 35_670_000,
    jpeg: null
  })
  const r = recommend(info, null, null)
  assert.equal(r.candidates[0].id, 'raw-dng')
  for (const c of r.candidates) {
    const req = buildConvertRequest(c.plan, info, '/x/IMG.CR2', { Path: '/x/out' })
    if (c.plan.target === 'dng') assert.equal(req.raw, null)
    else assert.notEqual(req.raw, null)
    // Every RAW candidate asks only for what the engine accepts, so the
    // recommended click converts without a policy error.
    assert.deepEqual(
      req.metadata,
      c.plan.target === 'dng'
        ? { exif: true, icc: false, xmp: false, iptc: false }
        : { exif: true, icc: true, xmp: false, iptc: false }
    )
  }
})

test('HEIC never gets HEIC offered and grey sources get channels expanded for AVIF', () => {
  const heic = recommend(
    source({
      input: 'Heif',
      format: 'heic',
      jpeg: null,
      heif: { codec: 'Hevc', chroma: 'Half', bit_depth: 8 }
    }),
    null,
    null
  )
  assert.ok(heic.candidates.every((c) => c.plan.target !== 'heic'))
  const grey = recommend(
    source({
      channels: 1,
      jpeg: {
        quality: 80,
        luma_quant_table: [],
        chroma_quant_table: null,
        subsampling: 'Grey',
        progressive: false,
        optimized_huffman: false,
        restart_interval: 0,
        components: 1
      }
    }),
    null,
    null
  )
  const avif = grey.candidates.find((c) => c.id === 'jpeg-avif')!
  assert.equal(avif.plan.pixel.channels, 3)
})
