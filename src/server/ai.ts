import { chat } from '@tanstack/ai'
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible'
import { z } from 'zod'
import type { GeneratedNote, GeneratedVocabulary } from '@/lib/types'
import { normalizePartOfSpeech } from '@/lib/pos'

export const LexicalChunkSchema = z.object({
  text: z
    .string()
    .describe(
      'Natural high-frequency English lexical chunk, collocation or fixed expression, e.g. "take advantage of", "feel exhausted"',
    ),
  ipa: z
    .string()
    .describe(
      'Standard General American (US) English IPA pronunciation for this chunk enclosed in slashes, e.g. /ˈteɪk ədˈvæn.tɪdʒ əv/',
    ),
  meaningVi: z
    .string()
    .describe('Concise Vietnamese meaning of this chunk, e.g. "tận dụng", "cảm thấy kiệt sức"'),
  englishDefinition: z
    .string()
    .describe('Concise English definition or explanation of how the chunk is used'),
  example: z
    .string()
    .describe('A natural example sentence using this specific chunk in General American English'),
  imageQuery: z
    .string()
    .describe('Safe, concrete visual search query without quotes illustrating this chunk'),
  partOfSpeech: z
    .string()
    .describe('Part of speech: phrase, phrasal verb, or idiom'),
})

export type LexicalChunk = z.infer<typeof LexicalChunkSchema>

export const FlashcardSchema = z.object({
  word: z.string().describe('The English vocabulary word or phrase'),
  ipa: z
    .string()
    .describe(
      'Standard General American (US) English IPA pronunciation enclosed in slashes, e.g. /ˈvɑːtʃər/, /ˈskedʒuːl/, /ˈwɔːtər/',
    ),
  vietnamese: z.string().describe('Vietnamese translation or concise meaning for learners'),
  englishDefinition: z.string().describe('Original concise English definition, do not copy textbook wording'),
  example: z.string().describe('Natural example sentence illustrating usage'),
  imageQuery: z.string().describe('Safe, concrete visual search query without quotes'),
  partOfSpeech: z
    .string()
    .describe(
      'Part of speech in English: noun, verb, adjective, adverb, phrase, phrasal verb, idiom, preposition, or conjunction',
    ),
  chunks: z
    .array(LexicalChunkSchema)
    .describe(
      '1 to 2 high-frequency lexical chunks or collocations using this word, each with its own US IPA, Vietnamese meaning, English definition, and example sentence',
    ),
})

export const FlashcardsOutputSchema = z.object({
  cards: z.array(FlashcardSchema).describe('List of flashcards matching the input words in exact order'),
})

export type FlashcardsOutput = z.infer<typeof FlashcardsOutputSchema>

function extractJson(text: string): string {
  let cleaned = text.trim()
  const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (match) {
    cleaned = match[1].trim()
  }
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1)
  }
  const firstBracket = cleaned.indexOf('[')
  const lastBracket = cleaned.lastIndexOf(']')
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return cleaned.slice(firstBracket, lastBracket + 1)
  }
  return cleaned
}

