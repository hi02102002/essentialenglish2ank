export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function stemWord(w: string): string {
  return w
    .toLowerCase()
    .trim()
    .replace(/(?:ing|ies|es|ed|s)$/i, '')
}

export function phraseContainsWord(phrase: string, word: string): boolean {
  const pLower = phrase.toLowerCase().trim()
  const wLower = word.toLowerCase().trim()
  if (pLower === wLower) return true

  // Match whole word with regular plural or inflection suffixes
  const regexExact = new RegExp(`\\b${escapeRegExp(wLower)}(?:s|es|ed|ing)?\\b`, 'i')
  if (regexExact.test(pLower)) return true

  // Match stem if stem length >= 3
  const wStem = stemWord(wLower)
  if (wStem.length >= 3) {
    const regexStem = new RegExp(`\\b${escapeRegExp(wStem)}[a-z]*\\b`, 'i')
    if (regexStem.test(pLower)) return true
  }
  return false
}

export function findMatchingWordForPhrase(
  phrase: string,
  candidateWords: string[],
): string | undefined {
  if (!phrase || !candidateWords.length) return undefined
  const pClean = phrase
    .toLowerCase()
    .replace(/^(?:to\s+(?:be\s+)?|a\s+|an\s+|the\s+|as\s+)/, '')
    .trim()

  // 1. If phrase begins with one of candidate words or stem (e.g. "shake hands with..." -> "shake")
  const firstWord = pClean.split(/\s+/)[0]
  for (const w of candidateWords) {
    const wLower = w.toLowerCase()
    if (wLower === firstWord || stemWord(wLower) === stemWord(firstWord)) {
      return w
    }
  }

  // 2. Check candidate words in candidateWords that match anywhere inside the phrase
  for (const w of candidateWords) {
    if (phraseContainsWord(phrase, w)) {
      return w
    }
  }

  return undefined
}
