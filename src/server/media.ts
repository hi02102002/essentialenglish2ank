function extensionFor(contentType: string | null, fallback: string) {
  if (!contentType) return fallback
  if (contentType.includes('image/png')) return 'png'
  if (contentType.includes('image/webp')) return 'webp'
  if (contentType.includes('image/gif')) return 'gif'
  if (contentType.includes('image/jpeg')) return 'jpg'
  if (contentType.includes('image/svg')) return 'svg'
  if (contentType.includes('audio/mpeg')) return 'mp3'
  if (contentType.includes('audio/wav')) return 'wav'
  if (contentType.includes('audio/ogg')) return 'ogg'
  return fallback
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

export async function downloadMedia(url: string, fallbackExtension: string) {
  const isAudio = fallbackExtension === 'mp3' || fallbackExtension === 'wav'
  const isImage = !isAudio

  const response = await fetch(url, {
    headers: {
      'user-agent': BROWSER_UA,
      accept: isImage
        ? 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        : 'audio/*,*/*;q=0.8',
      referer: url.includes('youdao.com')
        ? 'https://dict.youdao.com/'
        : url.includes('bing.com') || url.includes('bing.net')
        ? 'https://www.bing.com/'
        : '',
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
