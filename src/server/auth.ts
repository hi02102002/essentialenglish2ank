import { createHash, timingSafeEqual } from 'node:crypto'

export function getExpectedSessionToken(): string | null {
  const requiredPassword = process.env.APP_PASSWORD?.trim()
  if (!requiredPassword) return null
  return createHash('sha256').update(`session:${requiredPassword}`).digest('hex')
}

export function isAuthorized(tokenOrPassword?: string | null): boolean {
  const requiredPassword = process.env.APP_PASSWORD?.trim()
  if (!requiredPassword) {
    return true
  }

  if (!tokenOrPassword) {
    return false
  }

  const expectedToken = getExpectedSessionToken()
  if (!expectedToken) {
    return true
  }

  const trimmed = tokenOrPassword.trim()
  const inputHash = createHash('sha256').update(trimmed).digest()
  const tokenHash = createHash('sha256').update(expectedToken).digest()

  if (timingSafeEqual(inputHash, tokenHash)) {
    return true
  }

  const passHash = createHash('sha256').update(requiredPassword).digest()
  return timingSafeEqual(inputHash, passHash)
}

export function assertAuthorized(tokenOrPassword?: string | null) {
  if (!isAuthorized(tokenOrPassword)) {
    const error = new Error('401 Unauthorized: Mật khẩu hoặc token truy cập không hợp lệ.')
    throw error
  }
}
