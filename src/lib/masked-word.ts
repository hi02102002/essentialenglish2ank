/**
 * Generate a masked word pattern like "ov_r__e" for active recall typing.
 * Masks letters with underscores while revealing key scaffold characters.
 * E.g.:
 * - "overcome" -> "ov_r__e"
 * - "advantage" -> "ad_a__a_e"
 * - "exhausted" -> "ex__u_t_d"
 * - "take advantage of" -> "t__e ad_a__a_e _f"
 */
export function generateMaskedWord(text: string): string {
  if (!text) return ''

  // Split by words/whitespace/delimiters to preserve punctuation and spacing
  return text
    .split(/(\s+|[-'/])/)
    .map((segment) => {
      if (/^(\s+|[-'/])$/.test(segment)) return segment

      const chars = Array.from(segment)
      const len = chars.length
      if (len <= 1) return chars[0]
      if (len === 2) return `${chars[0]}_`
      if (len === 3) return `${chars[0]}_${chars[2]}`
      if (len === 4) return `${chars[0]}__${chars[3]}`
      if (len === 5) return `${chars[0]}_${chars[2]}_${chars[4]}`
      if (len === 6) return `${chars[0]}${chars[1]}__${chars[4]}_`
      if (len === 7) return `${chars[0]}${chars[1]}_${chars[3]}__${chars[6]}`

      // For 8+ letters (like "overcome", len 8):
      // Target pattern: "ov_r__e"
      // Reveals: index 0 (o), index 1 (v), index 3 (r), index len - 1 (e).
      // Masks: index 2 (_), 4 (_), 5 (_), 6 (_).
      const revealed = new Set<number>([0, 1, Math.floor(len * 0.4), len - 1])
      if (len >= 10) {
        revealed.add(Math.floor(len * 0.65))
      }

      return chars
        .map((ch, idx) => {
          // If character is not an alphanumeric letter, preserve it
          if (!/[a-zA-Z0-9]/.test(ch)) return ch
          return revealed.has(idx) ? ch : '_'
        })
        .join('')
    })
    .join('')
}

/**
 * Format masked word with spaces for high legibility in Anki display.
 * E.g. "ov_r__e" -> "o v _ r _ _ e", "t__e _f" -> "t _ _ e   _ f"
 */
export function formatSpacedMask(masked: string): string {
  if (!masked) return ''
  return masked
    .split(' ')
    .map((word) => Array.from(word).join(' '))
    .join('   ')
}

/**
 * Check if user typed input matches the target word/phrase.
 */
export function isWordMatch(typed: string, target: string): boolean {
  if (!typed || !target) return false
  const cleanTyped = typed.trim().toLowerCase().replace(/\s+/g, ' ')
  const cleanTarget = target.trim().toLowerCase().replace(/\s+/g, ' ')
  return cleanTyped === cleanTarget
}
