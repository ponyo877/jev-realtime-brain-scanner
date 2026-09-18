// 字幕の置き場と、Jev に渡す範囲（窓）の切り出し。DOM に依存しない。
// 確定した字幕（final）は 1 行ずつ積み、認識途中の字幕（interim）は 1 つだけ持って上書きする。

const MAX_AGE_MS = 30000
const MAX_CHARS = 120
const KEEP_LINES = 40

export function createTranscript({ maxAgeMs = MAX_AGE_MS, maxChars = MAX_CHARS } = {}) {
  let nextId = 1
  let lines = []
  let interim = ''

  return {
    addFinal(text, t) {
      const trimmed = text.trim()
      interim = ''
      if (!trimmed) return null
      const line = { id: nextId++, text: trimmed, t }
      lines.push(line)
      lines = lines.slice(-KEEP_LINES)
      return line
    },

    setInterim(text) {
      interim = text.trim()
    },

    get lines() {
      return lines
    },

    get interim() {
      return interim
    },

    /**
     * Jev に渡す範囲。新しい行から順に、maxAgeMs 以内かつ合計 maxChars 以内のものを入れる。
     * 最新の 1 行は古くても長くても必ず入れる（長すぎれば末尾だけ）。黙っているあいだに判断材料が空にならないように。
     * 最新の 1 行（latest）とそれより前（earlier）は分けて返す。Jev には新しい発話を重く見させたいので。
     * 間を置かずに話し続けると確定が来ず、認識途中の字幕が伸び続ける。こちらも末尾の maxChars 文字だけを渡す。
     * usedIds と speakingNow は、この範囲で聞いた答えを採用したときに字幕の強調に使う。
     */
    window(now) {
      const used = []
      let chars = 0
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i]
        const first = used.length === 0
        if (!first && (now - line.t > maxAgeMs || chars + line.text.length > maxChars)) break
        used.unshift(line)
        chars += line.text.length
      }
      const latest = (used.at(-1)?.text ?? '').slice(-maxChars)
      const earlier = used.slice(0, -1).map((l) => l.text).join(' ')
      return { earlier, latest, speakingNow: interim.slice(-maxChars), usedIds: used.map((l) => l.id) }
    },
  }
}
