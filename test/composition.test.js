import test from 'node:test'
import assert from 'node:assert'
import { normalize, uniform } from '../src/ask.js'
import { CELLS } from '../src/brain.js'
import { assign, blend, layout, toCounts } from '../src/composition.js'

const total = (counts) => Object.values(counts).reduce((s, c) => s + c, 0)

test('個数の合計は必ずセル数になる', () => {
  for (const dist of [uniform(), normalize({ food: 0.663, lost: 0.125, thought: 0.098, desire: 0.058, nothing: 0.038, worry: 0.018 }), normalize({ money: 1 })]) {
    assert.strictEqual(total(toCounts(dist, 75)), 75)
  }
  assert.strictEqual(toCounts(normalize({ money: 1 }), 75).money, 75)
})

test('端数の大きい字から配る', () => {
  const counts = toCounts(normalize({ food: 0.5, lost: 0.26, thought: 0.24 }), 10)
  assert.deepStrictEqual([counts.food, counts.lost, counts.thought], [5, 3, 2])
})

test('前回が無ければそのまま採る。あれば間を取る。材料が乏しいほど前回に寄る', () => {
  const a = normalize({ food: 1 })
  const b = normalize({ money: 1 })
  assert.deepStrictEqual(blend(null, b), b)
  assert.ok(Math.abs(blend(a, b, 0.3).money - 0.6) < 1e-9)
  assert.ok(blend(a, b, 1).money < blend(a, b, 0.7).money)
  assert.ok(blend(a, b, 1).money > 0, '完全には止めない')
})

test('割り当ては個数どおりで、同じ入力なら同じ結果になる', () => {
  const counts = toCounts(normalize({ sleep: 0.68, tired: 0.2, rest: 0.05, pain: 0.04, heal: 0.03 }), CELLS.length)
  const owner = assign(counts, CELLS)
  assert.strictEqual(owner.length, CELLS.length)
  assert.ok(owner.every(Boolean))
  assert.strictEqual(owner.filter((id) => id === 'sleep').length, counts.sleep)
  assert.deepStrictEqual(assign(counts, CELLS), owner)
})

test('構成比が少し動いただけなら、入れ替わるセルは少ない', () => {
  const before = layout(normalize({ sleep: 0.68, tired: 0.2, rest: 0.12 }), CELLS)
  const after = layout(normalize({ sleep: 0.64, tired: 0.24, rest: 0.12 }), CELLS)
  const changed = before.filter((id, i) => id !== after[i]).length
  assert.ok(changed <= 8, `入れ替わり ${changed} セル`)
})
