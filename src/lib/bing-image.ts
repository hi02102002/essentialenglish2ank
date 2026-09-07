export function cleanImageQuery(query: string): string {
  if (!query) return ''
  return query
    .replace(/[()\[\]{}"']/g, ' ')
    .replace(/[+&/\\#@!?,:;~^`|<>=*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getBingImageUrl(query: string, seed: number = 0): string {
  const cleaned = cleanImageQuery(query) || query.trim() || 'english vocabulary'
  const params = new URLSearchParams({
    q: cleaned,
    c: '7',
    rs: '1',
    p: String(seed || 0),
    o: '5',
    dpr: '2',
    pid: '1.7',
    mkt: 'en-WW',
    cc: 'VN',
    setlang: 'en',
    adlt: 'moderate',
    t: '1',
  })

  if (seed > 0) {
    params.set('_cb', String(seed))
  }

  return `https://th.bing.com/th?${params.toString()}`
}

export function getBingAlternativeUrl(query: string, seed: number = 0): string {
  const cleaned = cleanImageQuery(query) || query.trim() || 'english vocabulary'
  const params = new URLSearchParams({
    q: cleaned,
    w: '480',
    h: '360',
    c: '7',
    rs: '1',
    p: String(seed || 0),
  })

  if (seed > 0) {
    params.set('_cb', String(seed))
  }

  return `https://tse1.mm.bing.net/th?${params.toString()}`
}
