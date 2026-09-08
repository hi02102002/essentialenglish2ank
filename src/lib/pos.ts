export interface PosInfo {
  code: string
  abbr: string
  labelVi: string
  labelEn: string
  badgeClass: string
  ankiClass: string
}

export const POS_DEFINITIONS: Record<string, PosInfo> = {
  adjective: {
    code: 'adjective',
    abbr: 'adj.',
    labelVi: 'Tính từ',
    labelEn: 'Adjective',
    badgeClass:
      'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10',
    ankiClass: 'anki-pos-adj',
  },
  adverb: {
    code: 'adverb',
    abbr: 'adv.',
    labelVi: 'Trạng từ',
    labelEn: 'Adverb',
    badgeClass:
      'border-teal-500/40 text-teal-600 dark:text-teal-400 bg-teal-500/10',
    ankiClass: 'anki-pos-adv',
  },
  noun: {
    code: 'noun',
    abbr: 'n.',
    labelVi: 'Danh từ',
    labelEn: 'Noun',
    badgeClass:
      'border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10',
    ankiClass: 'anki-pos-noun',
  },
  verb: {
    code: 'verb',
    abbr: 'v.',
    labelVi: 'Động từ',
    labelEn: 'Verb',
    badgeClass:
      'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    ankiClass: 'anki-pos-verb',
  },
  'phrasal verb': {
    code: 'phrasal verb',
    abbr: 'phr. v.',
    labelVi: 'Cụm động từ',
    labelEn: 'Phrasal Verb',
    badgeClass:
      'border-indigo-500/40 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10',
    ankiClass: 'anki-pos-phrv',
  },
  phrase: {
    code: 'phrase',
    abbr: 'phr.',
    labelVi: 'Cụm từ',
    labelEn: 'Phrase',
    badgeClass:
      'border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10',
    ankiClass: 'anki-pos-phrase',
  },
  idiom: {
    code: 'idiom',
    abbr: 'idiom',
    labelVi: 'Thành ngữ',
    labelEn: 'Idiom',
    badgeClass:
      'border-pink-500/40 text-pink-600 dark:text-pink-400 bg-pink-500/10',
    ankiClass: 'anki-pos-idiom',
  },
  preposition: {
    code: 'preposition',
    abbr: 'prep.',
    labelVi: 'Giới từ',
    labelEn: 'Preposition',
    badgeClass:
      'border-slate-500/40 text-slate-600 dark:text-slate-400 bg-slate-500/10',
    ankiClass: 'anki-pos-prep',
  },
  conjunction: {
    code: 'conjunction',
    abbr: 'conj.',
    labelVi: 'Liên từ',
    labelEn: 'Conjunction',
    badgeClass:
      'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10',
    ankiClass: 'anki-pos-conj',
  },
  pronoun: {
    code: 'pronoun',
    abbr: 'pron.',
    labelVi: 'Đại từ',
    labelEn: 'Pronoun',
    badgeClass:
      'border-cyan-500/40 text-cyan-600 dark:text-cyan-400 bg-cyan-500/10',
    ankiClass: 'anki-pos-pron',
  },
  interjection: {
    code: 'interjection',
    abbr: 'int.',
    labelVi: 'Thán từ',
    labelEn: 'Interjection',
    badgeClass:
      'border-orange-500/40 text-orange-600 dark:text-orange-400 bg-orange-500/10',
    ankiClass: 'anki-pos-int',
  },
}

export const QUICK_POS_OPTIONS = [
  { code: 'adjective', label: 'Tính từ (adj.)' },
  { code: 'adverb', label: 'Trạng từ (adv.)' },
  { code: 'noun', label: 'Danh từ (n.)' },
  { code: 'verb', label: 'Động từ (v.)' },
  { code: 'phrase', label: 'Cụm từ (phr.)' },
  { code: 'phrasal verb', label: 'Cụm động từ (phr. v.)' },
  { code: 'idiom', label: 'Thành ngữ (idiom)' },
  { code: 'preposition', label: 'Giới từ (prep.)' },
]

export function normalizePartOfSpeech(raw?: string): string {
  if (!raw) return ''
  const cleaned = raw.toLowerCase().trim()
  if (cleaned === 'adj' || cleaned === 'adj.' || cleaned.includes('adjective') || cleaned.includes('tính')) return 'adjective'
  if (cleaned === 'adv' || cleaned === 'adv.' || cleaned.includes('adverb') || cleaned.includes('trạng')) return 'adverb'
  if (cleaned.includes('phrasal verb') || cleaned.includes('phr. v') || cleaned.includes('cụm động')) return 'phrasal verb'
  if (cleaned === 'n' || cleaned === 'n.' || cleaned.includes('noun') || cleaned.includes('danh')) return 'noun'
  if (cleaned === 'v' || cleaned === 'v.' || cleaned.includes('verb') || cleaned.includes('động')) return 'verb'
  if (cleaned.includes('idiom') || cleaned.includes('thành ngữ')) return 'idiom'
  if (cleaned.includes('phrase') || cleaned.includes('cụm')) return 'phrase'
  if (cleaned.includes('prep') || cleaned.includes('giới')) return 'preposition'
  if (cleaned.includes('conj') || cleaned.includes('liên')) return 'conjunction'
  if (cleaned.includes('pron') || cleaned.includes('đại')) return 'pronoun'
  if (cleaned.includes('int') || cleaned.includes('thán')) return 'interjection'
  return cleaned
}

export function getPosInfo(raw?: string): PosInfo {
  const code = normalizePartOfSpeech(raw)
  if (POS_DEFINITIONS[code]) {
    return POS_DEFINITIONS[code]
  }
  return {
    code: code || 'other',
    abbr: code || '',
    labelVi: raw || 'Khác',
    labelEn: raw || 'Other',
    badgeClass: 'border-border/60 text-muted-foreground bg-muted/40',
    ankiClass: 'anki-pos-default',
  }
}
