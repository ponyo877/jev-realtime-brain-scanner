// 実 API を使った通し検証。台本の会話を画面と同じ手順（字幕の窓 → Jev → ならし → セルの個数）で流し、
// 話題が変わったとき脳内がどれだけ速く移るかと、応答時間と費用を出す。
//   TYPESAFE_API_KEY=... node sim/live.js

import { buildQuestions, buildState, readAnswers, top } from '../src/ask.js'
import { CELLS } from '../src/brain.js'
import { blend, layout, toCounts } from '../src/composition.js'
import { askJev } from '../src/jev.js'
import { BY_ID } from '../src/kanji.js'
import { createTranscript } from '../src/transcript.js'

const apiKey = process.env.TYPESAFE_API_KEY
if (!apiKey) {
  console.error('環境変数 TYPESAFE_API_KEY が必要です')
  process.exit(1)
}

// [確定した字幕, その直後に脳内で最多になってほしい字]。3 秒おきに話したことにする
const SCRIPT = [
  ['お腹すいたなあ。今日のお昼はラーメンにしようかな', ['food']],
  ['でも今月は金欠だから、お弁当で我慢したほうがいいかも', ['money']],
  ['昨日ぜんぜん寝てなくて、もう眠くて眠くて仕方ない', ['sleep', 'tired']],
  ['仕事終わったらビール飲みに行こうよ。友達も誘ってさ', ['sake', 'friend', 'play']],
  ['えーっと、あの、うーん', ['sake', 'friend', 'play', 'nothing']],
  ['そういえば来週テストがあるんだった。勉強しなきゃ', ['study']],
]

const questions = buildQuestions()
const transcript = createTranscript()
const latencies = []
let dist = null
let previous = null
let cost = 0
let hits = 0
let hedges = 0

for (const [i, [text, expected]] of SCRIPT.entries()) {
  const now = i * 3000
  transcript.addFinal(text, now)
  const win = transcript.window(now)
  const res = await askJev({ apiKey, state: buildState(win), questions, onLateUsage: (u) => (cost += u?.cost ?? 0) })
  const answer = readAnswers(res.answers)
  dist = blend(dist, answer.raw, answer.thin)
  const counts = toCounts(dist, CELLS.length)
  const owner = layout(dist, CELLS)
  const changed = previous ? owner.filter((id, c) => id !== previous[c]).length : CELLS.length
  previous = owner
  latencies.push(res.latencyMs)
  cost += res.usage?.cost ?? 0
  if (res.hedged) hedges++
  const best = top(dist, 6).filter(([id]) => counts[id] > 0)
  const hit = expected.includes(best[0][0])
  if (hit) hits++
  console.log(`\n${i + 1}.「${text}」`)
  console.log(`  ${hit ? '○' : '×'} ${best.map(([id]) => `${BY_ID[id].glyph}${counts[id]}`).join(' ')}  （${CELLS.length} セル中、入れ替わり ${changed}）`)
  console.log(`  thin=${answer.thin.toFixed(2)} ${res.latencyMs}ms${res.hedged ? ' hedged' : ''} in=${res.usage?.input_tokens}`)
}

latencies.sort((a, b) => a - b)
console.log(`\n最多の字が期待どおり ${hits}/${SCRIPT.length}、応答 中央値 ${latencies[Math.floor(latencies.length / 2)]}ms 最大 ${latencies.at(-1)}ms、2 本目を投げた ${hedges} 回、費用 $${cost.toFixed(6)}（1 回あたり $${(cost / SCRIPT.length).toFixed(6)}）`)
