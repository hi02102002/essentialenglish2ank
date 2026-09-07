import AnkiExport from 'anki-apkg-export'
import type { AnyAnkiCard, NoteCard, VocabularyCard } from '@/lib/types'
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

async function addVocabularyCard(apkg: AnkiExport, card: VocabularyCard, index: number) {
  const base = safeBaseName(card.word, index)
  let imageTag = ''
  let wordAudioTag = ''
  let exampleAudioTag = ''

  if (card.imageUrl) {
    try {
      const image = await downloadMedia(card.imageUrl, 'jpg')
      const filename = `${base}.${image.extension}`
      apkg.addMedia(filename, image.buffer)
      imageTag = `<img src="${filename}" alt="${escapeHtml(card.word)}" style="max-height:220px;max-width:100%;object-fit:cover;border-radius:8px">`
    } catch {
      imageTag = ''
    }
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
    <div style="text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:12px">
      <div style="display:inline-block;padding:3px 8px;background:#e0f2fe;color:#0369a1;border-radius:6px;font-size:12px;font-weight:600;margin-bottom:12px">VOCABULARY</div>
      ${imageTag ? `<div style="max-width:360px;margin:0 auto 16px">${imageTag}</div>` : ''}
      <div style="font-size:32px;font-weight:700;color:#0f172a">${escapeHtml(card.word)}</div>
      <div style="margin-top:12px">${wordAudioTag}</div>
    </div>`

  const back = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;max-width:540px;margin:0 auto;padding:12px">
      <div style="text-align:center">
        <div style="font-size:30px;font-weight:700;color:#0f172a">${escapeHtml(card.word)}</div>
        <div style="color:#64748b;font-size:18px;margin:6px 0 16px">${escapeHtml(card.ipa)}</div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px">
        <div style="font-size:18px;color:#0f172a;margin-bottom:8px"><b>🇻🇳</b> ${escapeHtml(card.vietnamese)}</div>
        <div style="font-size:15px;color:#334155"><b>English:</b> ${escapeHtml(card.englishDefinition)}</div>
      </div>
      <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 8px 8px 0;padding:12px 16px">
        <div style="font-size:15px;color:#1e293b"><i>${escapeHtml(card.example)}</i> ${exampleAudioTag}</div>
      </div>
    </div>`

  const tag = card.unitNumber ? `unit-${String(card.unitNumber).padStart(2, '0')}` : 'vocabulary'
  apkg.addCard(front, back, { tags: ['vocabulary', tag] })
}

async function addNoteCard(apkg: AnkiExport, card: NoteCard, index: number) {
  const base = safeBaseName(`note-${card.title}`, index)
  let exampleAudioTag = ''

  if (card.example) {
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
  }

  const front = `
    <div style="text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px 14px">
      <div style="display:inline-block;padding:4px 12px;background:#fef3c7;color:#b45309;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:0.5px;margin-bottom:16px">LANGUAGE NOTE</div>
      <div style="font-size:26px;font-weight:700;color:#1e293b;line-height:1.3">${escapeHtml(card.title)}</div>
      <div style="color:#64748b;font-size:14px;margin-top:12px">Key phrases & usage rules</div>
    </div>`

  const back = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;max-width:560px;margin:0 auto;padding:14px">
      <div style="display:inline-block;padding:3px 10px;background:#fef3c7;color:#b45309;border-radius:6px;font-size:12px;font-weight:700;margin-bottom:10px">LANGUAGE NOTE</div>
      <div style="font-size:24px;font-weight:700;color:#1e293b;margin-bottom:14px">${escapeHtml(card.title)}</div>
      
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px">
        <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Important phrases & expressions:</div>
        <ul style="margin:0;padding-left:22px;color:#0f172a">
          ${card.content.map((item) => `<li style="margin-bottom:6px">${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>

      ${
        card.vietnameseExplanation
          ? `
      <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:14px">
        <div style="font-size:15px;color:#166534"><b>🇻🇳 Giải thích:</b> ${escapeHtml(card.vietnameseExplanation)}</div>
      </div>`
          : ''
      }

      ${
        card.example
          ? `
      <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 8px 8px 0;padding:12px 16px">
        <div style="font-size:12px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Example in context:</div>
        <div style="font-size:15px;color:#1e293b"><i>${escapeHtml(card.example)}</i> ${exampleAudioTag}</div>
      </div>`
          : ''
      }
    </div>`

  const tag = card.unitNumber ? `unit-${String(card.unitNumber).padStart(2, '0')}` : 'notes'
  apkg.addCard(front, back, { tags: ['language-notes', tag] })
}

export async function buildApkg(deckName: string, cards: AnyAnkiCard[]) {
  const Exporter = getAnkiExporter()
  const apkg = new Exporter(deckName)
  for (const [index, card] of cards.entries()) {
    if (card.type === 'note') {
      await addNoteCard(apkg, card, index)
    } else {
      await addVocabularyCard(apkg, card, index)
    }
  }
  return apkg.save()
}