async function enrichVocabularyBatch(
  words: string[],
  adapter: any,
  systemPrompt: string,
): Promise<GeneratedVocabulary[]> {
  const userPrompt = `Create flashcards for each item, preserving exact item order. Return JSON {"cards": [...]}:\n${words
    .map((word, i) => `${i + 1}. ${word}`)
    .join('\n')}`

  let rawCards: z.infer<typeof FlashcardSchema>[] = []

  try {
    const res = await chat({
      adapter,
      systemPrompts: [systemPrompt],
      messages: [{ role: 'user', content: userPrompt }],
      outputSchema: FlashcardsOutputSchema,
    })
    rawCards = res.cards || []
  } catch (err: any) {
    if (err?.status === 401 || err?.message?.includes('401')) {
      throw new Error(
        `OpenAI API returned 401 Unauthorized. Please verify your OPENAI_API_KEY and OPENAI_URL in .env. Details: ${err?.message || err}`,
      )
    }
    if (err?.status === 502 || err?.message?.includes('502')) {
      throw new Error(
        `OpenAI API returned 502 Bad Gateway. Upstream message: ${err?.message || err}`,
      )
    }

    try {
      const textOutput = await chat({
        adapter,
        systemPrompts: [systemPrompt],
        messages: [{ role: 'user', content: userPrompt }],
        stream: false,
      })
      const cleaned = extractJson(textOutput)
      const parsed = JSON.parse(cleaned)
      const validated = FlashcardsOutputSchema.parse(
        Array.isArray(parsed) ? { cards: parsed } : parsed,
      )
      rawCards = validated.cards
    } catch (fallbackErr: any) {
      throw new Error(
        `Failed to generate vocabulary using TanStack AI: ${err?.message || fallbackErr?.message || err}`,
      )
    }
  }

  return words.map((origWord, index) => {
    const item = rawCards[index]
    const word = String(item?.word || origWord || '').trim()
    const rawPos = item?.partOfSpeech ? String(item.partOfSpeech).trim() : ''
    const defaultPos = word.includes(' ') ? 'phrase' : 'noun'
    const partOfSpeech = normalizePartOfSpeech(rawPos) || defaultPos

    const rawChunks = Array.isArray(item?.chunks) ? item.chunks : []
    const chunks = rawChunks
      .filter((c: any) => c && (typeof c === 'string' ? c.trim() : c.text?.trim()))
      .map((c: any) => {
        if (typeof c === 'string') {
          return {
            text: c.trim(),
            ipa: '',
            meaningVi: '',
            englishDefinition: '',
            example: '',
            imageQuery: c.trim(),
            partOfSpeech: 'phrase',
          }
        }
        const text = String(c.text || '').trim()
        const rawPos = c.partOfSpeech ? String(c.partOfSpeech).trim() : 'phrase'
        return {
          text,
          ipa: String(c.ipa || '').trim(),
          meaningVi: String(c.meaningVi || '').trim(),
          englishDefinition: String(c.englishDefinition || '').trim(),
          example: String(c.example || '').trim(),
          imageQuery: String(c.imageQuery || text).trim(),
          partOfSpeech: normalizePartOfSpeech(rawPos) || 'phrase',
        }
      })

    return {
      word,
      ipa: String(item?.ipa || '').trim(),
      vietnamese: String(item?.vietnamese || '').trim(),
      englishDefinition: String(item?.englishDefinition || '').trim(),
      example: String(item?.example || '').trim(),
      imageQuery: String(item?.imageQuery || item?.word || origWord || '').trim(),
      partOfSpeech,
      chunks,
    }
  })
}

export async function enrichVocabulary(words: string[]): Promise<GeneratedVocabulary[]> {
  if (!words.length) return []

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing. Copy .env.example to .env and add your key.')
  }

  const baseURL =
    process.env.OPENAI_BASE_URL || process.env.OPENAI_URL || 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL || 'gpt-5-6'

  const adapter = openaiCompatibleText(model, {
    baseURL,
    apiKey,
  })

  const systemPrompt =
    'You create beginner/intermediate English vocabulary flashcards for Vietnamese learners. Write original concise definitions and examples; do not copy textbook wording. Preserve phrasal expressions and idioms exactly. IPA should strictly be standard General American (US) English IPA transcription (e.g. rhotic /r/, American vowel conventions like /æ/, /ɑː/, /oʊ/, flap /t/ where common, e.g. /ˈwɑːtər/). Image queries should describe a concrete, safe, easy-to-recognize visual and contain no quotation marks. For each word or phrase, accurately classify its part of speech (partOfSpeech: noun, verb, adjective, adverb, phrase, phrasal verb, idiom, preposition, or conjunction). For each word or phrase, provide 1 to 2 high-frequency lexical chunks or collocations (chunks: [{"text": string, "ipa": string, "meaningVi": string, "englishDefinition": string, "example": string, "imageQuery": string, "partOfSpeech": string}]) showing how native speakers naturally use this word in full phrases (e.g. for "advantage": [{"text": "take advantage of", "ipa": "/teɪk ədˈvæn.tɪdʒ əv/", "meaningVi": "tận dụng, lợi dụng", "englishDefinition": "to make good use of an opportunity", "example": "She took advantage of the sunny day to wash her clothes.", "imageQuery": "person hanging laundry sunny day", "partOfSpeech": "phrase"}]). Each chunk MUST have its own accurate General American US IPA, Vietnamese translation, concise English definition, a natural example sentence demonstrating that chunk, and a safe concrete visual imageQuery.\n\nYou MUST return ONLY valid JSON matching this exact JSON schema: {"cards": [{"word": string, "ipa": string, "vietnamese": string, "englishDefinition": string, "example": string, "imageQuery": string, "partOfSpeech": string, "chunks": [{"text": string, "ipa": string, "meaningVi": string, "englishDefinition": string, "example": string, "imageQuery": string, "partOfSpeech": string}]}]}. Do not omit any key. Do not output markdown code fences or explanatory text.'

  const BATCH_SIZE = 6
  const batches: string[][] = []
  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    batches.push(words.slice(i, i + BATCH_SIZE))
  }

  const results = await Promise.all(
    batches.map((batch) => enrichVocabularyBatch(batch, adapter, systemPrompt)),
  )

  return results.flat()
}

