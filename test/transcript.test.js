import test from 'node:test'
import assert from 'node:assert'
import { createTranscript } from '../src/transcript.js'

test('確定した字幕を積み、認識途中の字幕は上書きする。確定したら途中のものは消える', () => {
  const t = createTranscript()
  t.setInterim('お腹')
  t.setInterim('お腹すい')
  assert.strictEqual(t.interim, 'お腹すい')
  const line = t.addFinal(' お腹すいた ', 1000)
  assert.deepStrictEqual(line, { id: 1, text: 'お腹すいた', t: 1000 })
  assert.strictEqual(t.interim, '')
  assert.strictEqual(t.addFinal('   ', 1100), null)
  assert.strictEqual(t.lines.length, 1)
})

test('窓には新しい行から、時間と文字数の範囲で入る', () => {
  const t = createTranscript({ maxAgeMs: 10000, maxChars: 12 })
  t.addFinal('あいうえお', 0)
  t.addFinal('かきくけこ', 8000)
  t.addFinal('さしすせそ', 9000)
  t.setInterim('たち')
  assert.deepStrictEqual(t.window(9500), { earlier: 'かきくけこ', latest: 'さしすせそ', speakingNow: 'たち', usedIds: [2, 3] })
  assert.deepStrictEqual(t.window(19500).usedIds, [3], '古くなっても最新の 1 行は残す')
})

test('最新の 1 行や認識途中の字幕が長すぎれば末尾だけを渡す', () => {
  const t = createTranscript({ maxChars: 5 })
  t.addFinal('あいうえおかきくけこ', 0)
  t.setInterim('さしすせそたちつてと')
  assert.strictEqual(t.window(0).latest, 'かきくけこ')
  assert.strictEqual(t.window(0).speakingNow, 'たちつてと')
  assert.strictEqual(t.interim, 'さしすせそたちつてと', '画面に出す字幕は切らない')
})

test('何も話していなければ空', () => {
  assert.deepStrictEqual(createTranscript().window(0), { earlier: '', latest: '', speakingNow: '', usedIds: [] })
})
