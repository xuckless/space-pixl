/**
 * The mark's geometry (src/shared/mark.ts) is the PIXL Family Kit's, and the
 * animated mark, the icons and the installer art all draw from it: its resting
 * pose must stay the logo's.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inFront, markParts, markSvg, onOrbit } from '../src/shared/mark'

test('the full mark rests with three pixels in front of the core and one behind', () => {
  const p = markParts({ id: 't' })
  assert.deepEqual(
    p.pixels.map((q) => [q.deg, q.size, inFront(q.deg)]),
    [
      [24, 16, true],
      [40, 10, true],
      [53, 6, true],
      [200, 10, false]
    ]
  )
})

test('the small mark keeps one heavy pixel and a thick ring', () => {
  const p = markParts({ detail: 'small', id: 't' })
  assert.equal(p.pixels.length, 1)
  assert.equal(p.orbit.width, 12)
})

test('the orbit is tilted -20 degrees about the centre', () => {
  const o = { rx: 112, ry: 30, tilt: -20, width: 3.2 }
  const [x, y] = onOrbit(o, 0)
  assert.ok(Math.abs(x - (120 + 112 * Math.cos((-20 * Math.PI) / 180))) < 1e-9)
  assert.ok(Math.abs(y - (120 + 112 * Math.sin((-20 * Math.PI) / 180))) < 1e-9)
})

test('ids are scoped per instance, so two marks on a page never share a gradient', () => {
  const a = markSvg({ id: 'a' })
  const b = markSvg({ id: 'b' })
  assert.ok(a.includes('id="asp"') && !a.includes('id="bsp"'))
  assert.ok(b.includes('url(#bsp)'))
})
