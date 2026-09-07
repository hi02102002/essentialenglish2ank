function extensionFor(contentType: string | null, fallback: string) {
  if (!contentType) return fallback
  if (contentType.includes('image/png')) return 'png'
  if (contentType.includes('image/webp')) return 'webp'
  if (contentType.includes('image/gif')) return 'gif'
  if (contentType.includes('image/jpeg')) return 'jpg'
  if (contentType.includes('audio/mpeg')) return 'mp3'
  if (contentType.includes('audio/wav')) return 'wav'
  if (contentType.includes('audio/ogg')) return 'ogg'
  return fallback
}

export async function downloadMedia(url: string, fallbackExtension: string) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 AnkiDeckBuilder/1.0',
      referer: url.includes('youdao.com') ? 'https://dict.youdao.com/' : 'https://www.bing.com/',
    },
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) throw new Error(`Media request failed (${response.status})`)

  const buffer = Buffer.from(await response.arrayBuffer())
  return {
    buffer,
    extension: extensionFor(response.headers.get('content-type'), fallbackExtension),
  }
}