export const NoteSchema = z.object({
  title: z.string().describe('Clear topic title for this note or rule, e.g. "Body movement expressions"'),
  content: z.array(z.string()).describe('List of key expressions, phrases, or bullet rules'),
  vietnameseExplanation: z.string().describe('Concise explanation in Vietnamese of usage and meaning for learners'),
  example: z.string().describe('A natural, practical example sentence demonstrating the usage in context'),
})

export const NotesOutputSchema = z.object({
  notes: z.array(NoteSchema).describe('List of enriched language notes matching the input items'),
})

export async function enrichNotes(
  rawNotes: Array<{ title: string; content: string[] }>,
): Promise<GeneratedNote[]> {
  if (!rawNotes.length) return []

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing. Copy .env.example to .env and add your key.')
  }

  const baseURL = process.env.OPENAI_BASE_URL || process.env.OPENAI_URL || 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL || 'gpt-5-6'

  const adapter = openaiCompatibleText(model, {
    baseURL,
    apiKey,
  })

  const systemPrompt =
    'You create high-yield language study notes from English textbook sections for Vietnamese learners. For each section, summarize the key expressions, collocations, or grammar rules into clean bullet items. Provide a clear, concise Vietnamese explanation (vietnameseExplanation) explaining when and how to use them. Provide a realistic, memorable example sentence (example) in English showing these phrases in context.\n\nYou MUST return ONLY valid JSON matching this exact JSON schema: {"notes": [{"title": string, "content": string[], "vietnameseExplanation": string, "example": string}]}. Do not omit any key. Do not output markdown code fences or explanatory text.'

  const userPrompt = `Enrich the following ${rawNotes.length} language notes for Vietnamese learners. Return JSON {"notes": [...]}:\n${rawNotes
    .map(
      (n, i) =>
        `### Note ${i + 1}: ${n.title}\nRaw content:\n${n.content.map((c) => `- ${c}`).join('\n')}`,
    )
    .join('\n\n')}`

  let rawOutputNotes: z.infer<typeof NoteSchema>[] = []

  try {
    const res = await chat({
      adapter,
      systemPrompts: [systemPrompt],
      messages: [{ role: 'user', content: userPrompt }],
      outputSchema: NotesOutputSchema,
    })
    rawOutputNotes = res.notes || []
  } catch (err: any) {
    try {
      const textOutput = await chat({
        adapter,
        systemPrompts: [systemPrompt],
        messages: [{ role: 'user', content: userPrompt }],
        stream: false,
      })
      const cleaned = extractJson(textOutput)
      const parsed = JSON.parse(cleaned)
      const validated = NotesOutputSchema.parse(
        Array.isArray(parsed) ? { notes: parsed } : parsed,
      )
      rawOutputNotes = validated.notes
    } catch (fallbackErr: any) {
      throw new Error(
        `Failed to enrich notes using TanStack AI: ${err?.message || fallbackErr?.message || err}`,
      )
    }
  }

  return rawNotes.map((orig, index) => {
    const generated = rawOutputNotes[index]
    return {
      title: String(generated?.title || orig.title).trim(),
      content: Array.isArray(generated?.content) && generated.content.length > 0
        ? generated.content.map((c) => String(c).trim())
        : orig.content,
      vietnameseExplanation: String(generated?.vietnameseExplanation || '').trim(),
      example: String(generated?.example || orig.content[0] || '').trim(),
    }
  })
}

export const StandaloneChunkSchema = z.object({
  word: z
    .string()
    .describe('The lexical chunk or expression, e.g. "take advantage of", "breathe in and out"'),
  ipa: z.string().describe('Standard General American (US) IPA pronunciation'),
  vietnamese: z.string().describe('Vietnamese translation or meaning'),
  englishDefinition: z.string().describe('Concise English definition'),
  example: z.string().describe('Natural example sentence using this chunk in American English'),
  imageQuery: z.string().describe('Safe, concrete visual search query'),
  partOfSpeech: z.string().describe('Part of speech, e.g. "phrase", "phrasal verb", or "idiom"'),
})

export const StandaloneChunksOutputSchema = z.object({
  cards: z.array(StandaloneChunkSchema).describe('List of extracted/generated lexical chunk flashcards'),
})

export async function generateLessonChunks(
  words: string[],
  storyText?: string,
): Promise<GeneratedVocabulary[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing. Copy .env.example to .env and add your key.')
  }

  const baseURL =
    process.env.OPENAI_BASE_URL || process.env.OPENAI_URL || 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL || 'gpt-5-6'

  const adapter = openaiCompatibleText(model, {
    baseURL,
    apiKey,
  })

  const systemPrompt =
    'You are an expert English teacher specialized in Lexical Chunking methodology. From the provided vocabulary list and optional context, generate 6 to 12 high-yield, natural Lexical Chunks (collocations, phrasal verbs, common conversational phrases, or fixed expressions). Each chunk must be a natural multi-word unit that native speakers use as a single piece (e.g. "take advantage of something", "breathe in and out", "online learning has advantages", "make a quick decision", "at the end of the day"). For each chunk, provide: word (the chunk string), accurate General American US IPA, Vietnamese meaning, concise English definition, natural example sentence in US English, safe concrete imageQuery, and partOfSpeech (e.g. "phrase", "phrasal verb", or "idiom").\n\nYou MUST return ONLY valid JSON matching this exact JSON schema: {"cards": [{"word": string, "ipa": string, "vietnamese": string, "englishDefinition": string, "example": string, "imageQuery": string, "partOfSpeech": string}]}. Do not omit any key. Do not output markdown code fences or explanatory text.'

  const userPrompt = `Generate lexical chunks based on this vocabulary and context:
