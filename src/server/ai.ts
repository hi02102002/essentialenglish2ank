import { chat } from '@tanstack/ai'
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible'
import { z } from 'zod'
import type { GeneratedNote, GeneratedVocabulary } from '@/lib/types'
import { OPENAI_CLIENT_OPTIONS } from '@/server/ai-client-config'
import { normalizePartOfSpeech } from '@/lib/pos'
import { phraseContainsWord } from '@/lib/phrase-matcher'

export function getModelName(): string {
  const rawModel = (process.env.OPENAI_MODEL || 'gpt-5-6-mini').trim()
  // The user's reverse proxy has a 30s timeout that consistently fails on 'gpt-5-6'.
  // Auto-redirect 'gpt-5-6' to 'gpt-5-6-mini' to guarantee fast 5-8s responses.
  if (rawModel === 'gpt-5-6') {
    return 'gpt-5-6-mini'
  }
  return rawModel
}

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

export function extractAndParseJson(text: string): any {
  if (!text || !text.trim()) {
    throw new Error('Empty AI response')
  }

  let cleaned = text.trim()
  // 1. Try markdown code block if present
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i)
  if (codeBlockMatch && codeBlockMatch[1].trim()) {
    cleaned = codeBlockMatch[1].trim()
  }

  // 2. Locate first JSON boundary ('{' or '[')
  let firstOpen = -1
  let openType: '{' | '[' | null = null

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]
    if (ch === '{' || ch === '[') {
      firstOpen = i
      openType = ch
      break
    }
  }

  let candidate = cleaned
  if (firstOpen !== -1 && openType) {
    let inString = false
    let escape = false
    const stack: string[] = []
    let closedIndex = -1

    for (let i = firstOpen; i < cleaned.length; i++) {
      const ch = cleaned[i]

      if (inString) {
        if (escape) {
          escape = false
        } else if (ch === '\\') {
          escape = true
        } else if (ch === '"') {
          inString = false
        }
        continue
      }

      if (ch === '"') {
        inString = true
        continue
      }

      if (ch === '{' || ch === '[') {
        stack.push(ch)
      } else if (ch === '}' || ch === ']') {
        if (stack.length > 0) {
          const expected = stack[stack.length - 1] === '{' ? '}' : ']'
          if (ch === expected) {
            stack.pop()
          }
        }
        if (stack.length === 0) {
          closedIndex = i
          break
        }
      }
    }

    if (closedIndex !== -1) {
      if (openType === '{') {
        const remainder = cleaned.slice(closedIndex + 1).trim()
        if (/^,\s*\{/.test(remainder)) {
          const lastCloseBrace = cleaned.lastIndexOf('}')
          if (lastCloseBrace > closedIndex) {
            candidate = '[' + cleaned.slice(firstOpen, lastCloseBrace + 1) + ']'
          } else {
            candidate = cleaned.slice(firstOpen, closedIndex + 1)
          }
        } else {
          candidate = cleaned.slice(firstOpen, closedIndex + 1)
        }
      } else {
        candidate = cleaned.slice(firstOpen, closedIndex + 1)
      }
    } else {
      const lastClose = openType === '[' ? cleaned.lastIndexOf(']') : cleaned.lastIndexOf('}')
      if (lastClose > firstOpen) {
        candidate = cleaned.slice(firstOpen, lastClose + 1)
      } else {
        candidate = cleaned.slice(firstOpen)
      }
    }
  }

  try {
    return JSON.parse(candidate)
  } catch (err1: any) {
    // Attempt 1: If error indicates extra characters after JSON, slice to the indicated position
    const posMatch = err1?.message?.match(/at position (\d+)/i)
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10)
      if (pos > 0 && pos < candidate.length) {
        try {
          return JSON.parse(candidate.slice(0, pos).trim())
        } catch {}
      }
    }

    // Attempt 2: Remove trailing commas
    try {
      const noTrailingCommas = candidate.replace(/,\s*([}\]])/g, '$1')
      return JSON.parse(noTrailingCommas)
    } catch {}

    // Attempt 3: If candidate is comma-separated objects without array brackets
    try {
      const wrapped = `[${candidate.replace(/^\[?/, '').replace(/\]?$/, '')}]`
      const noTrailing = wrapped.replace(/,\s*([}\]])/g, '$1')
      return JSON.parse(noTrailing)
    } catch {}

    // Attempt 4: Try parsing original cleaned text
    if (cleaned !== candidate) {
      try {
        return JSON.parse(cleaned)
      } catch {}
    }

    throw new Error(`JSON parse error: ${err1?.message || err1}`)
  }
}

