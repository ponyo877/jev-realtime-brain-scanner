import test from 'node:test'
import assert from 'node:assert'
import { askJev } from '../src/jev.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const ok = (cost) => ({ ok: true, status: 200, json: async () => ({ answers: { q: { noul: 0.5 } }, usage: { cost } }) })
const fail = (status) => ({ ok: false, status, json: async () => ({}) })

/** 呼ばれた順に plan[i] = [待ち ms, 応答] を返す fetch。 */
function scripted(plan) {
  let calls = 0
  const seen = []
  const fetchImpl = async (url, init) => {
    seen.push({ url, init })
    const [delay, response] = plan[calls++]
    await sleep(delay)
    if (response instanceof Error) throw response
    return response
  }
  return { fetchImpl, calls: () => calls, seen }
}

const ask = (fetchImpl, extra = {}) => askJev({ apiKey: 'k', state: {}, questions: {}, hedgeAfterMs: 30, timeoutMs: 500, fetchImpl, ...extra })

test('1 本目が速ければ 2 本目は投げない', async () => {
  const s = scripted([[5, ok(1)], [0, ok(2)]])
  const res = await ask(s.fetchImpl)
  await sleep(60)
  assert.strictEqual(s.calls(), 1)
  assert.strictEqual(res.hedged, false)
  assert.strictEqual(res.attempt, 1)
  assert.strictEqual(res.usage.cost, 1)
})

test('1 本目が遅ければ 2 本目を投げ、先に届いたほうを採る。負けた側の費用も取りこぼさない', async () => {
  const s = scripted([[150, ok(1)], [5, ok(2)]])
  const late = []
  const res = await ask(s.fetchImpl, { onLateUsage: (usage) => late.push(usage.cost) })
  assert.strictEqual(res.hedged, true)
  assert.strictEqual(res.attempt, 2)
  assert.strictEqual(res.usage.cost, 2)
  assert.ok(res.latencyMs >= 30, '応答時間は最初の要求からの実時間')
  assert.deepStrictEqual(late, [])
  await sleep(160)
  assert.deepStrictEqual(late, [1], '負けた 1 本目の費用が 1 回だけ届く')
})

test('すぐ失敗したら、待たずに 2 本目を投げる', async () => {
  const s = scripted([[0, new Error('reset')], [5, ok(2)]])
  const started = performance.now()
  const res = await ask(s.fetchImpl, { hedgeAfterMs: 400 })
  assert.ok(performance.now() - started < 200)
  assert.strictEqual(res.attempt, 2)
})

test('キーの問題やレート制限では 2 本目を投げない', async () => {
  for (const status of [401, 429]) {
    const s = scripted([[0, fail(status)], [0, ok(2)]])
    await assert.rejects(ask(s.fetchImpl), (err) => err.status === status && err.fatal === (status === 401))
    await sleep(50)
    assert.strictEqual(s.calls(), 1)
  }
})

test('両方失敗したら、致命的なほうのエラーを返す', async () => {
  const s = scripted([[80, fail(500)], [5, fail(402)]])
  await assert.rejects(ask(s.fetchImpl), (err) => err.fatal === true && err.status === 402)
  assert.strictEqual(s.calls(), 2)
})

test('期限を過ぎた要求はタイムアウトとして失敗する', async () => {
  const hang = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)))
  await assert.rejects(askJev({ apiKey: 'k', state: {}, questions: {}, hedgeAfterMs: 20, timeoutMs: 60, fetchImpl: hang }), /did not reply in 60 ms/)
})

test('中継を使うとき（キーなし）は Authorization を付けず、渡した url に送る', async () => {
  const s = scripted([[0, ok(1)]])
  await ask(s.fetchImpl, { apiKey: '', url: '/api/decisions' })
  assert.strictEqual(s.seen[0].url, '/api/decisions')
  assert.ok(!('Authorization' in s.seen[0].init.headers))
})
