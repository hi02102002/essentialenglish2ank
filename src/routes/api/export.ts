import { randomUUID } from 'node:crypto'
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
  maskedWord: z.string().optional().default(''),
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
        ipa: z.string().optional().default(''),
        meaningVi: z.string().optional().default(''),
        englishDefinition: z.string().optional().default(''),
        example: z.string().optional().default(''),
        imageQuery: z.string().optional().default(''),
        imageUrl: z.string().optional().default(''),
        partOfSpeech: z.string().optional().default('phrase'),
        audioUrl: z.string().optional().default(''),
        exampleAudioUrl: z.string().optional().default(''),
      }).passthrough(),
    )
    .optional()
    .default([]),
  imageQuery: z.string().optional().default(''),
  imageUrl: z.string().optional().default(''),
  wordAudioUrl: z.string().optional().default(''),
  exampleAudioUrl: z.string().optional().default(''),
  sourceUrl: z.string().optional().default(''),
}).passthrough()

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
}).passthrough()

const cardSchema = z.union([noteCardSchema, vocabCardSchema])

const payloadSchema = z.object({
  deckName: z.string().min(1).max(200),
  cards: z.array(cardSchema).min(1).max(1000),
  token: z.string().optional(),
}).passthrough()

function filenameFor(deckName: string) {
  const safe = deckName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return `${safe || 'anki-deck'}.apkg`
}

type ExportJob = {
  id: string
  deckName: string
  status: 'processing' | 'completed' | 'error'
  total: number
  processed: number
  percent: number
  createdAt: number
  data?: Uint8Array
  error?: string
}

const exportJobs = new Map<string, ExportJob>()
const JOB_TTL_MS = 15 * 60 * 1000

function cleanupExpiredJobs() {
  const now = Date.now()
  for (const [id, job] of exportJobs.entries()) {
    if (now - job.createdAt > JOB_TTL_MS) {
      exportJobs.delete(id)
    }
  }
}

export const Route = createFileRoute('/api/export')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const jobId = url.searchParams.get('jobId') || url.searchParams.get('id')
          if (!jobId) {
            return Response.json({ error: 'Missing jobId parameter' }, { status: 400 })
          }

          const job = exportJobs.get(jobId)
          if (!job) {
            return Response.json(
              { error: 'Export job not found or has expired' },
              { status: 404 },
            )
          }

          const isDownload =
            url.searchParams.get('download') === '1' ||
            url.searchParams.get('download') === 'true'

          if (isDownload) {
            if (job.status !== 'completed' || !job.data) {
              return Response.json(
                { error: 'File is not ready yet', status: job.status },
                { status: 400 },
              )
            }

            return new Response(job.data as any, {
              headers: {
                'content-type': 'application/octet-stream',
                'content-disposition': `attachment; filename="${filenameFor(job.deckName)}"`,
                'cache-control': 'no-store',
              },
            })
          }

          return Response.json({
            jobId: job.id,
            status: job.status,
            processed: job.processed,
            total: job.total,
            percent: job.percent,
            error: job.error,
          })
        } catch (error: any) {
          console.error('[Export GET API Error]:', error)
          return Response.json(
            { error: error?.message || 'Failed to check export job' },
            { status: 500 },
          )
        }
      },
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

          const url = new URL(request.url)
          const isSync = url.searchParams.get('mode') === 'sync'

          if (isSync) {
            const output = await buildApkg(payload.deckName, cards)
            const binaryData = new Uint8Array(output as any)

            return new Response(binaryData, {
              headers: {
                'content-type': 'application/octet-stream',
                'content-disposition': `attachment; filename="${filenameFor(payload.deckName)}"`,
                'cache-control': 'no-store',
              },
            })
          }

          // Asynchronous background job mode (default) to eliminate proxy timeouts
          cleanupExpiredJobs()
          const jobId = randomUUID()
          const job: ExportJob = {
            id: jobId,
            deckName: payload.deckName,
            status: 'processing',
            total: cards.length,
            processed: 0,
            percent: 0,
            createdAt: Date.now(),
          }
          exportJobs.set(jobId, job)

          // Run deck compilation in background
          buildApkg(payload.deckName, cards, (processed, total) => {
            const currentJob = exportJobs.get(jobId)
            if (currentJob && currentJob.status === 'processing') {
              currentJob.processed = processed
              currentJob.total = total
              currentJob.percent = Math.round((processed / total) * 100)
            }
          })
            .then((output) => {
              const currentJob = exportJobs.get(jobId)
              if (currentJob) {
                currentJob.status = 'completed'
                currentJob.processed = cards.length
                currentJob.percent = 100
                currentJob.data = new Uint8Array(output as any)
              }
            })
            .catch((err) => {
              console.error(`[Export Job ${jobId} Error]:`, err)
              const currentJob = exportJobs.get(jobId)
              if (currentJob) {
                currentJob.status = 'error'
                currentJob.error = err?.message || 'Xuất file Anki thất bại'
              }
            })

          // Respond immediately in milliseconds
          return Response.json({
            jobId,
            status: 'processing',
            total: cards.length,
          })
        } catch (error: any) {
          console.error('[Export API Error]:', error)
          let message = 'Export failed'
          if (error instanceof z.ZodError) {
            message = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
          } else if (error?.message) {
            message = error.message
          } else if (typeof error === 'string') {
            message = error
          }

          const is401 = message.includes('401') || message.toLowerCase().includes('unauthorized')
          return Response.json(
            { error: message },
            { status: is401 ? 401 : 400 },
          )
        }
      },
    },
  },
})
