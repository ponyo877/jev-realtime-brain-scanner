// 画面の制御。字幕を受け取り、Jev に聞くタイミングを決め、脳内と字幕と内訳を描き直す。

import { buildQuestions, buildState, readAnswers, top } from './ask.js'
import { CELLS } from './brain.js'
import { blend, layout, toCounts } from './composition.js'
import { askJev } from './jev.js'
import { BY_ID } from './kanji.js'
import { createSketch } from './sketch.js'
import { createTranscript } from './transcript.js'

const $ = (id) => document.getElementById(id)

const MIN_GAP_MS = 1000 // 呼び出しの最短間隔
const INTERIM_GAP_MS = 1200 // 認識途中の字幕で聞くのは、この間隔まで
const INTERIM_GROWTH = 6 // かつ、前に聞いたときからこの文字数だけ変わったとき
const SHOWN_LINES = 6
const BAR_ROWS = 8

const store = {
  get(key) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch {
      // 保存できなくても動作に支障はない
    }
  },
}

const questions = buildQuestions()
const sketch = createSketch($('stage'))
let transcript = createTranscript()

let epoch = 0 // 「消す」で進める。古い応答を捨てるため
let inflight = false
let dirty = false
let timer = null
let lastAskAt = -Infinity
let lastAskedInterim = ''
let dist = null // いま表示している構成比
let adopted = null // いまの脳内のもとになった要求: { usedIds, speakingNow }
const totals = { calls: 0, cost: 0 }

// ---------- 名前 ----------

function renderName() {
  const name = $('name').value.trim() || 'あなた'
  $('name-out').textContent = name
  store.set('jev-brain:name', name)
}
$('name').value = store.get('jev-brain:name') ?? 'あなた'
$('name').addEventListener('input', renderName)
$('name-form').addEventListener('submit', (e) => e.preventDefault())
renderName()

// ---------- 字幕 ----------

function renderCaptions() {
  const list = $('caption-lines')
  list.replaceChildren()
  const used = new Set(adopted?.usedIds ?? [])
  for (const line of transcript.lines.slice(-SHOWN_LINES)) {
    const li = document.createElement('li')
    if (used.has(line.id)) {
      li.className = 'used'
      const span = document.createElement('span')
      span.className = 'mark'
      span.textContent = line.text
      li.append(span)
    } else {
      li.textContent = line.text
    }
    list.append(li)
  }
  const interim = transcript.interim
  if (interim) {
    const li = document.createElement('li')
    li.className = 'interim'
    // 認識途中の字幕は伸びていくので、聞いた時点で渡した部分だけに印を付ける（長いときは末尾だけを渡している）
    const asked = adopted?.speakingNow ?? ''
    const at = asked ? interim.indexOf(asked) : -1
    if (at >= 0) {
      const span = document.createElement('span')
      span.className = 'mark'
      span.textContent = asked
      li.append(interim.slice(0, at), span, interim.slice(at + asked.length))
    } else {
      li.textContent = interim
    }
    list.append(li)
  }
  if (!list.children.length) {
    const li = document.createElement('li')
    li.className = 'empty'
    li.textContent = '話しかけると、ここに字幕が出ます'
    list.append(li)
  }
}

const STT_TEXT = {
  off: '音声認識なし（文字で試せます）',
  missing: '音声認識が未ビルドです: npm run build:stt',
  starting: '音声認識を準備中…',
  listening: '● 聞いています',
  error: '音声認識が止まっています',
}

function renderStt({ state, detail }) {
  const node = $('stt-status')
  node.dataset.state = state
  node.textContent = (STT_TEXT[state] ?? state) + (detail && state !== 'missing' ? `（${detail}）` : '')
}

// ---------- Jev に聞く ----------

function schedule() {
  if (inflight) {
    dirty = true
    return
  }
  clearTimeout(timer)
  const wait = Math.max(0, lastAskAt + MIN_GAP_MS - performance.now())
  timer = setTimeout(fire, wait)
}

async function fire() {
  const win = transcript.window(Date.now())
  if (!win.latest && !win.speakingNow) return
  const state = buildState(win)
  const mine = epoch
  inflight = true
  lastAskAt = performance.now()
  lastAskedInterim = win.speakingNow
  try {
    // キーは server.js の中継が付ける
    const res = await askJev({ apiKey: '', url: '/api/decisions', state, questions, onLateUsage: addUsage })
    addUsage(res.usage)
    if (mine === epoch) adopt(res, win, state)
  } catch (err) {
    if (mine === epoch) $('alert').textContent = err.message
  } finally {
    inflight = false
    if (dirty) {
      dirty = false
      schedule()
    }
  }
}

