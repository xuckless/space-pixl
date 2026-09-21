import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createMockEngine, placeholderPng } from '../src/main/engine/mock'
import { buildConvertRequest, defaultPlan } from '../src/shared/plan'

const fixtures = resolve(import.meta.dirname, '../../pixl-engine/tests/images')
const jpeg = join(fixtures, 'jpeg_test.jpeg')
const engine = createMockEngine()

test('probe reads real PNG headers', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'space-pixl-mock-'))
  try {
    const path = join(dir, 'tiny.png')
    writeFileSync(path, placeholderPng())
    const info = await engine.probe(path)
    assert.equal(info.input, 'Png')
    assert.equal(info.width, 4)
    assert.equal(info.height, 4)
    assert.equal(info.channels, 3)
    assert.equal(info.bytes, statSync(path).size)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test(
  'probe, analyze, suggest and convert run against the engine fixture JPEG',
  { skip: !existsSync(jpeg) && 'engine fixtures not checked out beside this repo' },
  async () => {
    const info = await engine.probe(jpeg)
    assert.equal(info.input, 'Jpeg')
    assert.ok(
      info.width > 100 && info.height > 100,
      `real geometry, got ${info.width}×${info.height}`
    )
    const stats = await engine.analyze({
      source: { Path: jpeg },
      input: 'Jpeg',
      raw: null,
      domain: 'Encoded',
      bins: 64,
      percentiles: [1, 50, 99],
      clip_low: 5 / 255,
      clip_high: 250 / 255,
      hue_bins: 12,
      stride: 8,
      transparent: 'Include'
    })
    assert.equal(stats.luma_histogram.counts.length, 64)
    assert.equal(stats.luma_percentiles.length, 3)
    assert.ok(stats.luma_percentiles[0].value <= stats.luma_percentiles[2].value)
    const dir = mkdtempSync(join(tmpdir(), 'space-pixl-mock-'))
    try {
      const plan = defaultPlan()
      plan.target = 'jxl-repack'
      const out = join(dir, 'out.jxl')
      const report = await engine.convert(buildConvertRequest(plan, info, jpeg, { Path: out }))
      assert.ok(existsSync(out), 'a file is written so it can be revealed')
      assert.ok(report.output_bytes < report.input_bytes, 'the repack estimate is smaller')
      assert.equal(report.loss.quantisations, 0)
      // The placeholder refuses what the shipped engine refuses.
      plan.target = 'heic'
      await assert.rejects(
        engine.convert(buildConvertRequest(plan, info, jpeg, { Path: join(dir, 'x.heic') })),
        (e: { code: string }) => e.code === 'EncoderUnavailable'
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
)
