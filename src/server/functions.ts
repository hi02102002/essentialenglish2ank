import { createServerFn } from '@tanstack/react-start'
import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { analyzeLessonUrl } from './lesson'
import {
  enrichVocabulary,
  enrichNotes,
  generateLessonChunks,
  resolveAiConfig,
} from './ai'
import { AI_PROVIDERS } from '@/lib/ai-providers'
import { assertAuthorized, isAuthorized } from './auth'

const aiRuntimeConfigSchema = z
  .object({
    provider: z.enum(['ltn', 'openai', 'custom']).optional(),
    model: z.string().optional(),
    baseURL: z.string().optional(),
    apiKey: z.string().optional(),
  })
  .optional()

export const getAiProvidersConfig = createServerFn({ method: 'GET' }).handler(
  () => {
    const active = resolveAiConfig()
    const rawUrl = process.env.OPENAI_URL || process.env.OPENAI_BASE_URL || ''
    const isLtnUrl = /ltnproxy\.com/i.test(rawUrl)
    return {
      providers: AI_PROVIDERS,
      activeProviderId: active.providerId,
      serverConfig: {
        hasLtnKey: Boolean(process.env.LTN_API_KEY || (isLtnUrl && process.env.OPENAI_API_KEY)),
        hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY && !isLtnUrl),
        hasCustomKey: Boolean(process.env.CUSTOM_AI_KEY),
        defaultModel: active.model,
        defaultBaseURL: active.baseURL,
      },
    }
  },
)

export const checkAuthRequirement = createServerFn({ method: 'GET' }).handler(
  () => {
    const requiredPassword = process.env.APP_PASSWORD?.trim()
    return {
      required: Boolean(requiredPassword && requiredPassword.length > 0),
    }
  },
)

export const verifyPassword = createServerFn({ method: 'POST' })
  .validator(z.object({ password: z.string() }))
  .handler(({ data }) => {
    const requiredPassword = process.env.APP_PASSWORD?.trim()
    if (!requiredPassword) {
      return { success: true, token: 'no-auth-required' }
    }

    const inputHash = createHash('sha256').update(data.password.trim()).digest()
    const targetHash = createHash('sha256').update(requiredPassword).digest()

    const isValid = timingSafeEqual(inputHash, targetHash)
    if (!isValid) {
      return { success: false, message: 'Mật khẩu không chính xác. Vui lòng thử lại!' }
    }

    const sessionToken = createHash('sha256')
      .update(`session:${requiredPassword}`)
      .digest('hex')

    return { success: true, token: sessionToken }
  })

export const verifySessionToken = createServerFn({ method: 'POST' })
  .validator(z.object({ token: z.string() }))
  .handler(({ data }) => {
    return { valid: isAuthorized(data.token) }
  })

export const analyzeLesson = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      url: z.string().optional(),
      bookSlug: z.string().optional(),
      unitNumber: z.number().int().min(1).max(200).optional(),
      token: z.string().optional(),
    }),
  )
  .handler(({ data }) => {
    assertAuthorized(data.token)
    return analyzeLessonUrl({
      url: data.url,
      bookSlug: data.bookSlug,
      unitNumber: data.unitNumber,
    })
  })

export const generateVocabulary = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      words: z.array(z.string().min(1).max(300)).min(1).max(500),
      topic: z.string().optional(),
      phrases: z.array(z.string().min(1).max(300)).optional(),
      token: z.string().optional(),
      aiConfig: aiRuntimeConfigSchema,
    }),
  )
  .handler(async ({ data }) => {
    assertAuthorized(data.token)
    const result = await enrichVocabulary(
      data.words,
      data.topic,
      data.phrases,
      data.aiConfig,
    )
    return result || []
  })

export const generateNotes = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      notes: z
        .array(
          z.object({
            title: z.string(),
            content: z.array(z.string()),
          }),
        )
        .min(1)
        .max(50),
      token: z.string().optional(),
      aiConfig: aiRuntimeConfigSchema,
    }),
  )
  .handler(async ({ data }) => {
    assertAuthorized(data.token)
    const result = await enrichNotes(data.notes, data.aiConfig)
    return result || []
  })

export const generateChunks = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      words: z.array(z.string().min(1).max(300)).min(1).max(200),
      storyText: z.string().optional(),
      topic: z.string().optional(),
      token: z.string().optional(),
      aiConfig: aiRuntimeConfigSchema,
    }),
  )
  .handler(async ({ data }) => {
    assertAuthorized(data.token)
    const result = await generateLessonChunks(
      data.words,
      data.storyText,
      data.topic,
      data.aiConfig,
    )
    return result || []
  })


