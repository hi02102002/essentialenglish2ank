import type {
  ExtractedNote,
  ExtractedVocabulary,
  LessonAnalysis,
  PresetBook,
} from '@/lib/types'

export const PRESET_BOOKS: PresetBook[] = [
  {
    slug: 'english-vocabulary-in-use-pre-intermediate-and-intermediate',
    title: 'English Vocabulary in Use: Pre-intermediate & Intermediate',
    level: 'B1-B2',
    totalUnits: 100,
  },
  {
    slug: 'english-vocabulary-in-use-upper-intermediate',
    title: 'English Vocabulary in Use: Upper-intermediate',
    level: 'B2',
    totalUnits: 100,
  },
  {
    slug: 'english-vocabulary-in-use-elementary',
    title: 'English Vocabulary in Use: Elementary',
    level: 'A1-A2',
    totalUnits: 60,
  },
  {
    slug: 'english-vocabulary-in-use-advanced',
    title: 'English Vocabulary in Use: Advanced',
    level: 'C1-C2',
    totalUnits: 100,
  },
]

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim()

export function cleanHtmlText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

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

type EssentialEnglishReading = {
  type?: string
  block?: string
  en?: string
  story?: string
  image?: string
  sound?: string
}

type EssentialEnglishUnit = {
  en?: string
  image?: string
  desc?: string
  reading?: EssentialEnglishReading[]
  wordlist?: EssentialEnglishWord[]
}

type EssentialEnglishDataset = {
  flashcard?: EssentialEnglishUnit[]
}

export type LessonTargetOptions = {
  url?: string
  bookSlug?: string
  unitNumber?: number
}

type ResolvedTarget = {
  unitNumber: number
  datasetUrl: string
  bookSlug?: string
  sourceUrl: string
}

export function parseLessonTarget(options: LessonTargetOptions | string): ResolvedTarget {
  const opts: LessonTargetOptions =
    typeof options === 'string' ? { url: options } : options

  // Case 1: bookSlug & unitNumber specified directly
  if (opts.bookSlug && opts.unitNumber) {
    return {
      unitNumber: opts.unitNumber,
      datasetUrl: `https://www.essentialenglish.review/apps-data/${opts.bookSlug}/data/data.json`,
      bookSlug: opts.bookSlug,
      sourceUrl: opts.url || `https://www.essentialenglish.review/apps/${opts.bookSlug}/unit-${opts.unitNumber}`,
    }
  }

  const rawUrl = opts.url?.trim()
  if (!rawUrl) {
    throw new Error('Please provide either a lesson URL or select a book and unit number.')
  }

  try {
    const parsed = new URL(rawUrl)

    // Direct JSON URL: /apps-data/<slug>/data/data.json
    const appsDataMatch = parsed.pathname.match(/\/apps-data\/([^/]+)\/data\/data\.json/i)
    if (appsDataMatch) {
      const bookSlug = appsDataMatch[1]
      const unitNum =
        opts.unitNumber ||
        Number(parsed.searchParams.get('unit')) ||
        (parsed.hash ? Number(parsed.hash.replace(/[^0-9]/g, '')) : undefined) ||
        1
      return {
        unitNumber: unitNum,
        datasetUrl: `${parsed.origin}${parsed.pathname}`,
        bookSlug,
        sourceUrl: rawUrl,
      }
    }

    // Normal lesson URL: /apps/<book>/unit-9-the-body-and-movement
    const lessonMatch = parsed.pathname.match(/^\/apps\/([^/]+)\/unit-(\d+)(?:-|\/|$)/i)
    if (lessonMatch) {
      const [, bookSlug, unit] = lessonMatch
      return {
        unitNumber: opts.unitNumber || Number(unit),
        datasetUrl: `${parsed.origin}/apps-data/${bookSlug}/data/data.json`,
        bookSlug,
        sourceUrl: rawUrl,
      }
    }

    // Book URL: /book/<book>/unit-9-the-body-and-movement
    const bookMatch = parsed.pathname.match(/^\/book\/([^/]+)\/unit-(\d+)(?:-|\/|$)/i)
    if (bookMatch) {
      const [, bookSlug, unit] = bookMatch
      return {
        unitNumber: opts.unitNumber || Number(unit),
        datasetUrl: `https://www.essentialenglish.review/apps-data/${bookSlug}/data/data.json`,
        bookSlug,
        sourceUrl: rawUrl,
      }
    }

    // Any URL with unit-(\d+) in path
    const genericUnitMatch = parsed.pathname.match(/unit-(\d+)/i)
    if (genericUnitMatch) {
      const unit = Number(genericUnitMatch[1])
      const bookSlug = opts.bookSlug || 'english-vocabulary-in-use-pre-intermediate-and-intermediate'
      return {
        unitNumber: opts.unitNumber || unit,
        datasetUrl: parsed.pathname.endsWith('.json')
          ? rawUrl
          : `https://www.essentialenglish.review/apps-data/${bookSlug}/data/data.json`,
        bookSlug,
        sourceUrl: rawUrl,
      }
    }

    // Generic JSON URL
    if (parsed.pathname.endsWith('.json')) {
      return {
        unitNumber: opts.unitNumber || 1,
        datasetUrl: rawUrl,
        bookSlug: opts.bookSlug,
        sourceUrl: rawUrl,
      }
    }
  } catch {
    // If rawUrl is not a valid full URL, test if it's a relative path or slug
  }

  // Fallback if unitNumber is available
  if (opts.unitNumber) {
    const bookSlug = opts.bookSlug || 'english-vocabulary-in-use-pre-intermediate-and-intermediate'
    return {
      unitNumber: opts.unitNumber,
      datasetUrl: `https://www.essentialenglish.review/apps-data/${bookSlug}/data/data.json`,
      bookSlug,
      sourceUrl: rawUrl,
    }
  }

  throw new Error('Could not determine the unit number or book from the provided input.')
}

