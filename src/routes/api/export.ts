import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { buildApkg } from '@/server/anki'
import { assertAuthorized } from '@/server/auth'

const vocabCardSchema = z.object({
  type: z.literal('vocabulary').optional().default('vocabulary'),
  id: z.string(),
  selected: z.boolean(),
  unitNumber: z.number().optional(),
  word: z.string(),
  kind: z.enum(['word', 'phrase']).optional(),
  partOfSpeech: z.string().optional().default(''),
  hint: z.string().optional(),
  ipa: z.string().optional().default(''),
  vietnamese: z.string(),
  englishDefinition: z.string().optional().default(''),
  example: z.string().optional().default(''),
  chunks: z
    .array(
      z.object({
        text: z.string(),
        meaningVi: z.string().optional().default(''),
        audioUrl: z.string().optional().default(''),
      }),
    )
    .optional()
    .default([]),
  imageQuery: z.string().optional().default(''),
  imageUrl: z.string().optional().default(''),
  wordAudioUrl: z.string().optional().default(''),
  exampleAudioUrl: z.string().optional().default(''),
  sourceUrl: z.string().optional().default(''),
})

const noteCardSchema = z.object({
  type: z.literal('note'),
  id: z.string(),
  selected: z.boolean(),
  unitNumber: z.number().optional(),
  title: z.string(),
  content: z.array(z.string()),
  vietnameseExplanation: z.string().optional().default(''),
  example: z.string().optional().default(''),
  exampleAudioUrl: z.string().optional().default(''),
  sourceUrl: z.string().optional().default(''),
})

const cardSchema = z.union([noteCardSchema, vocabCardSchema])

const payloadSchema = z.object({
  deckName: z.string().min(1).max(120),
  cards: z.array(cardSchema).min(1).max(200),
  token: z.string().optional(),
})

function filenameFor(deckName: string) {
  const safe = deckName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return `${safe || 'anki-deck'}.apkg`
}

export const Route = createFileRoute('/api/export')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader =
            request.headers.get('x-access-token') ||
            request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

          const json = await request.json()
          const payload = payloadSchema.parse(json)
          const token = authHeader || payload.token

          assertAuthorized(token)

          const cards = payload.cards.filter((card) => card.selected)
          if (!cards.length) return new Response('No selected cards', { status: 400 })

          const output = await buildApkg(payload.deckName, cards)
          return new Response(output as BodyInit, {
            headers: {
              'content-type': 'application/octet-stream',
              'content-disposition': `attachment; filename="${filenameFor(payload.deckName)}"`,
              'cache-control': 'no-store',
            },
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Export failed'
          const is401 = message.includes('401')
          return Response.json(
            { error: message },
            { status: is401 ? 401 : 400 },
          )
        }
      },
    },
  },
})
