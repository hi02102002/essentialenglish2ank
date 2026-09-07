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
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/&rsquo;|&lsquo;|&#39;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&ndash;|&mdash;/g, '-')
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

function resolveImageUrl(
  img: string | undefined,
  datasetUrl: string,
): string | undefined {
  if (!img) return undefined
  const trimmed = img.trim()
  if (!trimmed) return undefined
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  // Dead phantom filenames in essentialenglish dataset (e.g. 36178.jpg, 35900.jpg)
  // All purely numeric image filenames in wordlist return 404 Not Found on the server.
  if (/^\d+\.(?:jpe?g|png|webp|gif|svg)$/i.test(trimmed)) {
    return undefined
  }

  // Filter out speaker/audio icons or UI buttons
  if (/\b(?:icon|speaker|button|arrow|close|play)\b/i.test(trimmed)) {
    return undefined
  }

  try {
    const parsed = new URL(datasetUrl)
    const basePath = parsed.pathname.replace(/\/data\/data\.json$/i, '')
    return `${parsed.origin}${basePath}/${trimmed.replace(/^\/+/, '')}`
  } catch {
    return undefined
  }
}

export function extractPhrasesAndWords(
  unit: EssentialEnglishUnit,
  datasetUrl: string,
): {
  words: string[]
  phrases: string[]
  vocabularyList: ExtractedVocabulary[]
} {
  const wordsList: ExtractedVocabulary[] = []
  const phrasesList: ExtractedVocabulary[] = []
  const seen = new Set<string>()

  // 1. Process unit.wordlist
  for (const item of unit.wordlist ?? []) {
    const rawWord = cleanVocabularyItem(cleanHtmlText(item.en ?? ''))
    if (!rawWord || rawWord.length < 2) continue
    const lower = rawWord.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)

    const fullImageUrl = resolveImageUrl(item.image, datasetUrl)
    const isPhrase =
      rawWord.includes(' ') || rawWord.includes('-') || rawWord.startsWith('to ')

    const vocabItem: ExtractedVocabulary = {
      word: rawWord,
      hint: item.desc ? cleanHtmlText(item.desc) : undefined,
      pron: item.pron,
      desc: item.desc,
      exam: item.exam,
      image: fullImageUrl,
      kind: isPhrase ? 'phrase' : 'word',
    }

    if (isPhrase) {
      phrasesList.push(vocabItem)
    } else {
      wordsList.push(vocabItem)
    }
  }

  // 2. Process unit.reading[0].story
  const story = unit.reading?.[0]?.story ?? ''
  if (story) {
    // A. Match list items with images and phrases, e.g. <li><img src="..."><br /><strong>shake hands with someone</strong></li>
    const liRegex =
      /<li>(?:\s*<img[^>]*src=["']([^"']+)["'][^>]*>)?(?:\s*<br\s*\/?>)?\s*(?:<strong>)?([^<]+)(?:<\/strong>)?(?:\s*\[([^\]]+)\])?\s*<\/li>/gi
    let liMatch: RegExpExecArray | null
    while ((liMatch = liRegex.exec(story)) !== null) {
      const imgSrc = liMatch[1]
      const text = cleanHtmlText(liMatch[2])
        .replace(/^[.,;:—–-]+\s*|\s*[.,;:—–-]+$/g, '')
        .trim()
      const hint = liMatch[3] ? cleanHtmlText(liMatch[3]) : undefined
      if (text && text.length > 2 && !/^(?:a|an|the)$/i.test(text)) {
        const fullImg = resolveImageUrl(imgSrc, datasetUrl)
        const lower = text.toLowerCase()
        const existing = phrasesList.find((p) => p.word.toLowerCase() === lower)
        if (existing) {
          if (!existing.image && fullImg) existing.image = fullImg
          if (!existing.hint && hint) existing.hint = hint
        } else {
          phrasesList.push({
            word: text,
            hint,
            image: fullImg,
            kind: text.includes(' ') ? 'phrase' : 'word',
          })
          seen.add(lower)
        }
      }
    }

    // B. Match <strong> tags followed by optional [hint] or (hint)
    const strongRegex =
      /<strong>([^<]+)<\/strong>(?:[\s.,;:—–-]*[\[\(]([^\]\)<]+)[\]\)])?/gi
    let sMatch: RegExpExecArray | null
    while ((sMatch = strongRegex.exec(story)) !== null) {
      const text = cleanHtmlText(sMatch[1])
        .replace(/^[.,;:—–-]+\s*|\s*[.,;:—–-]+$/g, '')
        .trim()
      const hint = sMatch[2] ? cleanHtmlText(sMatch[2]) : undefined
      if (
        !text ||
        text.length < 2 ||
        /^(?:a|an|the|in|out|on|at|to|of|for|and|or|not|n|v|adj|adv|noun|verb|adjective|adverb)$/i.test(
          text,
        ) ||
        text.includes('.jpg') ||
        text.includes('.png')
      ) {
        continue
      }

      const lower = text.toLowerCase()
      const existingPhrase = phrasesList.find(
        (p) => p.word.toLowerCase() === lower,
      )
      if (existingPhrase) {
        if (!existingPhrase.hint && hint) existingPhrase.hint = hint
        continue
      }

      const existingWord = wordsList.find((w) => w.word.toLowerCase() === lower)
      if (existingWord) {
        if (!existingWord.hint && hint) existingWord.hint = hint
        continue
      }

      seen.add(lower)
      if (text.includes(' ') || text.includes('-') || text.startsWith('to ')) {
        phrasesList.push({
          word: text,
          hint,
          kind: 'phrase',
        })
      } else {
        wordsList.push({
          word: text,
          hint,
          kind: 'word',
        })
      }
    }
  }

  // Deduplicate and promote more complete phrases (e.g. "a heart of gold" over "heart of gold")
  const dedupedPhrases: ExtractedVocabulary[] = []
  const sortedPhrases = [...phrasesList].sort(
    (a, b) => b.word.length - a.word.length,
  )

  for (const item of sortedPhrases) {
    const textCore = item.word
      .toLowerCase()
      .replace(/^(?:to\s+(?:be\s+)?|a\s+|an\s+|the\s+|as\s+)/, '')
      .trim()
    const existing = dedupedPhrases.find((r) => {
      const rCore = r.word
        .toLowerCase()
        .replace(/^(?:to\s+(?:be\s+)?|a\s+|an\s+|the\s+|as\s+)/, '')
        .trim()
      return rCore === textCore || rCore.includes(textCore)
    })

    if (existing) {
      if (!existing.hint && item.hint) existing.hint = item.hint
      if (!existing.image && item.image) existing.image = item.image
      if (!existing.pron && item.pron) existing.pron = item.pron
    } else {
      dedupedPhrases.push(item)
    }
  }

  dedupedPhrases.sort((a, b) => a.word.localeCompare(b.word))
  wordsList.sort((a, b) => a.word.localeCompare(b.word))

  return {
    words: wordsList.map((w) => w.word),
    phrases: dedupedPhrases.map((p) => p.word),
    vocabularyList: [...wordsList, ...dedupedPhrases],
  }
}