export function extractJson(text: string): string {
  try {
    const parsed = extractAndParseJson(text)
    return JSON.stringify(parsed)
  } catch {
    return text.trim()
  }
}

async function enrichVocabularyBatch(
  words: string[],
  adapter: any,
  systemPrompt: string,
  topic?: string,
  phrases?: string[],
): Promise<GeneratedVocabulary[]> {
  const topicContext = topic?.trim() ? `\nLesson Theme / Context: "${topic.trim()}"\n` : ''
  const relevantPhrases =
    phrases && phrases.length > 0
      ? phrases.filter((p) => words.some((w) => phraseContainsWord(p, w)))
      : []
  const phrasesToInclude =
    relevantPhrases.length > 0 ? relevantPhrases : (phrases || []).slice(0, 8)
  const phrasesContext =
    phrasesToInclude.length > 0
      ? `\nKey Lesson Collocations & Phrases to integrate:\n${phrasesToInclude.join(', ')}\n`
      : ''
  const userPrompt = `Create rich, engaging flashcards for the following items preserving exact item order.${topicContext}${phrasesContext}
MANDATORY DIVERSITY & ANTI-REPETITION RULES:
1. SCENARIO & SUBJECT VARIETY: Each card in this batch MUST feature a completely distinct, relatable scenario and subject. Do NOT repeat sentence openers. Do NOT start consecutive sentences with "She" or "He". Use a rich mix of subjects (e.g. "I", "we", "my roommate", "commuters", "the flight attendant", "local residents", "the barista", "the doctor", "travelers").
2. SENTENCE STRUCTURE VARIETY: Avoid formulaic patterns like "[Subject] [verb]ed [object] because [reason]". Use diverse structures (temporal openers: "On busy weekday mornings...", conditional clauses: "If you want to...", dialogue quotes: "'Don't forget to...', she reminded me", compound sentences with coordinating conjunctions).
3. LEXICAL CHUNKS INTEGRATION & CONTRAST:
   - For each word, check if any phrase from the "Key Lesson Collocations & Phrases" above naturally uses or collocates with this word. If so, PRIORITIZE selecting it as a chunk for this word and generate its accurate US IPA, Vietnamese meaning, English definition, and example sentence.
   - The 1 to 2 lexical chunks for each word MUST be distinct in type and function. NEVER provide redundant pairs like "take a bath" and "have a bath". Instead, pick 1 strong collocation (e.g. "run a warm bath") and 1 conversational expression, phrasal verb, or idiom (e.g. "soak in the tub").
4. VIVID PHOTOGRAPHIC IMAGE QUERIES: Describe clear, high-resolution, atmospheric photography scenes suitable for image search (e.g. "steaming ceramic coffee mug on rustic wooden table morning sunlight photography"). Avoid generic "person doing X".

Items to process:
${words.map((word, i) => `${i + 1}. ${word}`).join('\n')}`

  let rawCards: z.infer<typeof FlashcardSchema>[] = []
  let lastErr: any = null
  const MAX_RETRIES = 2

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const textOutput = await chat({
        adapter,
        systemPrompts: [systemPrompt],
        messages: [{ role: 'user', content: userPrompt }],
        stream: false,
      })
      const parsed = extractAndParseJson(textOutput)
      if (Array.isArray(parsed)) {
        rawCards = parsed
      } else if (Array.isArray(parsed?.cards)) {
        rawCards = parsed.cards
      } else if (Array.isArray(parsed?.vocabulary)) {
        rawCards = parsed.vocabulary
      } else if (Array.isArray(parsed?.items)) {
        rawCards = parsed.items
      } else if (Array.isArray(parsed?.flashcards)) {
        rawCards = parsed.flashcards
      } else if (Array.isArray(parsed?.data)) {
        rawCards = parsed.data
      } else {
        const validated = FlashcardsOutputSchema.safeParse(parsed)
        if (validated.success) {
          rawCards = validated.data.cards
        }
      }
      lastErr = null
      break
    } catch (err: any) {
      lastErr = err
      const isRetryable =
        err?.status === 502 ||
        err?.status === 503 ||
        err?.status === 504 ||
        err?.message?.includes('502') ||
        err?.message?.includes('timed out') ||
        err?.message?.includes('timeout') ||
        err?.message?.includes('429') ||
        err?.message?.includes('JSON') ||
        err instanceof SyntaxError

      if (isRetryable && attempt <= MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
        continue
      }
      break
    }
  }

  if (lastErr) {
    if (lastErr?.status === 401 || lastErr?.message?.includes('401')) {
      throw new Error(
        `OpenAI API returned 401 Unauthorized. Please verify your OPENAI_API_KEY and OPENAI_URL in .env. Details: ${lastErr?.message || lastErr}`,
      )
    }
    if (lastErr?.status === 405 || lastErr?.message?.includes('405')) {
      throw new Error(
        `OpenAI API endpoint returned 405 Method Not Allowed. Please verify your OPENAI_URL in .env (ensure the URL points to an endpoint supporting POST /chat/completions without trailing slash). Details: ${lastErr?.message || lastErr}`,
      )
    }
    if (lastErr?.status === 502 || lastErr?.message?.includes('502')) {
      throw new Error(
        `Máy chủ Proxy OpenAI trả về lỗi 502 Bad Gateway (Upstream timeout / 403). Gợi ý: Hãy đổi OPENAI_MODEL=gpt-5-6-mini trong file .env để máy chủ proxy phản hồi nhanh trong 5-10s thay vì bị timeout 30s. Chi tiết: ${lastErr?.message || lastErr}`,
      )
    }
    throw new Error(
      `Failed to generate vocabulary using TanStack AI: ${lastErr?.message || lastErr}`,
    )
  }

  return words.map((origWord, index) => {
    const item =
      rawCards.find((c) => String(c?.word || '').trim().toLowerCase() === origWord.trim().toLowerCase()) ||
      rawCards[index]
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

export async function enrichVocabulary(
  words: string[],
  topic?: string,
  phrases?: string[],
): Promise<GeneratedVocabulary[]> {
  if (!words.length) return []

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing. Copy .env.example to .env and add your key.')
  }

  const rawBaseURL =
    process.env.OPENAI_BASE_URL || process.env.OPENAI_URL || 'https://api.openai.com/v1'
  const baseURL = rawBaseURL.trim().replace(/\/+$/, '')
  const model = getModelName()

  const adapter = openaiCompatibleText(model, {
    baseURL,
    apiKey,
    ...OPENAI_CLIENT_OPTIONS,
  })

  const systemPrompt = `You are an expert bilingual English lexicographer and pedagogue creating rich, memorable English vocabulary flashcards for Vietnamese learners.

CORE PRINCIPLES & DIVERSITY MANDATES:
1. ANTI-REPETITION & VARIETY (CRITICAL):
   - Never generate monotonous, cookie-cutter sentence formulas.
   - Do NOT start sentences repeatedly with "She..." or "He...". Use diverse perspectives: first-person ("I / We"), realistic third-person agents ("the barista", "commuters", "our tour guide", "my roommate", "passengers"), second-person advice ("When you...", "Make sure to..."), or situational openers ("After an exhausting shift...", "On chilly autumn mornings...").
   - Mix sentence types: complex sentences with subordinate clauses, natural conversational quotes, and vivid real-life scenes.
2. LEXICAL CHUNKS DIVERSITY:
   - For each word/phrase, provide 1 to 2 high-frequency, authentic lexical chunks showing how native speakers naturally use this word.
   - NO REDUNDANCY: Never supply two nearly identical chunks (e.g. NEVER give both "take a bath" and "have a bath"; NEVER give both "go to sleep" and "fall asleep").
   - Prefer contrasting categories: strong collocations (Verb + Noun, Adj + Noun, e.g. "strike a balance", "hectic schedule", "run a bath"), phrasal verbs, idioms, or situational phrases (e.g. "sleep in", "at the crack of dawn", "in a hurry").
   - Each chunk MUST have its own accurate General American US IPA, natural Vietnamese translation, concise English usage explanation, and contextual example sentence.
3. LEARNER-FRIENDLY ENGLISH DEFINITIONS:
   - Write in the style of Oxford Advanced Learner's Dictionary / Cambridge Dictionary: clear, conversational, engaging, explaining how and when the word is used.
   - Avoid dry, circular robotic boilerplate like "the act of...", "a time when you wash your body", "a device used for...".
4. IDIOMATIC VIETNAMESE (TỰ NHIÊN, CHUẨN XÁC):
   - Translate into natural, idiomatic Vietnamese that reflects actual everyday speech and modern usage.
   - Include common collocations or usage notes in parentheses where helpful (e.g. "bồn tắm; việc tắm bồn / ngâm mình"). Avoid literal, clunky machine translation.
5. GENERAL AMERICAN (US) IPA:
   - Use standard General American US IPA transcription enclosed in slashes (e.g. rhotic /r/, flap [t] /t̬/, American vowels like /æ/, /ɑː/, /oʊ/, e.g. /ˈwɑː.t̬ɚ/, /ˈskedʒ.uːl/).
6. PHOTOGRAPHY IMAGE QUERIES:
   - Write concrete visual descriptions with atmospheric, photographic keywords (lighting, setting, composition) suitable for search engines.
   - Avoid generic phrases like "person doing X" or "man holding Y". No quotation marks.

You MUST return ONLY valid JSON matching this exact JSON schema: {"cards": [{"word": string, "ipa": string, "vietnamese": string, "englishDefinition": string, "example": string, "imageQuery": string, "partOfSpeech": string, "chunks": [{"text": string, "ipa": string, "meaningVi": string, "englishDefinition": string, "example": string, "imageQuery": string, "partOfSpeech": string}]}]}. Do not omit any key. Do not output markdown code fences or explanatory text.`

  async function pMap<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    concurrency = 2,
  ): Promise<R[]> {
    const results: R[] = new Array(items.length)
    let index = 0
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const current = index++
        results[current] = await fn(items[current])
      }
    })
    await Promise.all(workers)
    return results
  }

  const BATCH_SIZE = 6
  const batches: string[][] = []
  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    batches.push(words.slice(i, i + BATCH_SIZE))
  }

  const results = await pMap(
    batches,
    (batch) => enrichVocabularyBatch(batch, adapter, systemPrompt, topic, phrases),
    2,
  )

  return (results.flat() || []).filter(Boolean)
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

  const rawBaseURL =
    process.env.OPENAI_BASE_URL || process.env.OPENAI_URL || 'https://api.openai.com/v1'
  const baseURL = rawBaseURL.trim().replace(/\/+$/, '')
  const model = getModelName()

  const adapter = openaiCompatibleText(model, {
    baseURL,
    apiKey,
    ...OPENAI_CLIENT_OPTIONS,
  })

  const systemPrompt = `You create high-yield, practical language and grammar study notes from English textbook sections for Vietnamese learners.

GUIDELINES:
- Distill key grammatical formulas/forms (e.g. S + am/is/are + V-ing), collocations, structural patterns, and usage rules into crisp, memorable bullet points.
- For grammar rules or contrastive notes (e.g. "not ..."): clearly highlight the exact formula (Form), when to use vs. when NOT to use, and common learner pitfalls.
- For practice exercises, preserve key example problems with bracketed answers [answer].
- vietnameseExplanation: Clear, engaging explanation in natural Vietnamese explaining WHEN, WHY, and HOW native speakers use these structures/patterns in real life, with nuanced contrast.
- example: A realistic, memorable contextual example sentence in General American English bringing the rule to life. Avoid generic, monotonous templates.

You MUST return ONLY valid JSON matching this exact JSON schema: {"notes": [{"title": string, "content": string[], "vietnameseExplanation": string, "example": string}]}. Do not omit any key. Do not output markdown code fences or explanatory text.`

  const userPrompt = `Enrich the following ${rawNotes.length} language notes for Vietnamese learners. Return JSON {"notes": [...]}:\n${rawNotes
    .map(
      (n, i) =>
        `### Note ${i + 1}: ${n.title}\nRaw content:\n${n.content.map((c) => `- ${c}`).join('\n')}`,
    )
    .join('\n\n')}`

  let rawOutputNotes: z.infer<typeof NoteSchema>[] = []
  let lastErr: any = null
  const MAX_RETRIES = 2

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const textOutput = await chat({
        adapter,
        systemPrompts: [systemPrompt],
        messages: [{ role: 'user', content: userPrompt }],
        stream: false,
      })
      const parsed = extractAndParseJson(textOutput)
      if (Array.isArray(parsed)) {
        rawOutputNotes = parsed
      } else if (Array.isArray(parsed?.notes)) {
        rawOutputNotes = parsed.notes
      } else if (Array.isArray(parsed?.items)) {
        rawOutputNotes = parsed.items
      } else if (Array.isArray(parsed?.data)) {
        rawOutputNotes = parsed.data
      } else {
        const validated = NotesOutputSchema.safeParse(parsed)
        if (validated.success) {
          rawOutputNotes = validated.data.notes
        }
      }
      lastErr = null
      break
    } catch (err: any) {
      lastErr = err
      const isRetryable =
        err?.status === 502 ||
        err?.status === 503 ||
        err?.status === 504 ||
        err?.message?.includes('502') ||
        err?.message?.includes('timed out') ||
        err?.message?.includes('timeout') ||
        err?.message?.includes('429') ||
        err?.message?.includes('JSON') ||
        err instanceof SyntaxError

      if (isRetryable && attempt <= MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
        continue
      }
      break
    }
  }

  if (lastErr) {
    if (lastErr?.status === 401 || lastErr?.message?.includes('401')) {
      throw new Error(
        `OpenAI API returned 401 Unauthorized. Please verify your OPENAI_API_KEY and OPENAI_URL in .env. Details: ${lastErr?.message || lastErr}`,
      )
    }
    if (lastErr?.status === 405 || lastErr?.message?.includes('405')) {
      throw new Error(
        `OpenAI API endpoint returned 405 Method Not Allowed. Please verify your OPENAI_URL in .env (ensure the URL points to an endpoint supporting POST /chat/completions without trailing slash). Details: ${lastErr?.message || lastErr}`,
      )
    }
    if (lastErr?.status === 502 || lastErr?.message?.includes('502')) {
      throw new Error(
        `Máy chủ Proxy OpenAI trả về lỗi 502 Bad Gateway (Upstream timeout / 403). Gợi ý: Hãy đổi OPENAI_MODEL=gpt-5-6-mini trong file .env để máy chủ proxy phản hồi nhanh trong 5-10s thay vì bị timeout 30s. Chi tiết: ${lastErr?.message || lastErr}`,
      )
    }
    throw new Error(
      `Failed to enrich notes using TanStack AI: ${lastErr?.message || lastErr}`,
    )
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
  topic?: string,
): Promise<GeneratedVocabulary[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing. Copy .env.example to .env and add your key.')
  }

  const rawBaseURL =
    process.env.OPENAI_BASE_URL || process.env.OPENAI_URL || 'https://api.openai.com/v1'
  const baseURL = rawBaseURL.trim().replace(/\/+$/, '')
  const model = getModelName()

  const adapter = openaiCompatibleText(model, {
    baseURL,
    apiKey,
    ...OPENAI_CLIENT_OPTIONS,
  })

  const systemPrompt = `You are an expert English teacher specialized in Lexical Chunking methodology. From the provided vocabulary list, lesson theme, and context, generate 6 to 12 high-yield, authentic Lexical Chunks.