function addUsage(usage) {
  totals.calls++
  totals.cost += usage?.cost ?? 0
  $('fact-calls').textContent = `${totals.calls} 回`
  $('fact-cost').textContent = `$${totals.cost.toFixed(5)}`
}

function adopt(res, win, state) {
  const answer = readAnswers(res.answers)
  dist = blend(dist, answer.raw, answer.thin)
  adopted = { usedIds: win.usedIds, speakingNow: win.speakingNow }
  sketch.setLayout(layout(dist, CELLS))

  renderBars(answer)
  $('alert').textContent = ''
  $('thin').textContent = `判断材料が乏しい確率 ${answer.thin.toFixed(2)}`
  $('fact-latency').textContent = `${res.latencyMs} ms${res.hedged ? '（2 本目を投げた）' : ''}`
  $('fact-chars').textContent = `${win.earlier.length + win.latest.length + win.speakingNow.length} 文字`
  $('fact-questions').textContent = `${Object.keys(questions).length} 問`
  $('seen').textContent = JSON.stringify(state, null, 2)
  $('announce').textContent = top(dist, 3).map(([id, p]) => `${BY_ID[id].glyph} ${Math.round(p * 100)}%`).join('、')
  renderCaptions()
}

// ---------- 内訳 ----------

const rows = Array.from({ length: BAR_ROWS }, () => {
  const row = document.createElement('div')
  row.className = 'bar idle'
  row.innerHTML = '<span class="glyph"></span><span class="track"><i></i></span><span class="pct"></span><span class="raw"></span>'
  $('bars').append(row)
  return row
})

function renderBars(answer) {
  // 画面の脳と同じ数え方（セルの個数）で出す。脳に 1 個も無い字は出さない
  const counts = dist ? toCounts(dist, CELLS.length) : {}
  const best = dist ? top(dist, BAR_ROWS).filter(([id]) => counts[id] > 0) : []
  rows.forEach((row, i) => {
    const entry = best[i]
    row.classList.toggle('idle', !entry)
    if (!entry) {
      row.querySelector('i').style.width = '0%'
      return
    }
    const [id, p] = entry
    const k = BY_ID[id]
    const glyph = row.querySelector('.glyph')
    glyph.textContent = k.glyph
    glyph.style.color = k.color
    row.querySelector('i').style.background = k.color
    row.querySelector('i').style.width = `${(p * 100).toFixed(1)}%`
    row.querySelector('.pct').textContent = `${Math.round(p * 100)}%`
    const c = answer?.choice?.[id]
    const n = answer?.nouls?.[id]
    row.querySelector('.raw').textContent = answer ? `c ${fmt(c)} n ${fmt(n)}` : ''
  })
}

const fmt = (v) => (typeof v === 'number' ? v.toFixed(2).replace(/^0/, '') : '–')

// ---------- 入力 ----------

function onFinal(text) {
  if (!transcript.addFinal(text, Date.now())) return
  renderCaptions()
  schedule()
}

function onInterim(text) {
  transcript.setInterim(text)
  renderCaptions()
  const grown = Math.abs(transcript.interim.length - lastAskedInterim.length) >= INTERIM_GROWTH
  if (transcript.interim && grown && performance.now() - lastAskAt >= INTERIM_GAP_MS) schedule()
}

$('say-form').addEventListener('submit', (e) => {
  e.preventDefault()
  onFinal($('say').value)
  $('say').value = ''
})

$('reset').addEventListener('click', () => {
  epoch++
  clearTimeout(timer)
  dirty = false
  transcript = createTranscript()
  dist = null
  adopted = null
  lastAskedInterim = ''
  sketch.setLayout(CELLS.map(() => null))
  renderBars(null)
  renderCaptions()
  $('seen').textContent = '(まだ何も送っていません)'
  $('thin').textContent = '判断材料が乏しい確率 –'
  $('announce').textContent = ''
})

async function connect() {
  try {
    const status = await (await fetch('/api/status')).json()
    if (!status.hasKey) $('alert').textContent = '環境変数 TYPESAFE_API_KEY が未設定です'
    renderStt(status.stt)
  } catch {
    $('alert').textContent = 'node server.js で起動してください'
    renderStt({ state: 'off', detail: '' })
    return
  }
  const source = new EventSource('/api/captions')
  source.onmessage = (e) => {
    const event = JSON.parse(e.data)
    if (event.type === 'stt') renderStt(event)
    else if (event.type === 'interim') onInterim(event.text)
    else if (event.type === 'final') onFinal(event.text)
  }
}

renderCaptions()
connect()
