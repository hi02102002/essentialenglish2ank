export function getBingImageUrl(query: string) {
  const params = new URLSearchParams({
    q: query,
    c: '7',
    rs: '1',
    p: '0',
    o: '5',
    dpr: '2',
    pid: '1.7',
    mkt: 'en-WW',
    cc: 'VN',
    setlang: 'en',
    adlt: 'moderate',
    t: '1',
  })

  return `https://th.bing.com/th?${params.toString()}`
}