CRITICAL DIVERSITY & QUALITY RULES:
1. CATEGORY DIVERSITY: Do NOT generate chunks that all follow the same pattern (e.g. avoid generating 6 chunks that all start with "take a..." or "have a..."). Balance across diverse categories:
   - Strong Collocations: Verb + Noun ("run a warm bath", "set an alarm", "strike a deal"), Adj + Noun ("sound sleep", "tight schedule", "heavy traffic")
   - Phrasal Verbs & Verb Phrases ("drift off", "freshen up", "fall behind", "catch up on")
   - Prepositional & Adverbial Phrases ("in a hurry", "at the crack of dawn", "day in and day out")
   - Conversational Gambits & Spoken Idioms ("call it a day", "if you ask me", "as a matter of fact")
2. ANTI-REPETITION IN EXAMPLES:
   - Each chunk's example sentence MUST depict a different realistic scene.
   - Avoid monotonous "She/He..." openings. Use diverse subjects ("I", "we", "my coworkers", "travelers", "local students"), conditional sentences ("When you...", "If you..."), and natural dialogues.
3. IDIOMATIC VIETNAMESE:
   - Provide natural, fluent Vietnamese meanings that capture the real pragmatic nuance, not robotic word-for-word translations.
4. SPECIFIC PHOTOGRAPHIC IMAGE QUERIES:
   - Describe high-quality, realistic photography scenes with atmosphere and setting details instead of generic "person doing X". No quotes.
