import AnkiExport from 'anki-apkg-export'
import type { VocabularyCard } from '@/lib/types'
import { downloadMedia } from './media'
import { getYoudaoUnsignedVoiceUrl } from '@/lib/youdao'

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

async function addCardMedia(apkg: AnkiExport, card: VocabularyCard, index: number) {
  const base = safeBaseName(card.word, index)
  let imageTag = ''
  let wordAudioTag = ''
  let exampleAudioTag = ''

  try {
    const image = await downloadMedia(card.imageUrl, 'jpg')
    const filename = `${base}.${image.extension}`
    apkg.addMedia(filename, image.buffer)
    imageTag = `<img src="${filename}" alt="${escapeHtml(card.word)}">`
  } catch {
    imageTag = ''
  }

  try {
    let audio
    try {
      audio = await downloadMedia(card.wordAudioUrl, 'mp3')
    } catch {
      audio = await downloadMedia(getYoudaoUnsignedVoiceUrl(card.word, 1), 'mp3')
    }
    const filename = `${base}-word.${audio.extension}`
    apkg.addMedia(filename, audio.buffer)
    wordAudioTag = `[sound:${filename}]`
  } catch {
    wordAudioTag = ''
  }

  try {
    let audio
    try {
      audio = await downloadMedia(card.exampleAudioUrl, 'mp3')
    } catch {
      audio = await downloadMedia(getYoudaoUnsignedVoiceUrl(card.example, 1), 'mp3')
    }
    const filename = `${base}-example.${audio.extension}`
    apkg.addMedia(filename, audio.buffer)
    exampleAudioTag = `[sound:${filename}]`
  } catch {
    exampleAudioTag = ''
  }

  const front = `
    <div style="text-align:center;font-family:Arial,sans-serif">
      <div style="max-width:360px;margin:0 auto 18px">${imageTag}</div>
      <div style="font-size:34px;font-weight:700">${escapeHtml(card.word)}</div>
      <div style="margin-top:12px">${wordAudioTag}</div>
    </div>`

  const back = `
    <div style="font-family:Arial,sans-serif;line-height:1.55">
      <div style="text-align:center;font-size:30px;font-weight:700">${escapeHtml(card.word)}</div>
      <div style="text-align:center;color:#666;margin:6px 0 18px">${escapeHtml(card.ipa)}</div>
      <div style="font-size:20px"><b>🇻🇳</b> ${escapeHtml(card.vietnamese)}</div>
      <div style="margin-top:12px"><b>English:</b> ${escapeHtml(card.englishDefinition)}</div>
      <div style="margin-top:16px;padding:12px;border-left:3px solid #bbb"><i>${escapeHtml(card.example)}</i> ${exampleAudioTag}</div>
    </div>`

  apkg.addCard(front, back, { tags: ['ai-vocabulary'] })
}

export async function buildApkg(deckName: string, cards: VocabularyCard[]) {
  const Exporter = getAnkiExporter()
  const apkg = new Exporter(deckName)
  for (const [index, card] of cards.entries()) {
    await addCardMedia(apkg, card, index)
  }
  return apkg.save()
}
