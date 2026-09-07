import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { buildApkg } from '@/server/anki'

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
          const payload = payloadSchema.parse(await request.json())
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
          return Response.json(
            { error: error instanceof Error ? error.message : 'Export failed' },
            { status: 400 },
          )
        }
      },
    },
  },
})
