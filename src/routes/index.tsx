import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { analyzeLesson, generateVocabulary } from '@/server/functions'
import { getBingImageUrl } from '@/lib/bing-image'
import { getYoudaoDictVoiceUrl } from '@/lib/youdao'
import type { LessonAnalysis, VocabularyCard } from '@/lib/types'

const DEFAULT_URL =
  'https://www.essentialenglish.review/apps/english-vocabulary-in-use-pre-intermediate-and-intermediate/unit-9-the-body-and-movement#8'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function playAudio(url: string) {
  const audio = new Audio(url)
  void audio.play()
}

function HomePage() {
  const [url, setUrl] = useState(DEFAULT_URL)
  const [lesson, setLesson] = useState<LessonAnalysis | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [cards, setCards] = useState<VocabularyCard[]>([])
  const [deckName, setDeckName] = useState('English Vocabulary in Use::Unit 9: The body and movement')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const selectedWords = useMemo(
    () => lesson?.words.filter((word) => checked[word] !== false) ?? [],
    [lesson, checked],
  )

  async function onAnalyze() {
    setError('')
    setStatus('Reading lesson…')
    setCards([])
    try {
      const result = await analyzeLesson({ data: { url } })
      setLesson(result)
      setChecked(Object.fromEntries(result.words.map((word) => [word, true])))
      const unitTitle = result.title.replace(/^English Vocabulary in Use\s*[:-]?\s*/i, '').trim() || result.title
      setDeckName(`English Vocabulary in Use::${unitTitle}`)
      setStatus(`Found ${result.words.length} vocabulary items.`)
    } catch (err) {
      setStatus('')
      setError(err instanceof Error ? err.message : 'Could not analyze lesson')
    }
  }

  async function onGenerate() {
    if (!lesson || !selectedWords.length) return
    setError('')
    setStatus(`Generating ${selectedWords.length} cards…`)
    try {
      const generated = await generateVocabulary({ data: { words: selectedWords } })
      const nextCards = generated.map((item, index): VocabularyCard => ({
        id: `${Date.now()}-${index}`,
        selected: true,
        ...item,
        imageUrl: getBingImageUrl(item.imageQuery),
        wordAudioUrl: getYoudaoDictVoiceUrl(item.word, 1),
        exampleAudioUrl: getYoudaoDictVoiceUrl(item.example, 1),
        sourceUrl: lesson.sourceUrl,
      }))
      setCards(nextCards)
      setStatus('Cards are ready to review.')
    } catch (err) {
      setStatus('')
      setError(err instanceof Error ? err.message : 'Could not generate cards')
    }
  }

  function patchCard(index: number, patch: Partial<VocabularyCard>) {
    setCards((current) =>
      current.map((card, i) => {
        if (i !== index) return card
        const next = { ...card, ...patch }
        if (patch.imageQuery !== undefined) next.imageUrl = getBingImageUrl(patch.imageQuery)
        if (patch.word !== undefined) next.wordAudioUrl = getYoudaoDictVoiceUrl(patch.word, 1)
        if (patch.example !== undefined) next.exampleAudioUrl = getYoudaoDictVoiceUrl(patch.example, 1)
        return next
      }),
    )
  }

  async function onExport() {
    const selected = cards.filter((card) => card.selected)
    if (!selected.length) return
    setError('')
    setStatus(`Packaging ${selected.length} cards and media…`)

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deckName, cards: selected }),
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Export failed (${response.status})`)
      }
      const blob = await response.blob()
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = `${deckName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'anki-deck'}.apkg`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(href)
      setStatus('Anki deck exported.')
    } catch (err) {
      setStatus('')
      setError(err instanceof Error ? err.message : 'Could not export deck')
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div className="eyebrow">TANSTACK START · ANKI</div>
        <h1>Turn vocabulary lessons into Anki decks.</h1>
        <p>Extract words, enrich them with AI, attach Bing thumbnails and Youdao audio, then export an offline .apkg.</p>
      </header>

      <section className="panel">
        <div className="section-title"><span>1</span><div><h2>Import lesson</h2><p>Paste an Essential English lesson URL.</p></div></div>
        <div className="url-row">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          <button className="primary" onClick={onAnalyze}>Analyze</button>
        </div>
        {lesson && <p className="muted">Using: {lesson.resolvedUrl}</p>}
      </section>

      {lesson && (
        <section className="panel">
          <div className="section-title"><span>2</span><div><h2>Choose words</h2><p>{selectedWords.length} of {lesson.words.length} selected.</p></div></div>
          <div className="word-grid">
            {lesson.words.map((word) => (
              <label className="word-pill" key={word}>
                <input
                  type="checkbox"
                  checked={checked[word] !== false}
                  onChange={(e) => setChecked((old) => ({ ...old, [word]: e.target.checked }))}
                />
                <span>{word}</span>
              </label>
            ))}
          </div>
          <div className="actions">
            <button className="ghost" onClick={() => setChecked(Object.fromEntries(lesson.words.map((w) => [w, true])))}>Select all</button>
            <button className="ghost" onClick={() => setChecked(Object.fromEntries(lesson.words.map((w) => [w, false])))}>Clear</button>
            <button className="primary" disabled={!selectedWords.length} onClick={onGenerate}>Generate {selectedWords.length} cards</button>
          </div>
        </section>
      )}

      {cards.length > 0 && (
        <section className="panel">
          <div className="section-title"><span>3</span><div><h2>Review cards</h2><p>Edit anything before export.</p></div></div>
          <label className="deck-name">
            Deck name
            <input value={deckName} onChange={(e) => setDeckName(e.target.value)} />
            <span className="muted" style={{ fontWeight: 400, marginTop: '2px' }}>
              💡 Tạo dạng thư mục trong Anki: Dùng dấu <code>::</code> (Ví dụ: <code>Tiếng Anh::Unit 9: The body and movement</code>)
            </span>
          </label>

          <div className="cards">
            {cards.map((card, index) => (
              <article className="card-editor" key={card.id}>
                <div className="image-column">
                  <img src={card.imageUrl} alt={card.word} />
                  <input value={card.imageQuery} onChange={(e) => patchCard(index, { imageQuery: e.target.value })} aria-label="Image query" />
                  <label className="include"><input type="checkbox" checked={card.selected} onChange={(e) => patchCard(index, { selected: e.target.checked })} /> Include</label>
                </div>
                <div className="fields">
                  <label>Word<input value={card.word} onChange={(e) => patchCard(index, { word: e.target.value })} /></label>
                  <div className="two-col">
                    <label>IPA<input value={card.ipa} onChange={(e) => patchCard(index, { ipa: e.target.value })} /></label>
                    <label>Vietnamese<input value={card.vietnamese} onChange={(e) => patchCard(index, { vietnamese: e.target.value })} /></label>
                  </div>
                  <label>English meaning<textarea value={card.englishDefinition} onChange={(e) => patchCard(index, { englishDefinition: e.target.value })} /></label>
                  <label>Example<textarea value={card.example} onChange={(e) => patchCard(index, { example: e.target.value })} /></label>
                  <div className="audio-row">
                    <button className="ghost" onClick={() => playAudio(card.wordAudioUrl)}>▶ Word audio</button>
                    <button className="ghost" onClick={() => playAudio(card.exampleAudioUrl)}>▶ Example audio</button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="export-bar">
            <div><strong>{cards.filter((c) => c.selected).length} cards</strong><span> Images + two audio clips per card</span></div>
            <button className="primary big" onClick={onExport}>Export .apkg</button>
          </div>
        </section>
      )}

      {(status || error) && <div className={error ? 'toast error' : 'toast'}>{error || status}</div>}
    </main>
  )
}
