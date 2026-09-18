// 実 API での下調べ。2 つのことを確かめる。
//   1. choice が 53 択で動くか。動かないなら noul を 53 問並べる聞き方に切り替える。
//   2. Jev が日本語の字幕をそのまま読めるか。食べ物の話で「食」、お金の話で「金」が上位に来るか。
//   OPENROUTER_API_KEY=... node sim/probe.js [fused|choice|noul|all=fused]
// fused は実際に送る形（choice と noul を 1 リクエストに入れ、答えを混ぜる）。

import { buildQuestions, buildState, choiceQuestions, noulQuestions, readAnswers, top } from '../src/ask.js'
import { askJev } from '../src/jev.js'
import { BY_ID } from '../src/kanji.js'

const apiKey = process.env.OPENROUTER_API_KEY
if (!apiKey) {
  console.error('環境変数 OPENROUTER_API_KEY が必要です')
  process.exit(1)
}

const mode = process.argv[2] ?? 'fused'

// [字幕, 上位に来てほしい字]
const LINES = [
  ['お腹すいたなあ。今日のお昼はラーメンにしようかな、それともカレーかな', ['food', 'lost']],
  ['今月も給料日前で金欠なんだよね。ボーナスが出たら投資に回したい', ['money', 'desire']],
  ['昨日ぜんぜん寝てなくて、もう眠くて眠くて仕方ない。早く布団に入りたい', ['sleep', 'tired']],
  ['あの人のことがずっと頭から離れなくて、今度会ったら気持ちを伝えようと思う', ['love', 'confess', 'like']],
  ['上司がまた無茶なこと言ってきてさ、本当に腹が立つ。もう会社辞めたい', ['anger', 'escape', 'dislike']],
  ['仕事終わったらビール飲みに行こうよ。友達も誘ってさ', ['sake', 'friend', 'fun']],
  ['えーっと、あの、うーん', ['nothing']],
]

async function run(label, questions) {
  console.log(`\n=== ${label}（質問 ${Object.keys(questions).length} 個）===`)
  const latencies = []
  let cost = 0
  let hits = 0
  for (const [text, expected] of LINES) {
    try {
      const res = await askJev({ apiKey, state: buildState({ latest: text }), questions, timeoutMs: 15000, hedgeAfterMs: null })
      const { raw, thin } = readAnswers(res.answers)
      const best = top(raw, 8)
      const hit = best.slice(0, 3).some(([id]) => expected.includes(id))
      if (hit) hits++
      latencies.push(res.latencyMs)
      cost += res.usage?.cost ?? 0
      console.log(`\n「${text}」`)
      console.log(`  ${hit ? '○' : '×'} ${best.map(([id, p]) => `${BY_ID[id].glyph}${(p * 100).toFixed(1)}%`).join('  ')}`)
      console.log(`  thin=${thin.toFixed(2)}  ${res.latencyMs}ms  in=${res.usage?.input_tokens} out=${res.usage?.output_tokens} cost=$${res.usage?.cost}`)
    } catch (err) {
      console.log(`\n「${text}」\n  失敗: ${err.message}`)
    }
  }
  latencies.sort((a, b) => a - b)
  console.log(`\n${label}: 上位 3 字に期待の字 ${hits}/${LINES.length}、応答 中央値 ${latencies[Math.floor(latencies.length / 2)]}ms 最大 ${latencies.at(-1)}ms、費用 $${cost.toFixed(6)}`)
}

if (mode === 'fused' || mode === 'all') await run('choice + noul の合成', buildQuestions())
if (mode === 'choice' || mode === 'all') await run('choice 53 択', choiceQuestions())
if (mode === 'noul' || mode === 'all') await run('noul 53 問', noulQuestions())
