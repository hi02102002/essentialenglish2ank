import AnkiExport from 'anki-apkg-export'
import type { AnyAnkiCard, NoteCard, VocabularyCard } from '@/lib/types'
import { downloadMedia } from './media'
import { getYoudaoUnsignedVoiceUrl } from '@/lib/youdao'
import { getBingImageUrl, getBingAlternativeUrl } from '@/lib/bing-image'
import { getPosInfo } from '@/lib/pos'
import { generateMaskedWord, formatSpacedMask } from '@/lib/masked-word'

function patchExporterPrototype(proto: any) {
  if (!proto || proto._stmtFreePatched) return
  proto._stmtFreePatched = true

  proto._update = function (query: string, obj: any) {
    const stmt = this.db.prepare(query)
    try {
      return stmt.getAsObject(obj)
    } finally {
      stmt.free()
    }
  }

  proto._getId = function (table: string, col: string, ts: number) {
    const query = `SELECT ${col} from ${table} WHERE ${col} >= :ts ORDER BY ${col} DESC LIMIT 1`
    const stmt = this.db.prepare(query)
    try {
      const rowObj = stmt.getAsObject({ ':ts': ts })
      return rowObj[col] ? +rowObj[col] + 1 : ts
    } finally {
      stmt.free()
    }
  }

  proto._getNoteId = function (guid: string, ts: number) {
    const query = `SELECT id from notes WHERE guid = :guid ORDER BY id DESC LIMIT 1`
    const stmt = this.db.prepare(query)
    try {
      const rowObj = stmt.getAsObject({ ':guid': guid })
      return rowObj.id || this._getId('notes', 'id', ts)
    } finally {
      stmt.free()
    }
  }

  proto._getCardId = function (note_id: number, ts: number) {
    const query = `SELECT id from cards WHERE nid = :note_id ORDER BY id DESC LIMIT 1`
    const stmt = this.db.prepare(query)
    try {
      const rowObj = stmt.getAsObject({ ':note_id': note_id })
      return rowObj.id || this._getId('cards', 'id', ts)
    } finally {
      stmt.free()
    }
  }
}

function getAnkiExporter(): any {
  const mod: any = AnkiExport
  if (mod?.Exporter?.prototype) {
    patchExporterPrototype(mod.Exporter.prototype)
  }
  if (mod?.prototype) {
    patchExporterPrototype(mod.prototype)
  }
  if (mod?.default?.Exporter?.prototype) {
    patchExporterPrototype(mod.default.Exporter.prototype)
  }
  if (mod?.default?.prototype) {
    patchExporterPrototype(mod.default.prototype)
  }

  if (typeof mod === 'function') return mod
  if (typeof mod?.default === 'function') return mod.default
  if (typeof mod?.default?.default === 'function') return mod.default.default
  if (typeof mod?.Exporter === 'function') return mod.Exporter
  return mod
}

