// 脳内に出る字の閉じた集合。Jev にはこの中での構成比だけを答えさせる。DOM に依存しない。
//
// 字の出典（本家「脳内メーカー」maker.usoko.net/nounai で出る字の報告）:
//   - 1〜40: https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q1412303824 （40 種類）
//            https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q1231217632 の 1〜40 と一致。
//            作者も「文字の種類は 40 ある」と答えている https://www.j-cast.com/2007/08/07010083.html?p=all
//   - 41〜53: q1231217632 の 41〜53。金は本家の生成画像でも字形を確かめた。
// 「働」「夢」は本家のどの一覧にも出てこないので入れていない。
//
// 色は 1 字 1 色で固定（本家と同じ）。measured が true のものは本家の生成画像から測った値、
// false のものは本家画像にあった未同定の色と、字の意味からの連想で決めた推定。
// 推定の色は、脳の背景（brain.js の COLORS.brain）とのコントラスト比が 2 前後になるよう明るさを調整してある。
//
// id は Jev に渡す選択肢のキー、criteria はその説明（英語）。

export const KANJI = [
  { id: 'love', glyph: '愛', color: '#ff9eb3', measured: true, criteria: '愛 (love): romance, affection, a partner or someone they care about deeply.' },
  { id: 'desire', glyph: '欲', color: '#6835ff', measured: true, criteria: '欲 (desire): wanting things, cravings to own or get something, greed, ambition.' },
  { id: 'evil', glyph: '悪', color: '#000000', measured: true, criteria: '悪 (evil): malice, scheming, wanting to do something bad or get back at someone.' },
  { id: 'play', glyph: '遊', color: '#ab6a00', measured: false, criteria: '遊 (play): games, going out, hobbies, wanting to have fun instead of working.' },
  { id: 'lewd', glyph: 'Ｈ', color: '#ff25f5', measured: true, criteria: 'Ｈ (naughty): flirty or sexual thoughts, innuendo.' },
  { id: 'secret', glyph: '秘', color: '#570091', measured: false, criteria: '秘 (secret): hiding something, things they do not want others to know.' },
  { id: 'food', glyph: '食', color: '#b5e600', measured: true, criteria: '食 (food): hunger, meals, restaurants, cooking, anything about eating.' },
  { id: 'friend', glyph: '友', color: '#86ffeb', measured: false, criteria: '友 (friends): friends, colleagues they like, hanging out together, companionship.' },
  { id: 'worry', glyph: '悩', color: '#004891', measured: false, criteria: '悩 (worry): being troubled, anxious, unable to decide, problems weighing on them.' },
  { id: 'rest', glyph: '休', color: '#f7f7f7', measured: true, criteria: '休 (rest): wanting a break, a day off, a holiday, to stop working.' },
  { id: 'lie', glyph: '嘘', color: '#ff0000', measured: true, criteria: '嘘 (lies): lying, excuses, bluffing, saying what they do not mean.' },
  { id: 'home', glyph: '家', color: '#cff4ff', measured: true, criteria: '家 (home): family, parents, children, housework, their house, wanting to go home.' },
  { id: 'delusion', glyph: '妄', color: '#be00be', measured: false, criteria: '妄 (fantasy): daydreams, wild imagination, unrealistic what-ifs.' },
  { id: 'thought', glyph: '想', color: '#ffff7a', measured: false, criteria: '想 (thinking): ideas, plans, reflecting, thinking something through.' },
  { id: 'mind', glyph: '気', color: '#d8ffd0', measured: false, criteria: '気 (concern): caring what others think, being considerate, something nagging at them.' },
  { id: 'nothing', glyph: '無', color: '#ebebeb', measured: false, criteria: '無 (nothing): an empty mind, spacing out, filler words, nothing in particular.' },
  { id: 'fear', glyph: '恐', color: '#0035aa', measured: false, criteria: '恐 (fear): being scared, dread, horror, something frightening.' },
  { id: 'respect', glyph: '敬', color: '#ffe9a8', measured: false, criteria: '敬 (respect): admiration, gratitude, looking up to someone.' },
  { id: 'like', glyph: '好', color: '#cc0077', measured: false, criteria: '好 (liking): favorite things, fandom, a crush, enthusiasm for something they like.' },
  { id: 'escape', glyph: '逃', color: '#4949ff', measured: false, criteria: '逃 (escape): wanting to run away, avoiding a task, procrastinating, quitting.' },
  { id: 'anger', glyph: '怒', color: '#d70015', measured: false, criteria: '怒 (anger): irritation, complaints, being mad at someone or something.' },
  { id: 'hug', glyph: '抱', color: '#ffd8ce', measured: false, criteria: '抱 (embrace): wanting to hold or be held, physical closeness, cuddling.' },
  { id: 'lonely', glyph: '寂', color: '#d7e1ff', measured: false, criteria: '寂 (lonely): loneliness, missing someone, feeling left out.' },
  { id: 'fun', glyph: '楽', color: '#ffd84a', measured: false, criteria: '楽 (fun): enjoying themselves, music, taking it easy, excitement.' },
  { id: 'dislike', glyph: '嫌', color: '#854200', measured: false, criteria: '嫌 (dislike): hating something, reluctance, not wanting to do it.' },
  { id: 'pain', glyph: '苦', color: '#551600', measured: false, criteria: '苦 (suffering): hardship, physical pain, a hard time, struggling.' },
  { id: 'captive', glyph: '虜', color: '#b60068', measured: false, criteria: '虜 (hooked): obsessed, addicted, unable to stop thinking about one thing.' },
  { id: 'doubt', glyph: '疑', color: '#95009d', measured: false, criteria: '疑 (doubt): suspicion, distrust, questioning whether something is true.' },
  { id: 'confess', glyph: '告', color: '#d50043', measured: false, criteria: '告 (confession): wanting to tell someone something important, announcing, confessing feelings.' },
  { id: 'tired', glyph: '疲', color: '#e3e0f2', measured: false, criteria: '疲 (tired): exhaustion, overwork, being worn out.' },
  { id: 'forget', glyph: '忘', color: '#e8e8ff', measured: false, criteria: '忘 (forget): forgetting things, trying to remember, wanting to forget.' },
  { id: 'enemy', glyph: '敵', color: '#3a0000', measured: false, criteria: '敵 (enemy): rivals, competition, someone they are fighting against.' },
  { id: 'bait', glyph: '餌', color: '#8b6320', measured: false, criteria: '餌 (bait): being lured by a reward, temptations, feeding a pet.' },
  { id: 'study', glyph: '学', color: '#0033c2', measured: false, criteria: '学 (study): learning, school, exams, research, technical topics.' },
  { id: 'cry', glyph: '泣', color: '#b7e9ff', measured: false, criteria: '泣 (crying): sadness, tears, being moved, heartbreak.' },
  { id: 'envy', glyph: '羨', color: '#c1eead', measured: false, criteria: '羨 (envy): wishing they had what someone else has, "must be nice".' },
  { id: 'heal', glyph: '癒', color: '#b8ffc9', measured: false, criteria: '癒 (comfort): wanting to be soothed, relaxation, baths, cute things, healing.' },
  { id: 'happy', glyph: '幸', color: '#fff3a0', measured: false, criteria: '幸 (happiness): feeling happy, lucky, grateful, content.' },
  { id: 'jealous', glyph: '妬', color: '#006105', measured: false, criteria: '妬 (jealousy): resentment of a rival, possessiveness, bitterness at another\'s success.' },
  { id: 'weird', glyph: '変', color: '#9d0aff', measured: false, criteria: '変 (weird): odd ideas, strange behavior, nonsense, wanting change.' },
  { id: 'dog', glyph: '犬', color: '#f3dec1', measured: false, criteria: '犬 (dog): dogs, walking a dog, loyalty.' },
  { id: 'cat', glyph: '猫', color: '#f5f0e0', measured: false, criteria: '猫 (cat): cats, wanting to live like a cat.' },
  { id: 'self', glyph: '私', color: '#ffe0ec', measured: false, criteria: '私 (me): talking about themselves, self-image, pride, how they look.' },
  { id: 'nation', glyph: '国', color: '#d01a33', measured: false, criteria: '国 (nation): politics, society, the news, the country, the world.' },
  { id: 'sake', glyph: '酒', color: '#e1df3d', measured: true, criteria: '酒 (alcohol): drinking, beer, bars, wanting a drink, hangovers.' },
  { id: 'mystery', glyph: '謎', color: '#6948ff', measured: false, criteria: '謎 (mystery): puzzles, things they cannot figure out, curiosity about the unknown.' },
  { id: 'lust', glyph: '淫', color: '#d1007a', measured: false, criteria: '淫 (lust): explicit sexual desire, indulgence.' },
  { id: 'defeat', glyph: '負', color: '#30305a', measured: false, criteria: '負 (defeat): losing, failure, feeling inferior, debts, negative thinking.' },
  { id: 'money', glyph: '金', color: '#ffff00', measured: true, criteria: '金 (money): salary, prices, savings, investing, wanting to be rich, being broke.' },
  { id: 'sleep', glyph: '眠', color: '#d6e3ff', measured: false, criteria: '眠 (sleep): sleepiness, wanting to go to bed, lack of sleep.' },
  { id: 'lost', glyph: '迷', color: '#bee9e9', measured: false, criteria: '迷 (lost): hesitation between options, not knowing which way to go.' },
  { id: 'good', glyph: '善', color: '#ffffff', measured: false, criteria: '善 (good): kindness, helping others, doing the right thing.' },
  { id: 'art', glyph: '芸', color: '#a75100', measured: false, criteria: '芸 (art): performing, comedy, music, drawing, craft, showing off a skill.' },
]

export const IDS = KANJI.map((k) => k.id)
export const BY_ID = Object.fromEntries(KANJI.map((k) => [k.id, k]))
