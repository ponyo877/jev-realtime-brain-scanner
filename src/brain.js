// 横顔と脳の輪郭、字を置くセルの座標。論理座標は 300×340（本家の生成画像と同じ大きさ）。DOM に依存しない。
// 輪郭は本家の画像をなぞったものではなく、測った基準点（鼻先、後頭部の張り、脳の範囲）に合わせて引き直したもの。

export const WIDTH = 300
export const HEIGHT = 340

export const COLORS = {
  frame: '#5bad00',
  paper: '#ffffff',
  skin: '#ffcc99',
  // 本家は #a97d7a。字を読みやすくするため、白の側へ 4 割寄せてある。
  // 明るい色の字はこの背景に溶けるので、sketch.js で縁取りを付けている
  brain: '#cbb1af',
  line: '#706e6d',
}

// 左向きの横顔。喉元から顔を上がり、頭頂、後頭部を回ってうなじまで。ここは曲線でつなぐ。
const PROFILE = [
  [44, 284], [46, 276], [47, 269], [42, 263], [38, 256], [35, 249], [34, 243], [29, 238], [30, 233],
  [37, 229], [31, 226], [26, 222], [28, 216], [31, 211], [28, 206], [19, 202], [16, 197], [18, 192],
  [27, 185], [34, 178], [36, 171], [38, 152], [40, 132], [42, 116], [47, 95], [56, 76], [70, 58],
  [93, 40], [122, 29], [155, 25], [188, 28], [221, 39], [252, 60], [270, 86], [278, 108], [280, 129],
  [279, 150], [273, 172], [265, 190], [256, 205], [246, 217], [236, 230], [230, 243], [229, 256], [232, 272], [235, 293],
]

// 首の下は直線で閉じる。前側に 1 段の切り欠きがある。
const BASE = [[113, 293], [112, 284]]

// 脳。後頭部側が広く、額側は斜めに切れた豆形。範囲はおよそ (57,37)–(263,193)。
const BRAIN = [
  [160, 37], [198, 41], [230, 56], [251, 82], [262, 116], [261, 150], [250, 174], [230, 188], [203, 193],
  [175, 191], [148, 182], [123, 170], [100, 156], [78, 140], [62, 122], [57, 103], [62, 83], [76, 63], [98, 47], [128, 38],
]

/** Catmull-Rom で点列をなめらかにつなぐ。closed でなければ両端は折り返さない。 */
function spline(points, { closed = false, steps = 6 } = {}) {
  const n = points.length
  const at = (i) => (closed ? points[(i + n) % n] : points[Math.min(n - 1, Math.max(0, i))])
  const out = []
  const last = closed ? n : n - 1
  for (let i = 0; i < last; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      const t2 = t * t
      const t3 = t2 * t
      out.push([0, 1].map((k) =>
        0.5 * (2 * p1[k] + (p2[k] - p0[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t3),
      ))
    }
  }
  if (!closed) out.push(points[n - 1])
  return out
}

export const HEAD_OUTLINE = [...spline(PROFILE), ...BASE]
export const BRAIN_OUTLINE = spline(BRAIN, { closed: true })

export function inside(polygon, x, y) {
  let hit = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/** 再現できる乱数（mulberry32）。セルのずれを毎回同じにする。 */
export function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const GLYPH = 14
const PITCH_X = 19
const PITCH_Y = 15.5
const JITTER = 1.5

/**
 * 字を置くセルの中心座標。本家と同じく 14px の字を約 20px 間隔で並べ、行ごとに半字ずらし、1〜2px 揺らす。
 * 字の四隅が脳の中に収まるセルだけを残す。
 */
export function buildCells() {
  const random = seeded(2007)
  const half = GLYPH / 2
  const cells = []
  let row = 0
  for (let y = 37 + half; y < 196; y += PITCH_Y, row++) {
    for (let x = 57 + half + (row % 2 ? PITCH_X / 2 : 0); x < 266; x += PITCH_X) {
      const cx = x + (random() * 2 - 1) * JITTER
      const cy = y + (random() * 2 - 1) * JITTER
      const corners = [[-half, -half], [half, -half], [-half, half], [half, half]]
      if (corners.every(([dx, dy]) => inside(BRAIN_OUTLINE, cx + dx * 0.7, cy + dy * 0.7))) cells.push({ x: cx, y: cy })
    }
  }
  return cells
}

export const CELLS = buildCells()
