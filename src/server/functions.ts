import { createServerFn } from '@tanstack/react-start'
import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { analyzeLessonUrl } from './lesson'
import { enrichVocabulary } from './ai'
import { assertAuthorized, isAuthorized } from './auth'

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
      url: z.string().url(),
      token: z.string().optional(),
    }),
  )
  .handler(({ data }) => {
    assertAuthorized(data.token)
    return analyzeLessonUrl(data.url)
  })

export const generateVocabulary = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      words: z.array(z.string().min(1).max(100)).min(1).max(60),
      token: z.string().optional(),
    }),
  )
  .handler(({ data }) => {
    assertAuthorized(data.token)
    return enrichVocabulary(data.words)
  })
