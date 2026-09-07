export type LessonAnalysis = {
  sourceUrl: string
  resolvedUrl: string
  title: string
  words: string[]
}

export type VocabularyCard = {
  id: string
  selected: boolean
  word: string
  ipa: string
  vietnamese: string
  englishDefinition: string
  example: string
  imageQuery: string
  imageUrl: string
  wordAudioUrl: string
  exampleAudioUrl: string
  sourceUrl: string
}

export type GeneratedVocabulary = Pick<
  VocabularyCard,
  'word' | 'ipa' | 'vietnamese' | 'englishDefinition' | 'example' | 'imageQuery'
>
