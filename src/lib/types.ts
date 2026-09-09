export type PresetBook = {
  slug: string
  title: string
  level: string
  totalUnits: number
}

export type ExtractedVocabulary = {
  word: string
  image?: string
  pron?: string
  desc?: string
  exam?: string
  kind?: 'word' | 'phrase'
  hint?: string
}

export type ExtractedNote = {
  id: string
  title: string
  sectionLetter?: string
  content: string[]
  rawHtml?: string
}

export type LessonAnalysis = {
  sourceUrl: string
  resolvedUrl: string
  bookSlug?: string
  bookTitle?: string
  unitNumber: number
  unitTitle: string
  title: string
  words: string[]
  phrases: string[]
  vocabularyList: ExtractedVocabulary[]
  notes: ExtractedNote[]
}

export type LexicalChunk = {
  text: string
  ipa?: string
  meaningVi: string
  englishDefinition?: string
  example?: string
  imageQuery?: string
  imageUrl?: string
  partOfSpeech?: string
  audioUrl?: string
  exampleAudioUrl?: string
}

export type VocabularyCard = {
  type: 'vocabulary'
  id: string
  selected: boolean
  unitNumber?: number
  kind?: 'word' | 'phrase'
  partOfSpeech?: string
  hint?: string
  word: string
  maskedWord?: string
  ipa: string
  vietnamese: string
  englishDefinition: string
  example: string
  chunks?: LexicalChunk[]
  imageQuery: string
  imageUrl: string
  wordAudioUrl: string
  exampleAudioUrl: string
  sourceUrl: string
}

export type NoteCard = {
  type: 'note'
  id: string
  selected: boolean
  unitNumber?: number
  title: string
  content: string[]
  vietnameseExplanation: string
  example: string
  exampleAudioUrl: string
  sourceUrl: string
}

export type AnyAnkiCard = VocabularyCard | NoteCard

export type GeneratedVocabulary = Pick<
  VocabularyCard,
  'word' | 'ipa' | 'vietnamese' | 'englishDefinition' | 'example' | 'imageQuery'
> & {
  partOfSpeech?: string
  chunks?: LexicalChunk[]
}

export type GeneratedNote = {
  title: string
  content: string[]
  vietnameseExplanation: string
  example: string
}