function findUnit(dataset: EssentialEnglishDataset, unitNumber: number) {
  const units = Array.isArray(dataset.flashcard) ? dataset.flashcard : []
  const prefix = new RegExp(`^Unit\\s+${unitNumber}\\s*:`, 'i')
  const found = units.find((unit) => prefix.test(normalizeText(unit.en ?? '')))
  if (found) return found

  const prefixLoose = new RegExp(`^Unit\\s+${unitNumber}(?:\\s|$)`, 'i')
  const foundLoose = units.find((unit) => prefixLoose.test(normalizeText(unit.en ?? '')))
  if (foundLoose) return foundLoose

  if (unitNumber >= 1 && unitNumber <= units.length) {
    return units[unitNumber - 1]
  }

  return undefined
}

export function extractNotes(unit: EssentialEnglishUnit): ExtractedNote[] {
  const notes: ExtractedNote[] = []
  const story = unit.reading?.[0]?.story
  if (!story) return notes

  // Split by <div class="section-rotate"> which separates sections (A ‣ ..., B ‣ ...)
  const sectionParts = story.split(/<div class="section-rotate">/i)

  if (sectionParts.length > 1) {
    for (let i = 1; i < sectionParts.length; i++) {
      const part = sectionParts[i]
      const headerMatch = part.match(/<span>([^<]+)<\/span>/i)
      const rawTitle = headerMatch ? cleanHtmlText(headerMatch[1]) : `Section ${i}`

      // Extract section letter if available (e.g. "A" from "A ‣ Parts of the body")
      const letterMatch = rawTitle.match(/^([A-Z])\s*‣/i)
      const sectionLetter = letterMatch ? letterMatch[1].toUpperCase() : undefined

      // Split paragraphs, list items, and line breaks into atomic phrase entries
      const rawLines = part
        .split(/<\/(?:p|li|div|h[1-6])>|<br\s*\/?>/i)
        .map((l) => cleanHtmlText(l))
        .filter(
          (l) =>
            l.length > 3 &&
            !l.includes('.jpg') &&
            !l.includes('.png') &&
            !l.includes('speaker_louder') &&
            !/^(?:positive|negative|noun|verb|adjective|adverb|examples?)$/i.test(l),
        )

      const items: string[] = []
      for (const line of rawLines) {
        if (!items.includes(line)) {
          items.push(line)
        }
      }

      if (items.length > 0) {
        notes.push({
          id: `note-sec-${i}`,
          title: rawTitle,
          sectionLetter,
          content: items.slice(0, 15),
          rawHtml: part,
        })
      }
    }
  } else {
    // If no section-rotate, check for paragraphs and strong blocks
    const rawLines = story
      .split(/<\/(?:p|li|div)>|<br\s*\/?>/i)
      .map((l) => cleanHtmlText(l))
      .filter((l) => l.length > 3 && !l.includes('.jpg') && !l.includes('.png'))

    if (rawLines.length > 0) {
      notes.push({
        id: 'note-main',
        title: 'Key phrases & expressions',
        content: rawLines.slice(0, 15),
      })
    }
  }

  return notes
}

export async function analyzeLessonUrl(
  options: LessonTargetOptions | string,
): Promise<LessonAnalysis> {
  const { unitNumber, datasetUrl, bookSlug, sourceUrl } = parseLessonTarget(options)

  const response = await fetch(datasetUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 AnkiDeckBuilder/1.0',
      accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`Could not load vocabulary dataset from ${datasetUrl} (HTTP ${response.status})`)
  }

  const dataset = (await response.json()) as EssentialEnglishDataset
  const unit = findUnit(dataset, unitNumber)

  if (!unit) {
    throw new Error(`Unit ${unitNumber} was not found in the vocabulary dataset`)
  }

  const vocabularyList: ExtractedVocabulary[] = (unit.wordlist ?? [])
    .map((item) => ({
      word: cleanVocabularyItem(item.en ?? ''),
      image: item.image,
      pron: item.pron,
      desc: item.desc,
      exam: item.exam,
    }))
    .filter((v) => Boolean(v.word))

  const words = [...new Set(vocabularyList.map((v) => v.word))]

  const notes = extractNotes(unit)

  const rawUnitTitle = normalizeText(unit.en ?? `Unit ${unitNumber}`)
  const matchedBook = PRESET_BOOKS.find((b) => b.slug === bookSlug)
  const bookTitle = matchedBook?.title || 'English Vocabulary in Use'

  return {
    sourceUrl,
    resolvedUrl: datasetUrl,
    bookSlug,
    bookTitle,
    unitNumber,
    unitTitle: rawUnitTitle,
    title: rawUnitTitle,
    words,
    vocabularyList,
    notes,
  }
}

