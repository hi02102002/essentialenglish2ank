import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { analyzeLessonUrl } from './lesson'
import { enrichVocabulary } from './ai'

export const analyzeLesson = createServerFn({ method: 'POST' })
  .validator(z.object({ url: z.string().url() }))
  .handler(({ data }) => analyzeLessonUrl(data.url))

export const generateVocabulary = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      words: z.array(z.string().min(1).max(100)).min(1).max(60),
    }),
  )
  .handler(({ data }) => enrichVocabulary(data.words))
