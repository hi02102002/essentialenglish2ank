import { chat } from '@tanstack/ai'
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible'
import { z } from 'zod'
import type { GeneratedNote, GeneratedVocabulary } from '@/lib/types'
import { OPENAI_CLIENT_OPTIONS } from '@/server/ai-client-config'
import { normalizePartOfSpeech } from '@/lib/pos'
import { phraseContainsWord } from '@/lib/phrase-matcher'
import {
  AI_PROVIDERS,
  type AIProviderId,
  type ClientAiRuntimeConfig,
} from '@/lib/ai-providers'

export function resolveAiConfig(runtimeConfig?: ClientAiRuntimeConfig) {
  // 1. Determine provider
  let providerId: AIProviderId = 'openai'
  if (runtimeConfig?.provider && AI_PROVIDERS[runtimeConfig.provider]) {
    providerId = runtimeConfig.provider
  } else if (
    process.env.AI_PROVIDER &&
    AI_PROVIDERS[process.env.AI_PROVIDER as AIProviderId]
  ) {
    providerId = process.env.AI_PROVIDER as AIProviderId
  } else {
    // Auto-detect from environment
    const rawEnvUrl = (process.env.OPENAI_URL || process.env.OPENAI_BASE_URL || '').trim()
    const hasLtnKey = Boolean(process.env.LTN_API_KEY)
    if (hasLtnKey || /ltnproxy\.com/i.test(rawEnvUrl)) {
      providerId = 'ltn'
    } else if (rawEnvUrl && !/api\.openai\.com/i.test(rawEnvUrl)) {
      providerId = 'custom'
    } else {
      providerId = 'openai'
    }
  }

  const providerDef = AI_PROVIDERS[providerId]

  // 2. Determine baseURL
  let baseURL = runtimeConfig?.baseURL?.trim()
  if (!baseURL) {
    if (providerId === 'ltn') {
      baseURL =
        process.env.LTN_BASE_URL ||
        process.env.LTN_URL ||
        (process.env.OPENAI_URL?.includes('ltnproxy')
          ? process.env.OPENAI_URL
          : providerDef.defaultBaseURL)
    } else if (providerId === 'openai') {
      baseURL =
        process.env.OPENAI_BASE_URL ||
        process.env.OPENAI_URL ||
        providerDef.defaultBaseURL
    } else {
      baseURL =
        process.env.CUSTOM_AI_URL ||
        process.env.OPENAI_BASE_URL ||
        process.env.OPENAI_URL ||
        providerDef.defaultBaseURL
    }
  }
  baseURL = (baseURL || providerDef.defaultBaseURL).trim().replace(/\/+$/, '')
  // Normalize LTN URL if /v1 was omitted
  if (/^https?:\/\/api\.ltnproxy\.com$/i.test(baseURL)) {
    baseURL = `${baseURL}/v1`
  }

  // 3. Determine API Key
  let apiKey = runtimeConfig?.apiKey?.trim()
  if (!apiKey) {
    if (providerId === 'ltn') {
      apiKey = process.env.LTN_API_KEY || process.env.OPENAI_API_KEY || ''
    } else if (providerId === 'openai') {
      apiKey = process.env.OPENAI_API_KEY || ''
    } else {
      apiKey = process.env.CUSTOM_AI_KEY || process.env.OPENAI_API_KEY || ''
    }
  }

  if (!apiKey && providerId !== 'custom') {
    throw new Error(
      `Thiếu API Key cho provider "${providerDef.name}". Vui lòng cấu hình biến môi trường ${providerDef.apiKeyEnvName} trong file .env hoặc nhập trực tiếp trên giao diện.`,
    )
  }

  // 4. Determine Model
  let model = runtimeConfig?.model?.trim()
  if (!model) {
    if (providerId === 'ltn') {
      const raw = (process.env.LTN_MODEL || process.env.OPENAI_MODEL || '').trim()
      if (raw === 'gpt-5-6' || raw === 'gpt-5-6-mini' || raw === 'gpt-5-6-pro' || !raw) {
        model = providerDef.defaultModel
      } else {
        model = raw
      }
    } else if (providerId === 'openai') {
      const raw = (process.env.OPENAI_MODEL || '').trim()
      if (raw.startsWith('gpt-5-6') || !raw) {
        model = providerDef.defaultModel
      } else {
        model = raw
      }
    } else {
      model =
        process.env.CUSTOM_AI_MODEL ||
        process.env.OPENAI_MODEL ||
        providerDef.defaultModel
    }
  }

  return {
    provider: providerDef,
    providerId,
    baseURL,
    apiKey,
    model,
  }
}

export function getAiBaseURL(runtimeConfig?: ClientAiRuntimeConfig): string {
  return resolveAiConfig(runtimeConfig).baseURL
}

