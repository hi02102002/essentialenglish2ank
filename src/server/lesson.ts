import type { LessonAnalysis } from '@/lib/types'

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim()

function cleanVocabularyItem(value: string) {
  return normalizeText(value)
    // The dataset sometimes appends a bare part-of-speech marker, e.g. "smile   v".
    .replace(/\s+(?:n|v|adj|adv)\.?$/i, '')
    .trim()
}

type EssentialEnglishWord = {
  en?: string
  pron?: string
  desc?: string
  exam?: string
  image?: string
  sound?: string
}

type EssentialEnglishUnit = {
  en?: string
  image?: string
  wordlist?: EssentialEnglishWord[]
}

type EssentialEnglishDataset = {
  flashcard?: EssentialEnglishUnit[]
}

type LessonTarget = {
  unitNumber: number
  datasetUrl: string
}

function parseLessonTarget(sourceUrl: string): LessonTarget {
  const url = new URL(sourceUrl)

  // Normal lesson URL:
  // /apps/<book>/unit-9-the-body-and-movement
  const lessonMatch = url.pathname.match(/^\/apps\/([^/]+)\/unit-(\d+)(?:-|\/|$)/i)
  if (lessonMatch) {
    const [, bookSlug, unit] = lessonMatch
    return {
      unitNumber: Number(unit),
      datasetUrl: `${url.origin}/apps-data/${bookSlug}/data/data.json`,
    }
  }

  // Readable/demo lesson URL:
  // /book/<book>/unit-9-the-body-and-movement
  const bookMatch = url.pathname.match(/^\/book\/([^/]+)\/unit-(\d+)(?:-|\/|$)/i)
  if (bookMatch) {
    const [, bookSlug, unit] = bookMatch
    return {
      unitNumber: Number(unit),
      datasetUrl: `https://www.essentialenglish.review/apps-data/${bookSlug}/data/data.json`,
    }
  }

  throw new Error('Could not determine the unit number from this lesson URL')
}

function findUnit(dataset: EssentialEnglishDataset, unitNumber: number) {
  const units = Array.isArray(dataset.flashcard) ? dataset.flashcard : []
  const prefix = new RegExp(`^Unit\\s+${unitNumber}\\s*:`, 'i')
  return units.find((unit) => prefix.test(normalizeText(unit.en ?? '')))
}

export async function analyzeLessonUrl(sourceUrl: string): Promise<LessonAnalysis> {
  const { unitNumber, datasetUrl } = parseLessonTarget(sourceUrl)

  const response = await fetch(datasetUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 AnkiDeckBuilder/1.0',
      accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`Could not load vocabulary dataset (HTTP ${response.status})`)
  }

  const dataset = (await response.json()) as EssentialEnglishDataset
  const unit = findUnit(dataset, unitNumber)

  if (!unit) {
    throw new Error(`Unit ${unitNumber} was not found in the vocabulary dataset`)
  }

  const words = [...new Set(
    (unit.wordlist ?? [])
      .map((item) => cleanVocabularyItem(item.en ?? ''))
      .filter(Boolean),
  )]

  if (!words.length) {
    throw new Error(`Unit ${unitNumber} does not contain a word list`)
  }

  return {
    sourceUrl,
    resolvedUrl: datasetUrl,
    title: normalizeText(unit.en ?? `Unit ${unitNumber}`),
    words,
  }
}
