import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Store } from '../src/main/db'

function seeded(): Store {
  const s = Store.open(':memory:')
  const now = new Date()
  const id1 = s.startConversion(
    {
      sourcePath: '/a.jpg',
      inputFormat: 'jpeg',
      target: 'jxl-repack',
      description: 'JXL repack',
      inputBytes: 10_000,
      lossless: true,
      reversible: true,
      engine: 'native'
    },
    now
  )
  s.finishConversion(id1, {
    outputPath: '/a.jxl',
    outputBytes: 8_000,
    durationMs: 300,
    status: 'ok',
    error: null
  })
  const id2 = s.startConversion(
    {
      sourcePath: '/b.png',
      inputFormat: 'png',
      target: 'avif',
      description: 'AVIF q75',
      inputBytes: 100_000,
      lossless: false,
      reversible: false,
      engine: 'mock'
    },
    now
  )
  s.finishConversion(id2, {
    outputPath: '/b.avif',
    outputBytes: 5_000,
    durationMs: 2000,
    status: 'ok',
    error: null
  })
  const id3 = s.startConversion(
    {
      sourcePath: '/c.heic',
      inputFormat: 'heic',
      target: 'avif',
      description: 'AVIF',
      inputBytes: 3_000,
      lossless: false,
      reversible: false,
      engine: 'native'
    },
    new Date(now.getFullYear() - 1, 0, 1)
  )
  s.finishConversion(id3, {
    outputPath: null,
    outputBytes: null,
    durationMs: 10,
    status: 'error',
    error: 'EncoderUnavailable: x'
  })
  s.recordInspection('/a.jpg', 'jpeg', 10_000, 'native', now)
  return s
}

test('summary adds up lifetime, month, per-target and reversible savings', () => {
  const s = seeded()
  const sum = s.summary()
  assert.equal(sum.lifetime.converted, 2)
  assert.equal(sum.lifetime.failed, 1)
  assert.equal(sum.lifetime.savedBytes, 97_000)
  assert.equal(sum.lifetime.engineMs, 2300)
  assert.equal(sum.lifetime.analysed, 1)
  assert.equal(sum.month.converted, 2)
  assert.equal(sum.reversibleSavedBytes, 2_000)
  assert.equal(sum.losslessSavedBytes, 2_000)
  assert.equal(sum.mockRows, 1)
  assert.equal(sum.byTarget[0].target, 'avif')
  assert.equal(sum.byTarget[0].savedBytes, 95_000)
  assert.equal(sum.daily.length, 30)
  assert.equal(sum.daily[29].savedBytes, 97_000)
  assert.equal(sum.biggest[0].sourcePath, '/b.png')
  assert.equal(sum.recent.length, 3)
  s.close()
})

test('reconcile turns interrupted rows into errors and clear empties everything', () => {
  const s = seeded()
  s.startConversion({
    sourcePath: '/d.jpg',
    inputFormat: 'jpeg',
    target: 'avif',
    description: '',
    inputBytes: 1,
    lossless: false,
    reversible: false,
    engine: 'native'
  })
  s.reconcile()
  assert.equal(s.summary().lifetime.failed, 2)
  s.clear()
  const sum = s.summary()
  assert.equal(sum.lifetime.converted + sum.lifetime.failed + sum.lifetime.analysed, 0)
  s.close()
})