export function getAiApiKey(runtimeConfig?: ClientAiRuntimeConfig): string {
  return resolveAiConfig(runtimeConfig).apiKey
}

export function getModelName(runtimeConfig?: ClientAiRuntimeConfig): string {
  return resolveAiConfig(runtimeConfig).model
}

function handleAiError(
  lastErr: any,
  model: string,
  baseURL: string,
  providerName: string,
  context: string,
): never {
  if (lastErr?.status === 401 || lastErr?.message?.includes('401')) {
    throw new Error(
      `[${providerName}] Lỗi 401 Unauthorized: API Key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại API Key. Chi tiết: ${lastErr?.message || lastErr}`,
    )
  }
  if (
    lastErr?.status === 404 ||
    lastErr?.message?.includes('model_not_found') ||
    lastErr?.message?.includes('404')
  ) {
    throw new Error(
      `[${providerName}] Model "${model}" không tồn tại hoặc không được hỗ trợ bởi endpoint (${baseURL}). Vui lòng chọn một model hợp lệ từ danh sách hỗ trợ của ${providerName}. Chi tiết: ${lastErr?.message || lastErr}`,
    )
  }
  if (lastErr?.status === 405 || lastErr?.message?.includes('405')) {
    throw new Error(
      `[${providerName}] Lỗi 405 Method Not Allowed. Hãy đảm bảo Base URL có đuôi /v1 (ví dụ: https://api.ltnproxy.com/v1). Chi tiết: ${lastErr?.message || lastErr}`,
    )
  }
  if (lastErr?.status === 429 || lastErr?.message?.includes('429')) {
    throw new Error(
      `[${providerName}] Lỗi 429 Too Many Requests (Hết quota hoặc vượt giới hạn rate limit). Vui lòng thử lại sau giây lát hoặc nạp thêm credit. Chi tiết: ${lastErr?.message || lastErr}`,
    )
  }
  if (lastErr?.status === 502 || lastErr?.message?.includes('502')) {
    throw new Error(
      `[${providerName}] Lỗi 502 Bad Gateway (Upstream timeout). Gợi ý: Hãy đổi sang model nhẹ/nhanh hơn trong danh sách. Chi tiết: ${lastErr?.message || lastErr}`,
    )
  }
  throw new Error(
    `[${providerName}] Không thể ${context}: ${lastErr?.message || lastErr}`,
  )
}