function createAnkiDeck(deckName: string) {
  const Exporter = getAnkiExporter()
  let instance: any
  try {
    instance = new Exporter(deckName, { css: CARD_CSS })
  } catch {
    instance = Exporter(deckName, { css: CARD_CSS })
  }
  if (instance && Object.getPrototypeOf(instance)) {
    patchExporterPrototype(Object.getPrototypeOf(instance))
  }
  return instance
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

.anki-front-container {
  padding: 18px 12px;
}

.anki-image-wrapper {
  max-width: 340px;
  margin: 0 auto 16px auto;
}

.anki-prompt-vn {
  font-size: 19px;
  font-weight: 600;
  color: var(--anki-text, #0f172a);
  margin: 12px auto 16px auto;
  line-height: 1.4;
  max-width: 480px;
}

.anki-cloze-pattern {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 4px;
  color: #4f46e5;
  background: var(--anki-box-bg, #f8fafc);
  border: 2px dashed #a5b4fc;
  border-radius: 12px;
  padding: 10px 18px;
  margin: 10px auto 18px auto;
  display: inline-block;
  max-width: 90%;
  user-select: none;
}

.anki-type-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  max-width: 420px;
  margin: 0 auto 10px auto;
}

.anki-type-input {
  flex: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 18px;
  font-weight: 600;
  padding: 10px 14px;
  border-radius: 10px;
  border: 2px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  text-align: center;
  outline: none;
  transition: all 0.2s ease;
}

.anki-type-input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
}

.anki-check-btn {
  background: #6366f1;
  color: #ffffff;
  border: none;
  border-radius: 10px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}

.anki-check-btn:hover {
  background: #4f46e5;
}

.anki-feedback {
  min-height: 24px;
  font-size: 14px;
  margin-top: 4px;
}

.anki-back-typed-box {
  background: var(--anki-box-bg, #f8fafc);
  border: 1px solid var(--anki-box-border, #e2e8f0);
  border-radius: 8px;
  padding: 8px 14px;
  margin: 10px auto 14px auto;
  max-width: 440px;
  font-size: 14px;
  text-align: center;
}

.anki-typed-label {
  color: var(--anki-muted, #64748b);
  margin-right: 6px;
}

.anki-typed-val {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 700;
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

.nightMode .anki-prompt-vn, .night_mode .anki-prompt-vn, body.nightMode .anki-prompt-vn, body.night_mode .anki-prompt-vn {
  color: #f8fafc !important;
}

.nightMode .anki-cloze-pattern, .night_mode .anki-cloze-pattern, body.nightMode .anki-cloze-pattern, body.night_mode .anki-cloze-pattern {
  color: #a5b4fc !important;
  background: #1e1b4b !important;
  border-color: #6366f1 !important;
}

.nightMode .anki-type-input, .night_mode .anki-type-input, body.nightMode .anki-type-input, body.night_mode .anki-type-input {
  background: #0f172a !important;
  border-color: #334155 !important;
  color: #f8fafc !important;
}

.nightMode .anki-type-input:focus, .night_mode .anki-type-input:focus, body.nightMode .anki-type-input:focus, body.night_mode .anki-type-input:focus {
  border-color: #818cf8 !important;
}

.nightMode .anki-check-btn, .night_mode .anki-check-btn, body.nightMode .anki-check-btn, body.night_mode .anki-check-btn {
  background: #4f46e5 !important;
  color: #ffffff !important;
}

.nightMode .anki-back-typed-box, .night_mode .anki-back-typed-box, body.nightMode .anki-back-typed-box, body.night_mode .anki-back-typed-box {
  background: #1e293b !important;
  border-color: #334155 !important;
}
`

type DownloadedMedia = {
  buffer: Buffer
  extension: string
}

type MediaDownloader = (
  url: string,
  fallbackExtension: string,
) => Promise<DownloadedMedia | null>

function createMediaDownloader(): MediaDownloader {
  const cache = new Map<string, Promise<DownloadedMedia | null>>()

  return (url: string, fallbackExtension: string) => {
    const trimmed = url?.trim()
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
      return Promise.resolve(null)
    }

    const cached = cache.get(trimmed)
    if (cached) return cached

    const promise = downloadMedia(trimmed, fallbackExtension)
      .then((res) => res)
      .catch(() => null)

    cache.set(trimmed, promise)
    return promise
  }
}

type PreparedMedia = {
  filename: string
  buffer: Buffer
}

type PreparedCard = {
  front: string
  back: string
  tags: string[]
  media: PreparedMedia[]
}

async function prepareVocabularyCard(
  card: VocabularyCard,
  index: number,
  download: MediaDownloader,
): Promise<PreparedCard> {
  const word = card.word?.trim() || 'word'
  const base = safeBaseName(word, index)
  const mediaList: PreparedMedia[] = []

  const targetImageUrl = card.imageUrl?.trim() || (card.imageQuery ? getBingImageUrl(card.imageQuery) : '')
  const fallbackImageUrl = card.imageQuery
    ? targetImageUrl !== getBingAlternativeUrl(card.imageQuery)
      ? getBingAlternativeUrl(card.imageQuery)
      : getBingImageUrl(card.imageQuery)
    : ''

  const targetWordAudioUrl = card.wordAudioUrl
    ? card.wordAudioUrl.replace(/([?&]type=)1\b/, '$12')
    : getYoudaoUnsignedVoiceUrl(word, 2)

  const exampleText = card.example?.trim() || ''
  const targetExampleAudioUrl = card.exampleAudioUrl
    ? card.exampleAudioUrl.replace(/([?&]type=)1\b/, '$12')
    : (exampleText ? getYoudaoUnsignedVoiceUrl(exampleText, 2) : '')

  const [imageRes, wordAudioRes, exampleAudioRes, chunkAudioResults] = await Promise.all([
    (async () => {
      if (!targetImageUrl) return null
      let img = await download(targetImageUrl, 'jpg')
      if (!img && fallbackImageUrl && fallbackImageUrl !== targetImageUrl) {
        img = await download(fallbackImageUrl, 'jpg')
      }
      return img
    })(),
    (async () => {
      if (!targetWordAudioUrl) return null
      let audio = await download(targetWordAudioUrl, 'mp3')
      if (!audio && word) {
        audio = await download(getYoudaoUnsignedVoiceUrl(word, 2), 'mp3')
      }
      return audio
    })(),
    (async () => {
      if (!targetExampleAudioUrl) return null
      let audio = await download(targetExampleAudioUrl, 'mp3')
      if (!audio && exampleText) {
        audio = await download(getYoudaoUnsignedVoiceUrl(exampleText, 2), 'mp3')
      }
      return audio
    })(),
    Promise.all(
      (card.chunks || []).map(async (chunk) => {
        const text = chunk?.text?.trim()
        if (!text) return null
        const url = chunk.audioUrl
          ? chunk.audioUrl.replace(/([?&]type=)1\b/, '$12')
          : getYoudaoUnsignedVoiceUrl(text, 2)
        if (!url) return null
        let audio = await download(url, 'mp3')
        if (!audio) {
          audio = await download(getYoudaoUnsignedVoiceUrl(text, 2), 'mp3')
        }
        return audio
      }),
    ),
  ])

  let imageTag = ''
  if (imageRes) {
    const filename = `${base}.${imageRes.extension}`
    mediaList.push({ filename, buffer: imageRes.buffer })
    imageTag = `<img src="${filename}" alt="${escapeHtml(word)}" style="max-height:220px;max-width:100%;object-fit:cover;border-radius:8px">`
  }

  let wordAudioTag = ''
  if (wordAudioRes) {
    const filename = `${base}-word.${wordAudioRes.extension}`
    mediaList.push({ filename, buffer: wordAudioRes.buffer })
    wordAudioTag = `[sound:${filename}]`
  }

  let exampleAudioTag = ''
  if (exampleAudioRes) {
    const filename = `${base}-example.${exampleAudioRes.extension}`
    mediaList.push({ filename, buffer: exampleAudioRes.buffer })
    exampleAudioTag = `[sound:${filename}]`
  }

  const chunkAudioTags: string[] = []
  for (let cIdx = 0; cIdx < chunkAudioResults.length; cIdx++) {
    const cAudio = chunkAudioResults[cIdx]
    if (cAudio) {
      const filename = `${base}-chunk-${cIdx + 1}.${cAudio.extension}`
      mediaList.push({ filename, buffer: cAudio.buffer })
      chunkAudioTags.push(`[sound:${filename}]`)
    } else {
      chunkAudioTags.push('')
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
                `<li><span class="anki-chunk-text">${escapeHtml(c.text || '')}</span>${
                  chunkAudioTags[idx] ? ` <span class="anki-chunk-audio">${chunkAudioTags[idx]}</span>` : ''
                }${
                c.ipa ? ` <span class="anki-chunk-ipa" style="color:var(--anki-muted,#64748b);font-size:12px;font-family:ui-monospace,monospace;">${escapeHtml(c.ipa)}</span>` : ''
                }${
                  c.meaningVi ? ` <span class="anki-chunk-meaning">— ${escapeHtml(c.meaningVi)}</span>` : ''
                }${c.example ? `<div style="font-size:12px;color:var(--anki-muted,#64748b);font-style:italic;margin-top:2px;padding-left:4px;">${escapeHtml(c.example)}</div>` : ''
                }</li>`,
            )
            .join('')}
        </ul>
      </div>`
      : ''

  const isPhrase = card.kind === 'phrase' || word.includes(' ')
  const posInfo = getPosInfo(card.partOfSpeech || (isPhrase ? 'phrase' : 'noun'))
  const badgeHtml = `<div class="anki-badge ${posInfo.ankiClass}">${escapeHtml(posInfo.labelVi)} • ${escapeHtml(posInfo.abbr)}</div>`

  const maskedWord = card.maskedWord?.trim() || generateMaskedWord(word)
  const spacedMask = formatSpacedMask(maskedWord)

  const front = `
    <style>${CARD_CSS}</style>
    <div class="anki-container anki-front-container">
      ${badgeHtml}
      ${imageTag ? `<div class="anki-image-wrapper">${imageTag}</div>` : ''}

      <div class="anki-prompt-vn">
        <b>🇻🇳 Nghĩa:</b> ${escapeHtml(card.vietnamese || '')}
      </div>

      <div class="anki-cloze-pattern" title="Gợi ý ký tự">
        ${escapeHtml(spacedMask)}
      </div>

      <div class="anki-type-box">
        <input
          type="text"
          id="anki-input"
          class="anki-type-input"
          placeholder="${escapeHtml(maskedWord)}"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
        />
        <button type="button" id="anki-check-btn" class="anki-check-btn" onclick="checkAnkiAnswer()">
          Kiểm tra
        </button>
      </div>
      <div id="anki-feedback" class="anki-feedback"></div>

      <script>
        (function() {
          var targetWord = ${JSON.stringify(word)};
          var input = document.getElementById('anki-input');
          var feedback = document.getElementById('anki-feedback');

          if (input) {
            setTimeout(function() { input.focus(); }, 120);
            input.addEventListener('keydown', function(e) {
              if (e.key === 'Enter') {
                e.preventDefault();
                checkAnkiAnswer();
              }
            });
            input.addEventListener('input', function() {
              try {
                if (window.sessionStorage) {
                  sessionStorage.setItem('anki_last_typed', input.value);
                }
              } catch(e) {}
            });
          }

          window.checkAnkiAnswer = function() {
            if (!input || !feedback) return;
            var val = input.value.trim();
            if (!val) {
              feedback.innerHTML = '<span style="color:#eab308">⚠️ Hãy nhập từ trước khi kiểm tra</span>';
              return;
            }
            if (val.toLowerCase() === targetWord.toLowerCase()) {
              feedback.innerHTML = '<span style="color:#22c55e;font-weight:700">🎉 Chính xác! (Bấm Space để lật thẻ)</span>';
              input.style.borderColor = '#22c55e';
              input.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
            } else {
              feedback.innerHTML = '<span style="color:#ef4444;font-weight:700">❌ Chưa đúng! Thử lại hoặc bấm Space xem đáp án</span>';
              input.style.borderColor = '#ef4444';
              input.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            }
          };
        })();
      </script>
    </div>`

  const back = `
    <style>${CARD_CSS}</style>
    <div class="anki-container">
      <div>
        ${badgeHtml}
        ${imageTag ? `<div class="anki-image-wrapper">${imageTag}</div>` : ''}
        <div class="anki-word">${escapeHtml(word)}</div>
        <div class="anki-ipa">${escapeHtml(card.ipa || '')} ${wordAudioTag}</div>
      </div>

      <div id="anki-back-typed-box" class="anki-back-typed-box" style="display:none">
        <span class="anki-typed-label">Bạn đã gõ:</span>
        <span id="anki-back-typed-val" class="anki-typed-val"></span>
      </div>

      <div class="anki-box">
        <div class="anki-vn"><b>🇻🇳</b> ${escapeHtml(card.vietnamese || '')}</div>
        <div class="anki-en"><b>English:</b> ${escapeHtml(card.englishDefinition || '')}</div>
        ${card.hint ? `<div class="anki-hint"><b>💡 Textbook Note:</b> <i>${escapeHtml(card.hint)}</i></div>` : ''}
      </div>
      ${chunksHtml}
      <div class="anki-example-box">
        <div class="anki-example-text"><i>${escapeHtml(exampleText)}</i> ${exampleAudioTag}</div>
      </div>

      <script>
        (function() {
          var targetWord = ${JSON.stringify(word)};
          var box = document.getElementById('anki-back-typed-box');
          var valSpan = document.getElementById('anki-back-typed-val');
          try {
            var typed = window.sessionStorage ? sessionStorage.getItem('anki_last_typed') : null;
            if (box && valSpan && typed && typed.trim().length > 0) {
              box.style.display = 'block';
              var isCorrect = typed.trim().toLowerCase() === targetWord.toLowerCase();
              if (isCorrect) {
                valSpan.innerHTML = '<b style="color:#22c55e">✅ ' + escapeHtml(typed) + '</b>';
              } else {
                valSpan.innerHTML = '<b style="color:#ef4444">❌ ' + escapeHtml(typed) + '</b> <span style="color:var(--anki-muted,#64748b)">(Đáp án: <b>' + escapeHtml(targetWord) + '</b>)</span>';
              }
            }
          } catch(e) {}
          function escapeHtml(t) {
            return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
          }
        })();
      </script>
    </div>`

  const tag = card.unitNumber ? `unit-${String(card.unitNumber).padStart(2, '0')}` : 'vocabulary'
  const tags = ['vocabulary', tag]
  if (isPhrase) tags.push('phrases')
  if (posInfo.code && posInfo.code !== 'other') tags.push(`pos-${posInfo.code.replace(/\s+/g, '-')}`)

  return { front, back, tags, media: mediaList }
}

async function prepareNoteCard(
  card: NoteCard,
  index: number,
  download: MediaDownloader,
): Promise<PreparedCard> {
  const title = card.title?.trim() || 'Note'
  const base = safeBaseName(`note-${title}`, index)
  const mediaList: PreparedMedia[] = []
  let exampleAudioTag = ''

  const exampleText = card.example?.trim() || ''
  if (exampleText) {
    const targetExampleAudioUrl = card.exampleAudioUrl
      ? card.exampleAudioUrl.replace(/([?&]type=)1\b/, '$12')
      : getYoudaoUnsignedVoiceUrl(exampleText, 2)

    if (targetExampleAudioUrl) {
      let audio = await download(targetExampleAudioUrl, 'mp3')
      if (!audio) {
        audio = await download(getYoudaoUnsignedVoiceUrl(exampleText, 2), 'mp3')
      }
      if (audio) {
        const filename = `${base}-example.${audio.extension}`
        mediaList.push({ filename, buffer: audio.buffer })
        exampleAudioTag = `[sound:${filename}]`
      }
    }
  }

  const front = `
    <style>${CARD_CSS}</style>
    <div class="anki-container" style="padding:24px 14px">
      <div class="anki-badge anki-badge-note">LANGUAGE NOTE</div>
      <div class="anki-word" style="font-size:26px">${escapeHtml(title)}</div>
      <div class="anki-ipa" style="margin-top:10px">Key phrases &amp; usage rules</div>
    </div>`

  const back = `
    <style>${CARD_CSS}</style>
    <div class="anki-container">
      <div class="anki-badge anki-badge-note">LANGUAGE NOTE</div>
      <div class="anki-word" style="font-size:24px;margin-bottom:14px">${escapeHtml(title)}</div>
      
      <div class="anki-box">
        <div style="font-size:12px;font-weight:700;color:var(--anki-muted,#64748b);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">
          Important phrases &amp; expressions:
        </div>
        <ul style="margin:0;padding-left:22px;color:var(--anki-box-text,#0f172a)">
          ${(card.content || []).map((item) => `<li style="margin-bottom:6px">${escapeHtml(item)}</li>`).join('')}
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
    exampleText
          ? `
      <div class="anki-example-box">
        <div style="font-size:12px;font-weight:700;color:var(--anki-example-border,#3b82f6);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
          Example in context:
        </div>
        <div class="anki-example-text"><i>${escapeHtml(exampleText)}</i> ${exampleAudioTag}</div>
      </div>`
          : ''
      }
    </div>`

  const tag = card.unitNumber ? `unit-${String(card.unitNumber).padStart(2, '0')}` : 'notes'
  return {
    front,
    back,
    tags: ['language-notes', tag],
    media: mediaList,
  }
}

export async function buildApkg(
  deckName: string,
  cards: AnyAnkiCard[],
  onProgress?: (processed: number, total: number) => void,
) {
  const download = createMediaDownloader()
  const CONCURRENCY = 8

  const preparedCards: PreparedCard[] = new Array(cards.length)
  let nextIndex = 0
  let completedCount = 0

  const workers = Array.from({ length: Math.min(cards.length, CONCURRENCY) }, async () => {
    while (nextIndex < cards.length) {
      const idx = nextIndex++
      const card = cards[idx]
      if (card.type === 'note') {
        preparedCards[idx] = await prepareNoteCard(card, idx, download)
      } else {
        preparedCards[idx] = await prepareVocabularyCard(card, idx, download)
      }
      completedCount++
      if (onProgress) {
        try {
          onProgress(completedCount, cards.length)
        } catch {
          // ignore progress callback errors
        }
      }
    }
  })

  await Promise.all(workers)

  const apkg = createAnkiDeck(deckName)
  for (const prepared of preparedCards) {
    if (!prepared) continue
    for (const m of prepared.media) {
      apkg.addMedia(m.filename, m.buffer)
    }
    apkg.addCard(prepared.front, prepared.back, { tags: prepared.tags })
  }

  return apkg.save()
}

