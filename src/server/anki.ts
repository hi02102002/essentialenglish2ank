import AnkiExport from 'anki-apkg-export'
import type { AnyAnkiCard, NoteCard, VocabularyCard } from '@/lib/types'
import { downloadMedia } from './media'
import { getYoudaoUnsignedVoiceUrl } from '@/lib/youdao'
import { getBingImageUrl, getBingAlternativeUrl } from '@/lib/bing-image'
import { getPosInfo } from '@/lib/pos'

function getAnkiExporter(): new (deckName: string) => AnkiExport {
  const mod: any = AnkiExport
  if (typeof mod === 'function') return mod
  if (typeof mod?.default === 'function') return mod.default
  if (typeof mod?.default?.default === 'function') return mod.default.default
  if (typeof mod?.Exporter === 'function') return mod.Exporter
  return mod
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function safeBaseName(value: string, index: number) {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `${String(index + 1).padStart(3, '0')}-${slug || 'card'}`
}

export const CARD_CSS = `
.card {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  text-align: center;
  font-size: 16px;
  background-color: var(--anki-bg, #ffffff);
  color: var(--anki-text, #0f172a);
}

:root {
  --anki-bg: #ffffff;
  --anki-text: #0f172a;
  --anki-muted: #64748b;
  --anki-box-bg: #f8fafc;
  --anki-box-border: #e2e8f0;
  --anki-box-text: #0f172a;
  --anki-box-desc: #334155;
  --anki-example-bg: #eff6ff;
  --anki-example-border: #3b82f6;
  --anki-example-text: #1e293b;
  --anki-note-bg: #f0fdf4;
  --anki-note-border: #22c55e;
  --anki-note-text: #166534;
  --anki-badge-vocab-bg: #e0f2fe;
  --anki-badge-vocab-text: #0369a1;
  --anki-badge-phrase-bg: #f3e8ff;
  --anki-badge-phrase-text: #7e22ce;
  --anki-badge-note-bg: #fef3c7;
  --anki-badge-note-text: #b45309;
}

/* Anki Dark Mode / Night Mode (Anki Desktop, AnkiDroid, AnkiMobile) */
.nightMode.card,
.nightMode .card,
.night_mode .card,
body.nightMode,
body.night_mode,
.nightMode,
.night_mode {
  background-color: #1e1e1e !important;
  color: #f8fafc !important;
  --anki-bg: #1e1e1e;
  --anki-text: #f8fafc;
  --anki-muted: #94a3b8;
  --anki-box-bg: #282a2e;
  --anki-box-border: #3f444e;
  --anki-box-text: #f8fafc;
  --anki-box-desc: #cbd5e1;
  --anki-example-bg: #1e293b;
  --anki-example-border: #60a5fa;
  --anki-example-text: #f1f5f9;
  --anki-note-bg: #143522;
  --anki-note-border: #4ade80;
  --anki-note-text: #bbf7d0;
  --anki-badge-vocab-bg: #075985;
  --anki-badge-vocab-text: #bae6fd;
  --anki-badge-phrase-bg: #581c87;
  --anki-badge-phrase-text: #e9d5ff;
  --anki-badge-note-bg: #78350f;
  --anki-badge-note-text: #fde68a;
}

@media (prefers-color-scheme: dark) {
  .card {
    background-color: #1e1e1e;
    color: #f8fafc;
  }
  :root {
    --anki-bg: #1e1e1e;
    --anki-text: #f8fafc;
    --anki-muted: #94a3b8;
    --anki-box-bg: #282a2e;
    --anki-box-border: #3f444e;
    --anki-box-text: #f8fafc;
    --anki-box-desc: #cbd5e1;
    --anki-example-bg: #1e293b;
    --anki-example-border: #60a5fa;
    --anki-example-text: #f1f5f9;
    --anki-note-bg: #143522;
    --anki-note-border: #4ade80;
    --anki-note-text: #bbf7d0;
    --anki-badge-vocab-bg: #075985;
    --anki-badge-vocab-text: #bae6fd;
    --anki-badge-phrase-bg: #581c87;
    --anki-badge-phrase-text: #e9d5ff;
    --anki-badge-note-bg: #78350f;
    --anki-badge-note-text: #fde68a;
  }
}

.anki-container {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  text-align: center;
  padding: 14px 10px;
  line-height: 1.5;
  max-width: 560px;
  margin: 0 auto;
  color: var(--anki-text, #0f172a);
}

.anki-word {
  font-size: 32px;
  font-weight: 700;
  color: var(--anki-text, #0f172a);
  margin: 10px 0 6px 0;
  line-height: 1.25;
}

.anki-ipa {
  font-size: 18px;
  color: var(--anki-muted, #64748b);
  margin: 4px 0 14px 0;
}

.anki-box {
  background: var(--anki-box-bg, #f8fafc);
  border: 1px solid var(--anki-box-border, #e2e8f0);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 14px;
  text-align: left;
}

.anki-vn {
  font-size: 18px;
  color: var(--anki-box-text, #0f172a);
  margin-bottom: 8px;
  font-weight: 600;
}

.anki-en {
  font-size: 15px;
  color: var(--anki-box-desc, #334155);
}

.anki-hint {
  font-size: 13px;
  color: var(--anki-muted, #64748b);
  margin-top: 6px;
  font-style: italic;
}

.anki-example-box {
  background: var(--anki-example-bg, #eff6ff);
  border-left: 4px solid var(--anki-example-border, #3b82f6);
  border-radius: 0 8px 8px 0;
  padding: 12px 16px;
  text-align: left;
}

.anki-example-text {
  font-size: 15px;
  color: var(--anki-example-text, #1e293b);
  font-style: italic;
}

.anki-note-vn {
  background: var(--anki-note-bg, #f0fdf4);
  border-left: 4px solid var(--anki-note-border, #22c55e);
  border-radius: 0 8px 8px 0;
  padding: 12px 16px;
  margin-bottom: 14px;
  text-align: left;
  font-size: 15px;
  color: var(--anki-note-text, #166534);
}

.anki-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
  line-height: normal;
}

.anki-badge-vocab {
  background: var(--anki-badge-vocab-bg, #e0f2fe);
  color: var(--anki-badge-vocab-text, #0369a1);
}

.anki-badge-phrase {
  background: var(--anki-badge-phrase-bg, #f3e8ff);
  color: var(--anki-badge-phrase-text, #7e22ce);
}

.anki-badge-note {
  background: var(--anki-badge-note-bg, #fef3c7);
  color: var(--anki-badge-note-text, #b45309);
}

.anki-badge-pos {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
}

.anki-pos-adj {
  background: #fef3c7;
  color: #b45309;
}
.anki-pos-adv {
  background: #ccfbf1;
  color: #0f766e;
}
.anki-pos-noun {
  background: #e0f2fe;
  color: #0369a1;
}
.anki-pos-verb {
  background: #dcfce7;
  color: #15803d;
}
.anki-pos-phrase {
  background: #f3e8ff;
  color: #7e22ce;
}
.anki-pos-phrv {
  background: #e0e7ff;
  color: #4338ca;
}
.anki-pos-idiom {
  background: #fce7f3;
  color: #be185d;
}
.anki-pos-prep, .anki-pos-default {
  background: #f1f5f9;
  color: #475569;
}

.anki-chunks-box {
  margin-top: 12px;
  background: var(--anki-box-bg, #f8fafc);
  border: 1px solid var(--anki-box-border, #e2e8f0);
  border-radius: 8px;
  padding: 10px 14px;
  text-align: left;
}

.anki-chunks-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--anki-muted, #475569);
  margin-bottom: 6px;
}

.anki-chunks-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.6;
}

.anki-chunk-text {
  font-weight: 600;
  color: #0369a1;
}

.anki-chunk-meaning {
  color: var(--anki-muted, #475569);
}

.anki-chunk-audio {
  display: inline-block;
  margin: 0 4px;
  vertical-align: middle;
}

/* Explicit Night Mode overrides with !important */
.nightMode .anki-pos-adj, .night_mode .anki-pos-adj, body.nightMode .anki-pos-adj, body.night_mode .anki-pos-adj {
  background: #78350f !important;
  color: #fde68a !important;
}
.nightMode .anki-pos-adv, .night_mode .anki-pos-adv, body.nightMode .anki-pos-adv, body.night_mode .anki-pos-adv {
  background: #134e4a !important;
  color: #5eead4 !important;
}
.nightMode .anki-pos-noun, .night_mode .anki-pos-noun, body.nightMode .anki-pos-noun, body.night_mode .anki-pos-noun {
  background: #075985 !important;
  color: #bae6fd !important;
}
.nightMode .anki-pos-verb, .night_mode .anki-pos-verb, body.nightMode .anki-pos-verb, body.night_mode .anki-pos-verb {
  background: #14532d !important;
  color: #86efac !important;
}
.nightMode .anki-pos-phrase, .night_mode .anki-pos-phrase, body.nightMode .anki-pos-phrase, body.night_mode .anki-pos-phrase {
  background: #581c87 !important;
  color: #e9d5ff !important;
}
.nightMode .anki-pos-phrv, .night_mode .anki-pos-phrv, body.nightMode .anki-pos-phrv, body.night_mode .anki-pos-phrv {
  background: #312e81 !important;
  color: #c7d2fe !important;
}
.nightMode .anki-pos-idiom, .night_mode .anki-pos-idiom, body.nightMode .anki-pos-idiom, body.night_mode .anki-pos-idiom {
  background: #831843 !important;
  color: #fbcfe8 !important;
}
.nightMode .anki-pos-prep, .night_mode .anki-pos-prep, .nightMode .anki-pos-default, .night_mode .anki-pos-default, body.nightMode .anki-pos-prep, body.night_mode .anki-pos-prep {
  background: #334155 !important;
  color: #e2e8f0 !important;
}

.nightMode .anki-word,
.night_mode .anki-word,
body.nightMode .anki-word,
body.night_mode .anki-word {
  color: #f8fafc !important;
}

.nightMode .anki-ipa,
.night_mode .anki-ipa,
body.nightMode .anki-ipa,
body.night_mode .anki-ipa,
.nightMode .anki-hint,
.night_mode .anki-hint,
body.nightMode .anki-hint,
body.night_mode .anki-hint {
  color: #94a3b8 !important;
}

.nightMode .anki-box,
.night_mode .anki-box,
body.nightMode .anki-box,
body.night_mode .anki-box {
  background: #282a2e !important;
  border-color: #3f444e !important;
}

.nightMode .anki-vn,
.night_mode .anki-vn,
body.nightMode .anki-vn,
body.night_mode .anki-vn {
  color: #f8fafc !important;
}

.nightMode .anki-en,
.night_mode .anki-en,
body.nightMode .anki-en,
body.night_mode .anki-en {
  color: #cbd5e1 !important;
}

.nightMode .anki-example-box,
.night_mode .anki-example-box,
body.nightMode .anki-example-box,
body.night_mode .anki-example-box {
  background: #1e293b !important;
  border-left-color: #60a5fa !important;
}

.nightMode .anki-example-text,
.night_mode .anki-example-text,
body.nightMode .anki-example-text,
body.night_mode .anki-example-text {
  color: #f1f5f9 !important;
}

.nightMode .anki-note-vn,
.night_mode .anki-note-vn,
body.nightMode .anki-note-vn,
body.night_mode .anki-note-vn {
  background: #143522 !important;
  border-left-color: #4ade80 !important;
  color: #bbf7d0 !important;
}

.nightMode .anki-badge-vocab,
.night_mode .anki-badge-vocab,
body.nightMode .anki-badge-vocab,
body.night_mode .anki-badge-vocab {
  background: #075985 !important;
  color: #bae6fd !important;
}

.nightMode .anki-badge-phrase,
.night_mode .anki-badge-phrase,
body.nightMode .anki-badge-phrase,
body.night_mode .anki-badge-phrase {
  background: #581c87 !important;
  color: #e9d5ff !important;
}

.nightMode .anki-badge-note,
.night_mode .anki-badge-note,
body.nightMode .anki-badge-note,
body.night_mode .anki-badge-note {
  background: #78350f !important;
  color: #fde68a !important;
}

.nightMode .anki-chunks-box,
.night_mode .anki-chunks-box,
body.nightMode .anki-chunks-box,
body.night_mode .anki-chunks-box {
  background: #1e293b !important;
  border-color: #334155 !important;
}

.nightMode .anki-chunks-title,
.night_mode .anki-chunks-title,
body.nightMode .anki-chunks-title,
body.night_mode .anki-chunks-title {
  color: #94a3b8 !important;
}

.nightMode .anki-chunks-list,
.night_mode .anki-chunks-list,
body.nightMode .anki-chunks-list,
body.night_mode .anki-chunks-list {
  color: #e2e8f0 !important;
}

.nightMode .anki-chunk-text,
.night_mode .anki-chunk-text,
body.nightMode .anki-chunk-text,
body.night_mode .anki-chunk-text {
  color: #38bdf8 !important;
}

.nightMode .anki-chunk-meaning,
.night_mode .anki-chunk-meaning,
body.nightMode .anki-chunk-meaning,
body.night_mode .anki-chunk-meaning {
  color: #94a3b8 !important;
}
`

async function addVocabularyCard(apkg: AnkiExport, card: VocabularyCard, index: number) {
  const base = safeBaseName(card.word, index)
  let imageTag = ''
  let wordAudioTag = ''
  let exampleAudioTag = ''

  const targetImageUrl = card.imageUrl || (card.imageQuery ? getBingImageUrl(card.imageQuery) : '')
  if (targetImageUrl) {
    try {
      const image = await downloadMedia(targetImageUrl, 'jpg')
      const filename = `${base}.${image.extension}`
      apkg.addMedia(filename, image.buffer)
      imageTag = `<img src="${filename}" alt="${escapeHtml(card.word)}" style="max-height:220px;max-width:100%;object-fit:cover;border-radius:8px">`
    } catch {
      // Fallback: If primary image URL failed (e.g. 404 or blocked), try fetching via Bing alternative or query
      const fallbackUrl = card.imageQuery
        ? targetImageUrl !== getBingAlternativeUrl(card.imageQuery)
          ? getBingAlternativeUrl(card.imageQuery)
          : getBingImageUrl(card.imageQuery)
        : ''

      if (fallbackUrl) {
        try {
          const image = await downloadMedia(fallbackUrl, 'jpg')
          const filename = `${base}.${image.extension}`
          apkg.addMedia(filename, image.buffer)
          imageTag = `<img src="${filename}" alt="${escapeHtml(card.word)}" style="max-height:220px;max-width:100%;object-fit:cover;border-radius:8px">`
        } catch {
          imageTag = ''
        }
      } else {
        imageTag = ''
      }
    }
  }

  const targetWordAudioUrl = card.wordAudioUrl
    ? card.wordAudioUrl.replace(/([?&]type=)1\b/, '$12')
    : getYoudaoUnsignedVoiceUrl(card.word, 2)

  try {
    let audio
    try {
      audio = await downloadMedia(targetWordAudioUrl, 'mp3')
    } catch {
      audio = await downloadMedia(getYoudaoUnsignedVoiceUrl(card.word, 2), 'mp3')
    }
    const filename = `${base}-word.${audio.extension}`
    apkg.addMedia(filename, audio.buffer)
    wordAudioTag = `[sound:${filename}]`
  } catch {
    wordAudioTag = ''
  }

  const targetExampleAudioUrl = card.exampleAudioUrl
    ? card.exampleAudioUrl.replace(/([?&]type=)1\b/, '$12')
    : getYoudaoUnsignedVoiceUrl(card.example, 2)

  try {
    let audio
    try {
      audio = await downloadMedia(targetExampleAudioUrl, 'mp3')
    } catch {
      audio = await downloadMedia(getYoudaoUnsignedVoiceUrl(card.example, 2), 'mp3')
    }
    const filename = `${base}-example.${audio.extension}`
    apkg.addMedia(filename, audio.buffer)
    exampleAudioTag = `[sound:${filename}]`
  } catch {
    exampleAudioTag = ''
  }

  const chunkAudioTags: string[] = []
  if (Array.isArray(card.chunks) && card.chunks.length > 0) {
    for (let cIdx = 0; cIdx < card.chunks.length; cIdx++) {
      const chunk = card.chunks[cIdx]
      if (chunk?.text) {
        try {
          const chunkTargetAudio = chunk.audioUrl
            ? chunk.audioUrl.replace(/([?&]type=)1\b/, '$12')
            : getYoudaoUnsignedVoiceUrl(chunk.text, 2)
          const audio = await downloadMedia(chunkTargetAudio, 'mp3')
          const filename = `${base}-chunk-${cIdx + 1}.${audio.extension}`
          apkg.addMedia(filename, audio.buffer)
          chunkAudioTags.push(`[sound:${filename}]`)
        } catch {
          chunkAudioTags.push('')
        }
      } else {
        chunkAudioTags.push('')
      }
    }
  }

  const chunksHtml =
    Array.isArray(card.chunks) && card.chunks.length > 0
      ? `
      <div class="anki-chunks-box">
        <div class="anki-chunks-title">🧩 <b>Lexical Chunks (Cụm từ đi kèm):</b></div>
        <ul class="anki-chunks-list">
          ${card.chunks
            .map(
              (c, idx) =>
                `<li><span class="anki-chunk-text">${escapeHtml(c.text)}</span>${
                  chunkAudioTags[idx] ? ` <span class="anki-chunk-audio">${chunkAudioTags[idx]}</span>` : ''
                }${
                  c.meaningVi ? ` <span class="anki-chunk-meaning">— ${escapeHtml(c.meaningVi)}</span>` : ''
                }</li>`,
            )
            .join('')}
        </ul>
      </div>`
      : ''

  const isPhrase = card.kind === 'phrase' || card.word.includes(' ')
  const posInfo = getPosInfo(card.partOfSpeech || (isPhrase ? 'phrase' : 'noun'))
  const badgeHtml = `<div class="anki-badge ${posInfo.ankiClass}">${escapeHtml(posInfo.labelVi)} • ${escapeHtml(posInfo.abbr)}</div>`

  const front = `
    <style>${CARD_CSS}</style>
    <div class="anki-container">
      ${badgeHtml}
      ${imageTag ? `<div style="max-width:360px;margin:0 auto 16px">${imageTag}</div>` : ''}
      <div class="anki-word">${escapeHtml(card.word)}</div>
      <div style="margin-top:12px">${wordAudioTag}</div>
    </div>`

  const back = `
    <style>${CARD_CSS}</style>
    <div class="anki-container">
      <div>
        ${badgeHtml}
        <div class="anki-word">${escapeHtml(card.word)}</div>
        <div class="anki-ipa">${escapeHtml(card.ipa)}</div>
      </div>
      <div class="anki-box">
        <div class="anki-vn"><b>🇻🇳</b> ${escapeHtml(card.vietnamese)}</div>
        <div class="anki-en"><b>English:</b> ${escapeHtml(card.englishDefinition)}</div>
        ${card.hint ? `<div class="anki-hint"><b>💡 Textbook Note:</b> <i>${escapeHtml(card.hint)}</i></div>` : ''}
      </div>
      ${chunksHtml}
      <div class="anki-example-box">
        <div class="anki-example-text"><i>${escapeHtml(card.example)}</i> ${exampleAudioTag}</div>
      </div>
    </div>`

  const tag = card.unitNumber ? `unit-${String(card.unitNumber).padStart(2, '0')}` : 'vocabulary'
  const tags = ['vocabulary', tag]
  if (isPhrase) tags.push('phrases')
  if (posInfo.code && posInfo.code !== 'other') tags.push(`pos-${posInfo.code.replace(/\s+/g, '-')}`)
  apkg.addCard(front, back, { tags })
}

async function addNoteCard(apkg: AnkiExport, card: NoteCard, index: number) {
  const base = safeBaseName(`note-${card.title}`, index)
  let exampleAudioTag = ''

  if (card.example) {
    const targetExampleAudioUrl = card.exampleAudioUrl
      ? card.exampleAudioUrl.replace(/([?&]type=)1\b/, '$12')
      : getYoudaoUnsignedVoiceUrl(card.example, 2)

    try {
      let audio
      try {
        audio = await downloadMedia(targetExampleAudioUrl, 'mp3')
      } catch {
        audio = await downloadMedia(getYoudaoUnsignedVoiceUrl(card.example, 2), 'mp3')
      }
      const filename = `${base}-example.${audio.extension}`
      apkg.addMedia(filename, audio.buffer)
      exampleAudioTag = `[sound:${filename}]`
    } catch {
      exampleAudioTag = ''
    }
  }

  const front = `
    <style>${CARD_CSS}</style>
    <div class="anki-container" style="padding:24px 14px">
      <div class="anki-badge anki-badge-note">LANGUAGE NOTE</div>
      <div class="anki-word" style="font-size:26px">${escapeHtml(card.title)}</div>
      <div class="anki-ipa" style="margin-top:10px">Key phrases &amp; usage rules</div>
    </div>`

  const back = `
    <style>${CARD_CSS}</style>
    <div class="anki-container">
      <div class="anki-badge anki-badge-note">LANGUAGE NOTE</div>
      <div class="anki-word" style="font-size:24px;margin-bottom:14px">${escapeHtml(card.title)}</div>
      
      <div class="anki-box">
        <div style="font-size:12px;font-weight:700;color:var(--anki-muted,#64748b);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">
          Important phrases &amp; expressions:
        </div>
        <ul style="margin:0;padding-left:22px;color:var(--anki-box-text,#0f172a)">
          ${card.content.map((item) => `<li style="margin-bottom:6px">${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>

      ${
        card.vietnameseExplanation
          ? `
      <div class="anki-note-vn">
        <div><b>🇻🇳 Giải thích:</b> ${escapeHtml(card.vietnameseExplanation)}</div>
      </div>`
          : ''
      }

      ${
        card.example
          ? `
      <div class="anki-example-box">
        <div style="font-size:12px;font-weight:700;color:var(--anki-example-border,#3b82f6);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
          Example in context:
        </div>
        <div class="anki-example-text"><i>${escapeHtml(card.example)}</i> ${exampleAudioTag}</div>
      </div>`
          : ''
      }
    </div>`

  const tag = card.unitNumber ? `unit-${String(card.unitNumber).padStart(2, '0')}` : 'notes'
  apkg.addCard(front, back, { tags: ['language-notes', tag] })
}

export async function buildApkg(deckName: string, cards: AnyAnkiCard[]) {
  const Exporter = getAnkiExporter()
  const apkg = new (Exporter as any)(deckName, { css: CARD_CSS })
  for (const [index, card] of cards.entries()) {
    if (card.type === 'note') {
      await addNoteCard(apkg, card, index)
    } else {
      await addVocabularyCard(apkg, card, index)
    }
  }
  return apkg.save()
}

