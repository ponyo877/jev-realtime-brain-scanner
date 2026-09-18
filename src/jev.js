// OpenRouter 経由の Jev 呼び出し。DOM に依存しないので Node からも使える。
// Jev は OpenRouter の Decisions エンドポイント（alpha）で提供されている。chat/completions ではない。

export const DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions'
export const DEFAULT_MODEL = 'typesafe/jev-1.13'

export class JevError extends Error {
  constructor(message, { status = 0, fatal = false } = {}) {
    super(message)
    this.name = 'JevError'
    this.status = status
    /** キーや残高の問題。設定を直すまで呼び続けても無駄なもの。 */
    this.fatal = fatal
  }
}

function explain(status, body) {
  const detail = body?.error?.message ? ` (${body.error.message})` : ''
  if (status === 401) return `The API key did not work.${detail}`
  if (status === 402) return `Not enough OpenRouter credit.${detail}`
  if (status === 404) return `Model not found.${detail}`
  if (status === 429) return 'Too many calls. Rate limit hit.'
  return `Jev error: HTTP ${status}.${detail}`
}

async function request({ url, apiKey, body, timeoutMs, fetchImpl }) {
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      // apiKey が空なのは server.js の中継を使うとき。キーは中継側が付ける。
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        'Content-Type': 'application/json',
        'X-Title': 'Jev Brain Scanner',
      },
      body,
      // 期限は要求ごとに持つ。2 本目を投げたあとも、負けた側が期限なしで残らないように
      signal: AbortSignal.timeout(timeoutMs),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      throw new JevError(explain(res.status, json), {
        status: res.status,
        fatal: [401, 402, 403, 404].includes(res.status),
      })
    }
    if (!json?.answers) throw new JevError('Jev sent no answers.')
    return { answers: json.answers, usage: json.usage ?? null }
  } catch (err) {
    if (err instanceof JevError) throw err
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') throw new JevError(`Jev did not reply in ${timeoutMs} ms.`)
    throw new JevError(`Can't reach Jev: ${err?.message ?? err}.`)
  }
}

/**
 * state と質問を 1 リクエストで送る。Jev は全質問を並列に評価する。
 *
 * 応答はふだん数百 ms だが、まれに何秒も返らない。hedgeAfterMs たっても返らなければ同じ要求をもう 1 本投げ、
 * 先に成功したほうを採る（ヘッジ）。送る内容は同じなので、判断は変わらない。
 *   - キーや残高の問題（fatal）とレート制限（429）では 2 本目を投げない。投げても同じ結果になる。
 *   - それ以外の失敗がすぐ返ってきたら、待たずに 2 本目を投げる。
 *   - 負けた要求は止めない。あとで届いた usage は onLateUsage に渡すので、呼び出し側は費用を取りこぼさない。
 * latencyMs は最初の要求を投げてからの実時間。ヘッジが勝っても短く見せない。
 */
export function askJev({ apiKey, url = DECISIONS_URL, model = DEFAULT_MODEL, state, questions, timeoutMs = 4000, hedgeAfterMs = 1200, onLateUsage, fetchImpl = fetch }) {
  const started = performance.now()
  const body = JSON.stringify({ model, state, questions })

  return new Promise((resolve, reject) => {
    const errors = []
    let settled = false
    let hedged = false
    let outstanding = 0
    let timer = null

    const launch = (attempt) => {
      outstanding++
      request({ url, apiKey, body, timeoutMs, fetchImpl }).then(
        (res) => {
          outstanding--
          if (settled) {
            onLateUsage?.(res.usage)
            return
          }
          settled = true
          clearTimeout(timer)
          resolve({ ...res, latencyMs: Math.round(performance.now() - started), hedged, attempt })
        },
        (err) => {
          outstanding--
          if (settled) return
          errors.push(err)
          const hopeless = err.fatal || err.status === 429
          if (!hedged && !hopeless && hedgeAfterMs != null) {
            hedge()
            return
          }
          if (outstanding > 0) return
          settled = true
          clearTimeout(timer)
          reject(errors.find((e) => e.fatal) ?? errors[0])
        },
      )
    }

    const hedge = () => {
      clearTimeout(timer)
      if (settled || hedged) return
      hedged = true
      launch(2)
    }

    launch(1)
    if (hedgeAfterMs != null) timer = setTimeout(hedge, hedgeAfterMs)
  })
}
