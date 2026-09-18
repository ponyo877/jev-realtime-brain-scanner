// 脳内の描画（p5.js）。300×340 の論理座標で描き、拡大して見せる。p5 は index.html の <script> で読み込む。

import { BRAIN_OUTLINE, CELLS, COLORS, GLYPH, HEAD_OUTLINE, HEIGHT, WIDTH } from './brain.js'
import { BY_ID } from './kanji.js'

const SCALE = 1.5
const FADE_MS = 300
const FONT = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif'

// 明るい色の字は、薄い背景の上では溶けてしまう。そういう字にだけ、字幕のような濃い縁取りを付ける。
// 本家から測った字の色（金の黄、愛のピンクなど）を変えずに読めるようにするため。濃い色の字は縁取りなしで読める。
const HALO = '#3a2626'
const HALO_WEIGHT = 1.8
const HALO_ABOVE = 0.25

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const NEEDS_HALO = Object.fromEntries(Object.values(BY_ID).map((k) => [k.id, luminance(k.color) > HALO_ABOVE]))

export function createSketch(parent) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // セルごとに、いまの字と、切り替え前の字と、切り替えた時刻を持つ
  const slots = CELLS.map(() => ({ id: null, from: null, changedAt: -Infinity }))
  let sketch = null

  function polygon(s, points) {
    s.beginShape()
    for (const [x, y] of points) s.vertex(x, y)
    s.endShape(s.CLOSE)
  }

  function glyph(s, id, x, y, alpha) {
    if (!id || alpha <= 0) return
    if (NEEDS_HALO[id]) {
      const halo = s.color(HALO)
      halo.setAlpha(200 * alpha)
      s.noFill()
      s.stroke(halo)
      s.strokeWeight(HALO_WEIGHT)
      s.strokeJoin(s.ROUND)
      s.text(BY_ID[id].glyph, x, y)
    }
    const color = s.color(BY_ID[id].color)
    color.setAlpha(255 * alpha)
    s.noStroke()
    s.fill(color)
    s.text(BY_ID[id].glyph, x, y)
  }

  new window.p5((s) => {
    sketch = s

    s.setup = () => {
      s.createCanvas(WIDTH * SCALE, HEIGHT * SCALE)
      s.noLoop()
    }

    s.draw = () => {
      const now = s.millis()
      s.scale(SCALE)
      s.background(COLORS.paper)

      s.stroke(COLORS.line)
      s.strokeWeight(1)
      s.fill(COLORS.skin)
      polygon(s, HEAD_OUTLINE)
      s.fill(COLORS.brain)
      polygon(s, BRAIN_OUTLINE)

      s.noStroke()
      s.textFont(FONT)
      s.textAlign(s.CENTER, s.CENTER)
      s.textSize(GLYPH)
      let moving = false
      slots.forEach((slot, i) => {
        const t = reduced ? 1 : Math.min(1, (now - slot.changedAt) / FADE_MS)
        if (t < 1) moving = true
        glyph(s, slot.from, CELLS[i].x, CELLS[i].y, 1 - t)
        glyph(s, slot.id, CELLS[i].x, CELLS[i].y, t)
      })

      // 画像の中のクレジット。本家と同じ位置に 2 行
      s.fill('#222222')
      s.textSize(11)
      s.text('リアルタイム脳内メーカー', WIDTH / 2, 315)
      s.textSize(9)
      s.text('非公式 / powered by Jev', WIDTH / 2, 329)

      s.noFill()
      s.stroke(COLORS.frame)
      s.strokeWeight(1)
      s.rect(0.5, 0.5, WIDTH - 1, HEIGHT - 1)

      // 切り替えの途中だけ描き続ける
      if (!moving) s.noLoop()
    }
  }, parent)

  return {
    /** owner はセルと同じ長さの id の配列（空の脳なら null の配列）。変わったセルだけ切り替える。 */
    setLayout(owner) {
      const now = sketch.millis()
      slots.forEach((slot, i) => {
        const id = owner[i] ?? null
        if (slot.id === id) return
        slot.from = slot.id
        slot.id = id
        slot.changedAt = now
      })
      sketch.loop()
    },
  }
}