Vocabulary words:
${words.slice(0, 40).join(', ')}

${storyText ? `Context/Reading text:\n${storyText.slice(0, 1500)}` : ''}`

  let rawCards: z.infer<typeof StandaloneChunkSchema>[] = []

  try {
    const res = await chat({
      adapter,
      systemPrompts: [systemPrompt],
      messages: [{ role: 'user', content: userPrompt }],
      outputSchema: StandaloneChunksOutputSchema,
    })
    rawCards = res.cards || []
  } catch (err: any) {
    try {
      const textOutput = await chat({
        adapter,
        systemPrompts: [systemPrompt],
        messages: [{ role: 'user', content: userPrompt }],
        stream: false,
      })
      const cleaned = extractJson(textOutput)
      const parsed = JSON.parse(cleaned)
      const validated = StandaloneChunksOutputSchema.parse(
        Array.isArray(parsed) ? { cards: parsed } : parsed,
      )
      rawCards = validated.cards
    } catch (fallbackErr: any) {
      throw new Error(
        `Failed to generate chunks using TanStack AI: ${err?.message || fallbackErr?.message || err}`,
      )
    }
  }

  return rawCards.map((item) => ({
    word: String(item.word || '').trim(),
    ipa: String(item.ipa || '').trim(),
    vietnamese: String(item.vietnamese || '').trim(),
    englishDefinition: String(item.englishDefinition || '').trim(),
    example: String(item.example || '').trim(),
    imageQuery: String(item.imageQuery || item.word || '').trim(),
    partOfSpeech: normalizePartOfSpeech(item.partOfSpeech) || 'phrase',
  }))
}

