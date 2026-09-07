import { chat } from '@tanstack/ai'
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible'
import { z } from 'zod'
import type { GeneratedVocabulary } from '@/lib/types'

export const FlashcardSchema = z.object({
  word: z.string().describe('The English vocabulary word or phrase'),
  ipa: z.string().describe('Standard learner-friendly English IPA pronunciation'),
  vietnamese: z.string().describe('Vietnamese translation or concise meaning for learners'),
  englishDefinition: z.string().describe('Original concise English definition, do not copy textbook wording'),
  example: z.string().describe('Natural example sentence illustrating usage'),
  imageQuery: z.string().describe('Safe, concrete visual search query without quotes'),
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

export async function enrichVocabulary(words: string[]): Promise<GeneratedVocabulary[]> {
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
    'You create beginner/intermediate English vocabulary flashcards for Vietnamese learners. Write original concise definitions and examples; do not copy textbook wording. Preserve phrasal expressions exactly. IPA should be standard learner-friendly English IPA. Image queries should describe a concrete, safe, easy-to-recognize visual and contain no quotation marks.\n\nYou MUST return ONLY valid JSON matching this exact JSON schema: {"cards": [{"word": string, "ipa": string, "vietnamese": string, "englishDefinition": string, "example": string, "imageQuery": string}]}. Do not omit any key. Do not output markdown code fences or explanatory text.'

  const userPrompt = `Create flashcards for each item, preserving exact item order. Return JSON {"cards": [...]}:\n${words
    .map((word, i) => `${i + 1}. ${word}`)
    .join('\n')}`

  let rawCards: z.infer<typeof FlashcardSchema>[] = []

  try {
    // 1. Primary path: TanStack AI with typed structured outputSchema
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

    // 2. Resilient fallback: If proxy returned unparsed/fenced JSON, call chat with stream: false and validate
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

  if (rawCards.length !== words.length) {
    throw new Error(`AI returned ${rawCards.length} cards for ${words.length} words.`)
  }

  const cards: GeneratedVocabulary[] = rawCards.map((item, index) => ({
    word: String(item.word || words[index] || '').trim(),
    ipa: String(item.ipa || '').trim(),
    vietnamese: String(item.vietnamese || '').trim(),
    englishDefinition: String(item.englishDefinition || '').trim(),
    example: String(item.example || '').trim(),
    imageQuery: String(item.imageQuery || item.word || words[index] || '').trim(),
  }))

  return cards
}
