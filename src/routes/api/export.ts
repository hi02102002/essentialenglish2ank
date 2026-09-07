import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { buildApkg } from '@/server/anki'
import { assertAuthorized } from '@/server/auth'

const cardSchema = z.object({
  id: z.string(),
  selected: z.boolean(),
  word: z.string(),
  ipa: z.string(),
  vietnamese: z.string(),
  englishDefinition: z.string(),
  example: z.string(),
  imageQuery: z.string(),
  imageUrl: z.string().url(),
  wordAudioUrl: z.string().url(),
  exampleAudioUrl: z.string().url(),
  sourceUrl: z.string().url(),
})

const payloadSchema = z.object({
  deckName: z.string().min(1).max(120),
  cards: z.array(cardSchema).min(1).max(100),
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
