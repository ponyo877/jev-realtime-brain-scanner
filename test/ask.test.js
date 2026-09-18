import test from 'node:test'
import assert from 'node:assert'
import { buildQuestions, buildState, normalize, readAnswers, top } from '../src/ask.js'
import { IDS, KANJI } from '../src/kanji.js'

const sum = (dist) => Object.values(dist).reduce((s, v) => s + v, 0)

test('字は 53 個で、id も字も色も重複しない', () => {
  assert.strictEqual(KANJI.length, 53)
  for (const key of ['id', 'glyph', 'color']) assert.strictEqual(new Set(KANJI.map((k) => k[key])).size, 53, key)
})

test('問いは choice 1 問、字ごとの noul 53 問、too_thin の計 55 問', () => {
  const q = buildQuestions()
  assert.strictEqual(Object.keys(q).length, 55)
  assert.strictEqual(q.brain.type, 'choice')
  assert.deepStrictEqual(Object.keys(q.brain.criteria), IDS)
  assert.ok(IDS.every((id) => q[id].type === 'noul'))
})

test('state には字幕がそのまま入る。空なら空だと分かる文字列を入れる', () => {
  const { transcript } = buildState({ earlier: '眠い', latest: 'お腹すいた', speakingNow: 'ラーメン' })
  assert.deepStrictEqual(transcript, { earlier: '眠い', latest: 'お腹すいた', speaking_now: 'ラーメン' })
  assert.deepStrictEqual(buildState({}).transcript, { earlier: '(nothing)', latest: '(nothing yet)', speaking_now: '(silent)' })
})

test('choice と noul を半々で混ぜる。choice で 0 の字も、noul が高ければ構成比に残る', () => {
  const answers = { too_thin: { noul: 0.3 }, brain: { probabilities: { sleep: 0.98, tired: 0.01, nothing: 0.01 } } }
  for (const id of IDS) answers[id] = { noul: 0.05 }
  Object.assign(answers, { sleep: { noul: 0.92 }, tired: { noul: 0.93 }, rest: { noul: 0.62 } })
  const { raw, choice, nouls, thin } = readAnswers(answers)
  assert.ok(Math.abs(sum(raw) - 1) < 1e-9)
  assert.strictEqual(top(raw, 1)[0][0], 'sleep')
  assert.ok(raw.tired > 0.15 && raw.rest > 0.02, '脇役が残る')
  assert.ok(raw.evil < 0.001, '無関係な字はほぼ消える')
  assert.strictEqual(choice.rest, 0)
  assert.strictEqual(nouls.rest, 0.62)
  assert.strictEqual(thin, 0.3)
})

test('片方の問いの答えだけでも読める。何も無ければ一様', () => {
  assert.strictEqual(top(readAnswers({ brain: { probabilities: { food: 2, lost: 2 } } }).raw, 2).length, 2)
  assert.strictEqual(readAnswers({ brain: { probabilities: { food: 2, lost: 2 } } }).raw.food, 0.5)
  assert.ok(readAnswers({ food: { noul: 0.9 } }).raw.food > 0.99)
  assert.ok(Math.abs(readAnswers({}).raw.food - 1 / 53) < 1e-9)
  assert.ok(Math.abs(sum(normalize({ food: -1, junk: 5 })) - 1) < 1e-9)
})