export const LexicalChunkSchema = z.object({
  text: z
    .string()
    .describe(
      'Natural high-frequency English lexical chunk, collocation or expression directly related to the lesson context, e.g. "shake hands", "nod one\'s head"',
    ),
  ipa: z
    .string()
    .describe(
      'Standard British English (UK / Received Pronunciation) IPA pronunciation for this chunk enclosed in slashes, e.g. /ˈʃeɪk hændz/',
    ),
  meaningVi: z
    .string()
    .describe('Concise, natural Vietnamese meaning of this chunk in the lesson context'),
  englishDefinition: z
    .string()
    .describe('Simple, clear English definition explaining how the chunk is used'),
  example: z
    .string()
    .describe(
      'A SIMPLE, SHORT, and EASY TO UNDERSTAND example sentence (8-16 words) in British English, strictly set in the context of the lesson theme',
    ),
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
      'Standard British English (UK / Received Pronunciation) IPA pronunciation enclosed in slashes, e.g. /ˈvaʊ.tʃər/, /ˈʃed.juːl/, /ˈwɔː.tər/',
    ),
  vietnamese: z.string().describe('Vietnamese translation or concise meaning for learners'),
  englishDefinition: z
    .string()
    .describe('Clear, simple, learner-friendly English definition explaining the word in this lesson theme'),
  example: z
    .string()
    .describe(
      'A SIMPLE, CLEAR, and EASY TO UNDERSTAND example sentence (8-16 words) in British English, directly illustrating the word in the context of the lesson theme',
    ),
  imageQuery: z.string().describe('Safe, concrete visual search query without quotes'),
  partOfSpeech: z
    .string()
    .describe(
      'Part of speech in English: noun, verb, adjective, adverb, phrase, phrasal verb, idiom, preposition, or conjunction',
    ),
  chunks: z
    .array(LexicalChunkSchema)
    .describe(
      '1 to 2 high-frequency lexical chunks using this word in the lesson context, each with UK IPA, Vietnamese meaning, simple English definition, and a simple contextual example sentence',
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
  // Strip reasoning / think tags if emitted by reasoning models (DeepSeek, Kimi, GLM, etc.)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

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
  model: string,
  baseURL: string,
  providerName: string,
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
  const userPrompt = `Create clear, natural, and memorable flashcards for the following items preserving exact item order.${topicContext}${phrasesContext}
MANDATORY RULES FOR EXAMPLES & LESSON CONTEXT:
1. STRICT LESSON THEME RELEVANCE (QUAN TRỌNG):
   - Every single example sentence MUST directly reflect the Lesson Theme / Context: "${topic || 'English in Use'}".
   - If the lesson is about "The body and movement", every example must describe body parts, physical movements, postures, gestures, or sensations (e.g. nodding head, bending down, aching back, touching toes, smiling, waving).
   - If the lesson is about travel, food, feelings, or jobs, strictly illustrate situations directly in that specific topic. Do NOT invent unrelated, random contexts.
2. SIMPLE, CLEAR & EASY TO UNDERSTAND (DỄ HIỂU & NGẮN GỌN):
   - Keep sentences clean, natural, and concise (ideally 8 to 16 words).
   - Use straightforward everyday vocabulary (CEFR A2–B1 level) so the learner can easily understand 100% of the sentence.
   - The sentence must clearly illuminate the exact meaning of the target word/chunk so the learner immediately grasps it from context.
   - Avoid long, complicated, multi-clause sentences or rare literary words.
3. AUTHENTIC BRITISH ENGLISH (UK):
   - Natural British English phrasing and vocabulary (e.g. "flat", "holiday", "have a bath", "trousers", "biscuit", "chemist's").
4. NATURAL LEXICAL CHUNKS:
   - For each word, prioritize selecting high-frequency chunks/collocations from the lesson.
   - The example sentence for each chunk must also be simple, short, and directly grounded in the lesson theme.
5. VIVID PHOTOGRAPHIC IMAGE QUERIES:
   - Describe a clear, realistic photography scene without quotes illustrating the word in this lesson's context.

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
    handleAiError(lastErr, model, baseURL, providerName, 'generate vocabulary')
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
  runtimeConfig?: ClientAiRuntimeConfig,
): Promise<GeneratedVocabulary[]> {
  if (!words.length) return []

  const { baseURL, apiKey, model, provider } = resolveAiConfig(runtimeConfig)

  const adapter = openaiCompatibleText(model, {
    baseURL,
    apiKey,
    ...OPENAI_CLIENT_OPTIONS,
  })

  const systemPrompt = `You are an expert bilingual English lexicographer and pedagogue creating clean, memorable English vocabulary flashcards with British English (UK) pronunciation and authentic usage for Vietnamese learners.

CORE PRINCIPLES & GUIDELINES:
1. SIMPLE, EASY-TO-UNDERSTAND & CONTEXTUAL EXAMPLES (CRITICAL):
   - Every example sentence MUST be SIMPLE, CLEAR, and DIRECTLY ROOTED in the specific lesson theme/topic (e.g. if the lesson is "The body and movement", illustrate body movements, gestures, postures, or physical sensations like nodding, bending down, aching back, touching toes).
   - Keep sentences concise, natural, and punchy (ideally 8 to 16 words).
   - Use straightforward everyday vocabulary (A2–B1 CEFR level) so the learner focuses effortlessly on the target word without stumbling over other words.
   - The example sentence must make the meaning of the target word/chunk immediately obvious from context.
   - Avoid long, convoluted, compound-complex sentences or literary jargon.
2. LESSON-RELEVANT LEXICAL CHUNKS:
   - For each word/phrase, provide 1 to 2 high-frequency, authentic lexical chunks showing how native British speakers naturally use this word in the lesson's context.
   - NO REDUNDANCY: Never supply two nearly identical chunks (e.g. NEVER give both "take a bath" and "have a bath").
   - Each chunk MUST have its own accurate UK IPA (/.../), natural Vietnamese translation, concise English usage explanation, and a short, simple example sentence (8-16 words) in the lesson context.
3. LEARNER-FRIENDLY ENGLISH DEFINITIONS:
   - Write in the style of Oxford Advanced Learner's Dictionary / Cambridge Dictionary: clear, conversational, explaining how and when the word is used in this topic.
   - Avoid dry, circular robotic boilerplate like "the act of...", "a device used for...".
4. IDIOMATIC VIETNAMESE (TỰ NHIÊN, CHUẨN XÁC):
   - Translate into natural, idiomatic Vietnamese that reflects actual everyday speech and modern usage.
   - Include common collocations or usage notes in parentheses where helpful (e.g. "bồn tắm; việc tắm bồn / ngâm mình").
5. BRITISH ENGLISH (UK) IPA & SPELLING:
   - Use standard British English (Received Pronunciation - RP) IPA transcription enclosed in slashes (e.g. /ˈwɔː.tər/, /ˈʃed.juːl/, /ˈvaʊ.tʃər/).
   - Prefer British English spelling and natural UK phrasing where applicable.
6. PHOTOGRAPHY IMAGE QUERIES:
   - Write concrete visual descriptions with atmospheric photography keywords suitable for search engines. No quotation marks.

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
    (batch) =>
      enrichVocabularyBatch(
        batch,
        adapter,
        systemPrompt,
        model,
        baseURL,
        provider.name,
        topic,
        phrases,
      ),
    2,
  )

  return (results.flat() || []).filter(Boolean)
}

