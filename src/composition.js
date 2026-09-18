// 構成比を脳のセルに落とすまで。DOM に依存しない。
//   Jev の構成比 → 時間方向にならす → セルの個数にする → どのセルにどの字を置くか決める

import { IDS } from './kanji.js'

const BASE_ALPHA = 0.6

/**
 * 指数移動平均。前回の脳が無ければ、今回の答えをそのまま採る。
 * thin（判断材料が乏しい確率）が 0.5 を超えるぶんだけ新しい答えの重みを下げ、相づちだけで脳が入れ替わらないようにする。
 */
export function blend(previous, next, thin = 0) {
  if (!previous) return { ...next }
  const alpha = BASE_ALPHA * (1 - 0.8 * Math.min(1, Math.max(0, (thin - 0.5) / 0.5)))
  return Object.fromEntries(IDS.map((id) => [id, (1 - alpha) * previous[id] + alpha * next[id]]))
}

/** 構成比を合計 n 個の整数に直す（最大剰余法）。端数の大きい字から 1 個ずつ配る。 */
export function toCounts(dist, n) {
  const exact = IDS.map((id) => [id, dist[id] * n])
  const counts = Object.fromEntries(exact.map(([id, v]) => [id, Math.floor(v)]))
  let left = n - Object.values(counts).reduce((s, c) => s + c, 0)
  const byRemainder = exact.map(([id, v]) => [id, v - Math.floor(v)]).sort((a, b) => b[1] - a[1])
  for (let i = 0; left > 0; i++, left--) counts[byRemainder[i % byRemainder.length][0]]++
  return counts
}

function hash(text) {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619)
  return h >>> 0
}

/**
 * 個数をセルに割り当てる。字ごとに決まった種セルを持たせ、個数の多い字から順に「種に近い空きセル」を取らせる。
 * 同じ字が塊になり、個数が少し変わっても塊の縁のセルしか入れ替わらない。
 * 戻り値はセルと同じ長さの id の配列。
 */
export function assign(counts, cells) {
  const owner = new Array(cells.length).fill(null)
  const order = IDS.filter((id) => counts[id] > 0).sort((a, b) => counts[b] - counts[a] || IDS.indexOf(a) - IDS.indexOf(b))
  for (const id of order) {
    const seed = cells[hash(id) % cells.length]
    const free = []
    for (let i = 0; i < cells.length; i++) {
      if (owner[i] === null) free.push([i, (cells[i].x - seed.x) ** 2 + (cells[i].y - seed.y) ** 2])
    }
    free.sort((a, b) => a[1] - b[1] || a[0] - b[0])
    for (const [i] of free.slice(0, counts[id])) owner[i] = id
  }
  return owner
}

/** 構成比からセルの割り当てまでをまとめて行う。 */
export function layout(dist, cells) {
  return assign(toCounts(dist, cells.length), cells)
}