export function extractNotes(
  unit: EssentialEnglishUnit,
  extractedPhrases: string[] = [],
): ExtractedNote[] {
  const notes: ExtractedNote[] = []
  const story = unit.reading?.[0]?.story
  if (!story) return notes

  const phraseSet = new Set(extractedPhrases.map((p) => p.toLowerCase()))
  const sectionParts = story.split(/<div class="section-rotate">/i)

  if (sectionParts.length > 1) {
    for (let i = 1; i < sectionParts.length; i++) {
      const part = sectionParts[i]
      const headerMatch = part.match(/<span>([^<]+)<\/span>/i)
      const rawTitle = headerMatch ? cleanHtmlText(headerMatch[1]) : `Section ${i}`

      const letterMatch = rawTitle.match(/^([A-Z])\s*‣/i)
      const sectionLetter = letterMatch ? letterMatch[1].toUpperCase() : undefined

      const rawLines = part
        .split(/<\/(?:p|li|div|h[1-6])>|<br\s*\/?>/i)
        .map((l) => cleanHtmlText(l))
        .filter(
          (l) =>
            l.length > 15 &&
            !l.includes('.jpg') &&
            !l.includes('.png') &&
            !l.includes('speaker_louder') &&
            !/^(?:positive|negative|noun|verb|adjective|adverb|examples?)$/i.test(l) &&
            !phraseSet.has(l.toLowerCase()),
        )

      // Only keep lines that are substantive (rules, tips, or full sentence explanations)
      const substantive = rawLines.filter((l) => l.split(/\s+/).length >= 5)

      if (substantive.length > 0) {
        notes.push({
          id: `note-sec-${i}`,
          title: rawTitle,
          sectionLetter,
          content: substantive.slice(0, 10),
          rawHtml: part,
        })
      }
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
    throw new Error(
      `Could not load vocabulary dataset from ${datasetUrl} (HTTP ${response.status})`,
    )
  }

  const dataset = (await response.json()) as EssentialEnglishDataset
  const unit = findUnit(dataset, unitNumber)

  if (!unit) {
    throw new Error(`Unit ${unitNumber} was not found in the vocabulary dataset`)
  }

  const { words, phrases, vocabularyList } = extractPhrasesAndWords(unit, datasetUrl)
  const notes = extractNotes(unit, phrases)

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
    phrases,
    vocabularyList,
    notes,
  }
}

