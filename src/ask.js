// Jev への聞き方と、返ってきた答えの読み方。DOM に依存しない。
// Jev に送る文字列は英語、字幕（transcript）は日本語のまま渡す。Jev は日本語の字幕をそのまま読める（sim/probe.js で確認）。

import { IDS, KANJI } from './kanji.js'

const TASK =
  'A person is talking out loud in Japanese, and this is a live transcript of their speech. ' +
  'From what they are saying right now, estimate what their mind is made of, as in the Japanese "brain maker" joke diagram: ' +
  'a head filled with kanji, each kanji standing for one thought, feeling or desire. ' +
  'Judge the speaker\'s own state of mind from the topic and the tone, not the literal characters in the text. ' +
  'The transcript has three parts: "speaking_now" is the sentence still being spoken, "latest" is the sentence they just finished, ' +
  'and "earlier" is what they said before that. The mind follows the newest speech: weigh "speaking_now" and "latest" heavily, ' +
  'and use "earlier" only as background.'

export function buildState({ earlier = '', latest = '', speakingNow = '' }) {
  return {
    task: TASK,
    transcript: {
      earlier: earlier || '(nothing)',
      latest: latest || '(nothing yet)',
      speaking_now: speakingNow || '(silent)',
    },
  }
}

const TOO_THIN = {
  type: 'noul',
  instructions: 'Is the transcript too short or too empty to judge what is on the speaker\'s mind?',
}

/** 主役の字を決める問い。53 字の中での分布が返る。1 字に強く寄る（実測で 0.6〜0.98）。 */
export function choiceQuestions() {
  return {
    brain: {
      type: 'choice',
      instructions: "Which single thought occupies this speaker's mind the most right now?",
      criteria: Object.fromEntries(KANJI.map((k) => [k.id, k.criteria])),
    },
    too_thin: TOO_THIN,
  }
}

/** 脇役の字を拾う問い。字ごとに Yes/No を聞く。choice では 0 に潰れる字（眠い話の「休」「癒」など）がここで出る。 */
export function noulQuestions() {
  const questions = { too_thin: TOO_THIN }
  for (const k of KANJI) {
    questions[k.id] = { type: 'noul', instructions: `Is this on the speaker's mind right now? ${k.criteria}` }
  }
  return questions
}

/** 実際に送る問い。両方を 1 リクエストに入れる。Jev は全質問を並列に評価するので、応答時間はほぼ変わらない。 */
export function buildQuestions() {
  return { ...noulQuestions(), ...choiceQuestions() }
}

export function normalize(dist) {
  const total = IDS.reduce((s, id) => s + Math.max(0, Number(dist?.[id]) || 0), 0)
  if (!(total > 0)) return uniform()
  return Object.fromEntries(IDS.map((id) => [id, Math.max(0, Number(dist?.[id]) || 0) / total]))
}

export function uniform() {
  return Object.fromEntries(IDS.map((id) => [id, 1 / IDS.length]))
}

// noul は無関係な字でも 0.03〜0.3 が返るので、そのまま正規化すると 53 字に薄く散ってしまう。
// 4 乗して差を広げると、0.9 台の字が 3 割前後、0.5 台の字が数 %、それ以下はほぼ消える。
const SHARPEN = 4
const CHOICE_WEIGHT = 0.5

/**
 * Jev の答えを構成比にする。
 *   choice: brain の分布（主役）   nouls: 字ごとの Yes 確率（生の値）
 *   raw:    choice と、とがらせた noul を半々で混ぜた構成比   thin: 判断材料が乏しい確率
 * 片方の問いしか送っていない答え（sim/probe.js）でも読める。
 */
export function readAnswers(answers) {
  const thin = typeof answers?.too_thin?.noul === 'number' ? answers.too_thin.noul : 0
  const hasChoice = Boolean(answers?.brain?.probabilities)
  const hasNouls = IDS.some((id) => typeof answers?.[id]?.noul === 'number')
  const choice = hasChoice ? normalize(answers.brain.probabilities) : null
  const nouls = hasNouls ? Object.fromEntries(IDS.map((id) => [id, Number(answers[id]?.noul) || 0])) : null
  const sharp = hasNouls ? normalize(Object.fromEntries(IDS.map((id) => [id, nouls[id] ** SHARPEN]))) : null

  let raw
  if (choice && sharp) raw = normalize(Object.fromEntries(IDS.map((id) => [id, CHOICE_WEIGHT * choice[id] + (1 - CHOICE_WEIGHT) * sharp[id]])))
  else raw = choice ?? sharp ?? uniform()
  return { raw, choice, nouls, thin }
}

export function top(dist, n = 5) {
  return IDS.map((id) => [id, dist[id]])
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
}
