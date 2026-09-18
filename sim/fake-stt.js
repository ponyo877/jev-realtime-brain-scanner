// 偽の音声認識。stt/ の Swift CLI と同じ形の JSONL を、台本どおりに stdout へ出す。マイクなしで画面を確かめるためのもの。
//   STT_CMD="node sim/fake-stt.js" node server.js
// 1 文ごとに、認識途中（interim）を少しずつ伸ばしてから確定（final）を出す。

const LINES = [
  'お腹すいたなあ。今日のお昼はラーメンにしようかな',
  'でも今月は金欠だから、お弁当で我慢したほうがいいかも',
  '昨日ぜんぜん寝てなくて、もう眠くて眠くて仕方ない',
  '仕事終わったらビール飲みに行こうよ。友達も誘ってさ',
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`)

emit({ type: 'status', text: 'fake' })
await sleep(1500)
emit({ type: 'ready' })
for (const line of LINES) {
  await sleep(1500)
  for (let n = 3; n < line.length; n += 3) {
    emit({ type: 'interim', text: line.slice(0, n) })
    await sleep(220)
  }
  emit({ type: 'final', text: line })
}
// 黙ったままにする。終了すると server.js が起動し直してしまう
setInterval(() => {}, 1 << 30)
