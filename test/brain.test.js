import test from 'node:test'
import assert from 'node:assert'
import { BRAIN_OUTLINE, CELLS, GLYPH, HEAD_OUTLINE, buildCells, inside } from '../src/brain.js'

const extent = (points, k) => [Math.min(...points.map((p) => p[k])), Math.max(...points.map((p) => p[k]))]

test('横顔は左向き。鼻先が左端、後頭部が右端で、本家の実測に近い', () => {
  const [left, right] = extent(HEAD_OUTLINE, 0)
  const nose = HEAD_OUTLINE.find((p) => p[0] === left)
  assert.ok(Math.abs(left - 16) <= 2 && Math.abs(nose[1] - 196) <= 6, `鼻先 ${nose}`)
  assert.ok(Math.abs(right - 280) <= 2)
})

test('脳は実測の範囲 (57,37)–(263,193) に収まり、頭の中にある', () => {
  const [x0, x1] = extent(BRAIN_OUTLINE, 0)
  const [y0, y1] = extent(BRAIN_OUTLINE, 1)
  for (const [got, want] of [[x0, 57], [x1, 263], [y0, 37], [y1, 193]]) assert.ok(Math.abs(got - want) <= 3, `${got} vs ${want}`)
  assert.ok(BRAIN_OUTLINE.every(([x, y]) => inside(HEAD_OUTLINE, x, y)))
})

test('セルは 70〜85 個で、すべて脳の中にあり、字どうしが重ならない', () => {
  assert.ok(CELLS.length >= 70 && CELLS.length <= 85, `${CELLS.length} 個`)
  assert.ok(CELLS.every((c) => inside(BRAIN_OUTLINE, c.x, c.y)))
  for (let i = 0; i < CELLS.length; i++) {
    for (let j = i + 1; j < CELLS.length; j++) {
      const apart = Math.max(Math.abs(CELLS[i].x - CELLS[j].x), Math.abs(CELLS[i].y - CELLS[j].y))
      assert.ok(apart >= GLYPH - 3, `セル ${i} と ${j} が近すぎる`)
    }
  }
})

test('セルの座標は毎回同じ', () => {
  assert.deepStrictEqual(buildCells(), CELLS)
})
