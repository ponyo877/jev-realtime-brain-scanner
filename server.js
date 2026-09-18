// ローカル用のサーバー。静的ファイルを配り、Jev への呼び出しを OpenRouter へ中継し、音声認識の字幕をブラウザへ流す。
// キーは環境変数 OPENROUTER_API_KEY から読み、ブラウザには一切渡さない。依存パッケージなし。
//   OPENROUTER_API_KEY=... node server.js [ポート=8053] [--no-stt]
//   STT_CMD="node sim/fake-stt.js" node server.js   ← 音声認識を、同じ形の JSONL を出す別のコマンドに差し替える

import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)))
const ARGS = process.argv.slice(2)
const PORT = Number(ARGS.find((a) => /^\d+$/.test(a)) ?? process.env.PORT ?? 8053)
const HOST = '127.0.0.1'
const API_KEY = process.env.OPENROUTER_API_KEY ?? ''
const MAX_BODY = 256 * 1024
const STT_BIN = join(ROOT, 'stt', '.build', 'release', 'stt')
const STT_CMD = process.env.STT_CMD ?? ''
const USE_STT = !ARGS.includes('--no-stt')

// 中継先はここに固定する。任意の URL へ飛ばせる口にはしない。
const UPSTREAM = {
  '/api/decisions': 'https://openrouter.ai/api/alpha/decisions',
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
}

const fail = (res, status, message) => send(res, status, { error: { code: status, message } })

const hostOk = (req) => [`${HOST}:${PORT}`, `localhost:${PORT}`].includes(req.headers.host)

/**
 * よそのサイトを開いているブラウザから、このサーバー経由でクレジットを使われないようにする。
 * Host を確かめて DNS リバインディングを防ぎ、JSON 以外を断って別オリジンからの単純リクエストを防ぐ
 * （application/json はプリフライトが要るが、このサーバーは OPTIONS に許可を返さない）。
 */
function guard(req) {
  if (!hostOk(req)) return 'Host が違います'
  const origin = req.headers.origin
  if (origin && ![`http://${HOST}:${PORT}`, `http://localhost:${PORT}`].includes(origin)) return 'オリジンが違います'
  if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return 'Content-Type は application/json にしてください'
  return null
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw Object.assign(new Error('リクエストが大きすぎます'), { status: 413 })
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function proxy(req, res, upstream) {
  const blocked = guard(req)
  if (blocked) return fail(res, 403, blocked)
  if (!API_KEY) return fail(res, 401, '環境変数 OPENROUTER_API_KEY が設定されていません')
  try {
    const body = await readBody(req)
    const up = await fetch(upstream, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'Jev Brain Scanner' },
      body,
    })
    send(res, up.status, Buffer.from(await up.arrayBuffer()))
  } catch (err) {
    fail(res, err.status ?? 502, `OpenRouter に届きませんでした: ${err.message}`)
  }
}

async function serveFile(req, res) {
  const path = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname)
  const file = normalize(join(ROOT, path === '/' ? 'index.html' : path))
  // ROOT の外と、.git や .env のようなドットファイルは配らない。
  if (!file.startsWith(ROOT + sep) || file.slice(ROOT.length).split(sep).some((part) => part.startsWith('.'))) {
    return fail(res, 404, 'Not found')
  }
  try {
    if (!(await stat(file)).isFile()) return fail(res, 404, 'Not found')
    send(res, 200, await readFile(file), TYPES[extname(file)] ?? 'application/octet-stream')
  } catch {
    fail(res, 404, 'Not found')
  }
}

// ---------- 字幕（SSE）----------
// 音声認識は stt/ の Swift CLI。stdout に 1 行 1 JSON で {type, text} を出すので、そのまま全ブラウザへ流す。
//   type: ready（聞き始めた） / status（準備の進み具合） / interim（認識途中） / final（確定） / error
// 認識エンジンを替えるときは、同じ形の JSONL を出すコマンドを環境変数 STT_CMD に指定する。

const listeners = new Set()
/** stt: off（--no-stt） / missing（未ビルド） / starting / listening / error */
let stt = { state: USE_STT ? 'starting' : 'off', detail: '' }
let child = null
let stopping = false

function broadcast(event) {
  const frame = `data: ${JSON.stringify(event)}\n\n`
  for (const res of listeners) res.write(frame)
}

function setStt(state, detail = '') {
  stt = { state, detail }
  broadcast({ type: 'stt', ...stt })
}

function captions(req, res) {
  if (!hostOk(req)) return fail(res, 403, 'Host が違います')
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' })
  res.write(`data: ${JSON.stringify({ type: 'stt', ...stt })}\n\n`)
  listeners.add(res)
  req.on('close', () => listeners.delete(res))
}

setInterval(() => {
  for (const res of listeners) res.write(': keep-alive\n\n')
}, 15000).unref()

function startStt(retryMs = 1000) {
  if (!USE_STT || stopping) return
  if (!STT_CMD && !existsSync(STT_BIN)) return setStt('missing', 'npm run build:stt')
  setStt('starting')
  let denied = false
  const stdio = ['ignore', 'pipe', 'inherit']
  child = STT_CMD ? spawn(STT_CMD, { shell: true, stdio }) : spawn(STT_BIN, [], { stdio })
  createInterface({ input: child.stdout }).on('line', (line) => {
    let event
    try {
      event = JSON.parse(line)
    } catch {
      return
    }
    if (event.type === 'ready') return setStt('listening')
    if (event.type === 'status') return setStt('starting', event.text ?? '')
    if (event.type === 'error') {
      // 権限が無いときは、何度起動し直しても同じ。設定を直してもらうまで止めておく。
      denied = event.code === 'denied'
      return setStt('error', event.text ?? '')
    }
    if (event.type === 'interim' || event.type === 'final') {
      retryMs = 1000
      broadcast({ type: event.type, text: String(event.text ?? '') })
    }
  })
  child.on('error', (err) => setStt('error', err.message))
  child.on('exit', (code) => {
    child = null
    if (stopping || denied) return
    if (stt.state !== 'error') setStt('error', `音声認識が終了しました（終了コード ${code}）`)
    setTimeout(() => startStt(Math.min(retryMs * 2, 30000)), retryMs).unref()
  })
}

function shutdown() {
  stopping = true
  child?.kill('SIGTERM')
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

createServer((req, res) => {
  const path = new URL(req.url, `http://${HOST}`).pathname
  if (req.method === 'GET' && path === '/api/status') return send(res, 200, { proxy: true, hasKey: Boolean(API_KEY), stt })
  if (req.method === 'GET' && path === '/api/captions') return captions(req, res)
  if (req.method === 'POST' && UPSTREAM[path]) return proxy(req, res, UPSTREAM[path])
  if (req.method === 'GET' || req.method === 'HEAD') return serveFile(req, res)
  fail(res, 405, 'Method not allowed')
}).listen(PORT, HOST, () => {
  console.log(`リアルタイム脳内メーカー: http://localhost:${PORT}`)
  console.log(API_KEY ? 'OPENROUTER_API_KEY を使って Jev を中継します' : 'OPENROUTER_API_KEY が未設定です。脳内は更新されません')
  if (!USE_STT) console.log('--no-stt: 音声認識を起動しません。画面の入力欄から文字で試せます')
  else if (STT_CMD) console.log(`音声認識のコマンド: ${STT_CMD}`)
  else if (!existsSync(STT_BIN)) console.log('音声認識が未ビルドです。npm run build:stt を実行してください。画面の入力欄から文字でも試せます')
  startStt()
})