export const NoteSchema = z.object({
  title: z.string().describe('Clear topic title for this note or rule, e.g. "Body movement expressions"'),
  content: z.array(z.string()).describe('List of key expressions, phrases, or bullet rules'),
  vietnameseExplanation: z.string().describe('Concise explanation in Vietnamese of usage and meaning for learners'),
  example: z
    .string()
    .describe(
      'A simple, clear, and practical example sentence (8-16 words) in British English demonstrating the rule in the lesson context',
    ),
})

export const NotesOutputSchema = z.object({
  notes: z.array(NoteSchema).describe('List of enriched language notes matching the input items'),
})

export async function enrichNotes(
  rawNotes: Array<{ title: string; content: string[] }>,
  runtimeConfig?: ClientAiRuntimeConfig,
): Promise<GeneratedNote[]> {
  if (!rawNotes.length) return []

  const { baseURL, apiKey, model, provider } = resolveAiConfig(runtimeConfig)

  const adapter = openaiCompatibleText(model, {
    baseURL,
    apiKey,
    ...OPENAI_CLIENT_OPTIONS,
  })

  const systemPrompt = `You create high-yield, practical language and grammar study notes from English textbook sections for Vietnamese learners with British English usage.

GUIDELINES:
- Distill key grammatical formulas/forms (e.g. S + am/is/are + V-ing), collocations, structural patterns, and usage rules into crisp, memorable bullet points.
- For grammar rules or contrastive notes (e.g. "not ..."): clearly highlight the exact formula (Form), when to use vs. when NOT to use, and common learner pitfalls.
- For practice exercises, preserve key example problems with bracketed answers [answer].
- vietnameseExplanation: Clear, engaging explanation in natural Vietnamese explaining WHEN, WHY, and HOW native speakers use these structures/patterns in real life.
- example: A SIMPLE, CLEAR, and practical example sentence in British English (8-16 words) directly illustrating the rule or pattern in an everyday, relatable context. Keep the vocabulary accessible (A2-B1 level) so learners can immediately grasp how the rule works.

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
    handleAiError(lastErr, model, baseURL, provider.name, 'enrich notes')
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
  ipa: z.string().describe('Standard British English (UK / Received Pronunciation) IPA pronunciation'),
  vietnamese: z.string().describe('Vietnamese translation or meaning in this lesson context'),
  englishDefinition: z.string().describe('Simple, clear English definition'),
  example: z
    .string()
    .describe(
      'A simple, clear, and natural example sentence (8-16 words) in British English directly illustrating the chunk in the lesson context',
    ),
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
  runtimeConfig?: ClientAiRuntimeConfig,
): Promise<GeneratedVocabulary[]> {
  const { baseURL, apiKey, model, provider } = resolveAiConfig(runtimeConfig)

  const adapter = openaiCompatibleText(model, {
    baseURL,
    apiKey,
    ...OPENAI_CLIENT_OPTIONS,
  })

  const systemPrompt = `You are an expert English teacher specialized in Lexical Chunking methodology. From the provided vocabulary list, lesson theme, and context, generate 6 to 12 high-yield, authentic Lexical Chunks with British English (UK) usage and pronunciation.

CRITICAL RULES FOR CHUNKS & EXAMPLES:
1. STRICT LESSON THEME RELEVANCE (QUAN TRỌNG):
   - Every chunk and its example sentence MUST be tightly focused on the Lesson Theme / Topic.
   - If the lesson is about the body, use actions, expressions, gestures, and sensations directly related to the body.
2. SIMPLE, CLEAR & EASY TO UNDERSTAND EXAMPLES (DỄ HIỂU & NGẮN GỌN):
   - Each example sentence MUST be simple, short (8 to 16 words), and easy to understand for everyday learners (A2-B1 level).
   - Use straightforward vocabulary so learners immediately grasp how native speakers use this chunk in context.
   - Avoid long, convoluted, or abstract sentence structures.
3. CATEGORY DIVERSITY:
   - Strong Collocations: Verb + Noun ("nod one's head", "blow one's nose", "take a deep breath"), Adj + Noun ("sore throat", "sharp pain")
   - Phrasal Verbs & Verb Phrases ("bend down", "stand up", "lie down")
   - Conversational & Prepositional Phrases ("on one's feet", "from head to toe")
4. IDIOMATIC VIETNAMESE:
   - Provide natural, fluent Vietnamese meanings that capture the real pragmatic nuance.
5. BRITISH ENGLISH (UK) IPA:
   - Standard British English (UK / Received Pronunciation) IPA transcription enclosed in slashes.

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
    handleAiError(lastErr, model, baseURL, provider.name, 'generate chunks')
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