5. GENERAL AMERICAN (US) IPA:
   - Standard US IPA transcription enclosed in slashes.

You MUST return ONLY valid JSON matching this exact JSON schema: {"cards": [{"word": string, "ipa": string, "vietnamese": string, "englishDefinition": string, "example": string, "imageQuery": string, "partOfSpeech": string}]}. Do not omit any key. Do not output markdown code fences or explanatory text.`

  const topicContext = topic?.trim() ? `Lesson Theme / Topic: "${topic.trim()}"\n` : ''
  const userPrompt = `Generate 6 to 12 diverse, authentic lexical chunks based on this lesson:
${topicContext}
Vocabulary words:
${words.slice(0, 40).join(', ')}

${storyText ? `Context / Reading text from lesson:\n${storyText.slice(0, 1500)}` : ''}`

  let rawCards: z.infer<typeof StandaloneChunkSchema>[] = []
  let lastErr: any = null
  const MAX_RETRIES = 2

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const textOutput = await chat({
        adapter,
        systemPrompts: [systemPrompt],
        messages: [{ role: 'user', content: userPrompt }],
        stream: false,
      })
      const parsed = extractAndParseJson(textOutput)
      if (Array.isArray(parsed)) {
        rawCards = parsed
      } else if (Array.isArray(parsed?.cards)) {
        rawCards = parsed.cards
      } else if (Array.isArray(parsed?.chunks)) {
        rawCards = parsed.chunks
      } else if (Array.isArray(parsed?.items)) {
        rawCards = parsed.items
      } else if (Array.isArray(parsed?.data)) {
        rawCards = parsed.data
      } else {
        const validated = StandaloneChunksOutputSchema.safeParse(parsed)
        if (validated.success) {
          rawCards = validated.data.cards
        }
      }
      lastErr = null
      break
    } catch (err: any) {
      lastErr = err
      const isRetryable =
        err?.status === 502 ||
        err?.status === 503 ||
        err?.status === 504 ||
        err?.message?.includes('502') ||
        err?.message?.includes('timed out') ||
        err?.message?.includes('timeout') ||
        err?.message?.includes('429') ||
        err?.message?.includes('JSON') ||
        err instanceof SyntaxError

      if (isRetryable && attempt <= MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
        continue
      }
      break
    }
  }

  if (lastErr) {
    if (lastErr?.status === 401 || lastErr?.message?.includes('401')) {
      throw new Error(
        `OpenAI API returned 401 Unauthorized. Please verify your OPENAI_API_KEY and OPENAI_URL in .env. Details: ${lastErr?.message || lastErr}`,
      )
    }
    if (lastErr?.status === 405 || lastErr?.message?.includes('405')) {
      throw new Error(
        `OpenAI API endpoint returned 405 Method Not Allowed. Please verify your OPENAI_URL in .env (ensure the URL points to an endpoint supporting POST /chat/completions without trailing slash). Details: ${lastErr?.message || lastErr}`,
      )
    }
    if (lastErr?.status === 502 || lastErr?.message?.includes('502')) {
      throw new Error(
        `Máy chủ Proxy OpenAI trả về lỗi 502 Bad Gateway (Upstream timeout / 403). Gợi ý: Hãy đổi OPENAI_MODEL=gpt-5-6-mini trong file .env để máy chủ proxy phản hồi nhanh trong 5-10s thay vì bị timeout 30s. Chi tiết: ${lastErr?.message || lastErr}`,
      )
    }
    throw new Error(
      `Failed to generate chunks using TanStack AI: ${lastErr?.message || lastErr}`,
    )
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

