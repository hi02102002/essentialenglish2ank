import assert from 'node:assert/strict'
import test from 'node:test'
import { OPENAI_CLIENT_OPTIONS } from './ai-client-config'

test('AI requests fail before the reverse proxy timeout without retries', () => {
  assert.equal(OPENAI_CLIENT_OPTIONS.timeout, 70_000)
  assert.equal(OPENAI_CLIENT_OPTIONS.maxRetries, 0)
})
