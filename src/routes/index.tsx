import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  SparklesIcon,
  BookOpenIcon,
  CheckSquareIcon,
  DownloadIcon,
  Volume2Icon,
  SearchIcon,
  LinkIcon,
  FileTextIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CheckIcon,
  AlertCircleIcon,
  CheckCircle2Icon,
  RefreshCwIcon,
  LayersIcon,
  LockIcon,
  KeyRoundIcon,
  EyeIcon,
  EyeOffIcon,
  BookmarkIcon,
  CompassIcon,
  InfoIcon,
  ImageIcon,
  PlusIcon,
  Trash2Icon,
  Loader2Icon,
} from 'lucide-react'
import {
  analyzeLesson,
  generateVocabulary,
  generateNotes,
  generateChunks,
  checkAuthRequirement,
  verifyPassword,
  verifySessionToken,
} from '@/server/functions'
import { PRESET_BOOKS } from '@/server/lesson'
import { getBingImageUrl } from '@/lib/bing-image'
import { getYoudaoDictVoiceUrl } from '@/lib/youdao'
import { getPosInfo, QUICK_POS_OPTIONS, normalizePartOfSpeech } from '@/lib/pos'
import { generateMaskedWord, isWordMatch } from '@/lib/masked-word'
import type {
  AnyAnkiCard,
  ExtractedNote,
  LessonAnalysis,
  LexicalChunk,
  NoteCard,
  VocabularyCard,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
  CardFrame,
  CardFrameHeader,
  CardFrameTitle,
  CardFrameAction,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'

const DEFAULT_URL =
  'https://www.essentialenglish.review/apps/english-vocabulary-in-use-pre-intermediate-and-intermediate/unit-9-the-body-and-movement#8'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function playAudio(url: string) {
  try {
    const audio = new Audio(url)
    void audio.play()
  } catch (err) {
    console.error('Audio playback error', err)
  }
}

function parseCustomWords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[\n,;\t]+/)
        .map((w) => w.replace(/^[-*•\d.]+\s*/, '').trim())
        .filter((w) => w.length > 0),
    ),
  )
}

function VocabularyImageEditor({
  card,
  realIndex,
  patchCard,
}: {
  card: VocabularyCard
  realIndex: number
  patchCard: (index: number, patch: Partial<AnyAnkiCard>) => void
}) {
  const [failedDirect, setFailedDirect] = useState(false)
  const [failedProxy, setFailedProxy] = useState(false)
  const [isReloading, setIsReloading] = useState(false)
  const [seed, setSeed] = useState(0)
  const [showCustomUrl, setShowCustomUrl] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Reset errors whenever card.imageUrl changes externally
  useEffect(() => {
    setFailedDirect(false)
    setFailedProxy(false)
    setIsLoaded(false)
  }, [card.imageUrl])

  const targetUrl =
    card.imageUrl || (card.imageQuery ? getBingImageUrl(card.imageQuery, seed) : '')

  const displaySrc = useMemo(() => {
    if (!targetUrl) return ''
    if (failedDirect && !failedProxy) {
      return `/api/image-proxy?url=${encodeURIComponent(targetUrl)}`
    }
    return targetUrl
  }, [targetUrl, failedDirect, failedProxy])

  const handleReload = (newQuery?: string) => {
    setIsReloading(true)
    const nextSeed = seed + 1
    setSeed(nextSeed)
    setFailedDirect(false)
    setFailedProxy(false)
    setIsLoaded(false)
    const query = (newQuery ?? card.imageQuery).trim() || card.word
    const newUrl = getBingImageUrl(query, nextSeed)
    patchCard(realIndex, {
      imageUrl: newUrl,
      imageQuery: query,
    })
    setTimeout(() => setIsReloading(false), 400)
  }

  const handleResetToQuery = () => {
    setFailedDirect(false)
    setFailedProxy(false)
    setIsLoaded(false)
    const query = card.imageQuery.trim() || card.word
    patchCard(realIndex, {
      imageUrl: getBingImageUrl(query, seed),
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Image Preview Container */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border/60 bg-muted/40 shadow-xs group">
        {displaySrc && !failedProxy ? (
          <>
            <img
              src={displaySrc}
              alt={card.word}
              referrerPolicy="no-referrer"
              loading="lazy"
              onLoad={() => setIsLoaded(true)}
              onError={() => {
                if (!failedDirect) {
                  // Direct loading failed, fallback automatically to server proxy
                  setFailedDirect(true)
                } else {
                  // Both direct and proxy failed
                  setFailedProxy(true)
                }
              }}
              className={`size-full object-cover transition-all duration-300 group-hover:scale-105 ${
                isLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {!isLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/30 animate-pulse text-xs text-muted-foreground">
                <RefreshCwIcon className="size-4 animate-spin text-muted-foreground/60" />
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-muted/40 gap-2">
            <div className="size-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertCircleIcon className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-foreground">Không tải được ảnh</span>
              <span className="text-[0.68rem] text-muted-foreground mt-0.5">
                Nguồn ảnh bị chặn hoặc không khả dụng
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => handleReload()}
              disabled={isReloading}
              className="text-xs h-7 px-2.5 mt-1"
            >
              <RefreshCwIcon
                className={`size-3 mr-1.5 ${isReloading ? 'animate-spin' : ''}`}
              />
              Thử ảnh khác
            </Button>
          </div>
        )}
      </div>

      {/* Bing Image Query row */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
            Bing Image Query
          </label>
          <button
            type="button"
            onClick={() => setShowCustomUrl((v) => !v)}
            className="text-[0.7rem] text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            <LinkIcon className="size-2.5" />
            {showCustomUrl ? 'Ẩn URL' : 'Sửa URL'}
          </button>
        </div>

        <div className="flex gap-1.5">
          <Input
            size="sm"
            value={card.imageQuery}
            onChange={(e) => patchCard(realIndex, { imageQuery: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleReload(card.imageQuery)
              }
            }}
            aria-label="Từ khóa tìm ảnh Bing"
            className="font-mono text-xs"
            placeholder="Từ khóa tìm ảnh..."
          />
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            title="Đổi sang hình ảnh khác (làm mới ảnh)"
            disabled={isReloading}
            onClick={() => handleReload()}
          >
            <RefreshCwIcon
              className={`size-3.5 ${isReloading ? 'animate-spin text-primary' : ''}`}
              aria-hidden="true"
            />
          </Button>
        </div>

        {/* Optional Direct URL Input */}
        {showCustomUrl && (
          <div className="flex flex-col gap-1 mt-1 p-2 rounded-lg bg-muted/40 border border-border/40">
            <label className="text-[0.68rem] text-muted-foreground font-medium">
              Dán URL ảnh trực tiếp:
            </label>
            <div className="flex gap-1">
              <Input
                size="sm"
                value={card.imageUrl}
                onChange={(e) => {
                  setFailedDirect(false)
                  setFailedProxy(false)
                  setIsLoaded(false)
                  patchCard(realIndex, { imageUrl: e.target.value.trim() })
                }}
                className="font-mono text-[0.7rem] h-7"
                placeholder="https://... dán link ảnh"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                title="Khôi phục ảnh từ query Bing"
                onClick={handleResetToQuery}
                className="text-[0.68rem] h-7 px-2"
              >
                Reset
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CardTypingTester({
  targetWord,
  maskedWord,
}: {
  targetWord: string
  maskedWord?: string
}) {
  const [typed, setTyped] = useState('')
  const [status, setStatus] = useState<'idle' | 'correct' | 'incorrect'>('idle')

  useEffect(() => {
    setTyped('')
    setStatus('idle')
  }, [targetWord, maskedWord])

  const effectiveMask = maskedWord?.trim() || generateMaskedWord(targetWord)

  const handleCheck = () => {
    if (!typed.trim()) {
      setStatus('idle')
      return
    }
    const match = isWordMatch(typed, targetWord)
    setStatus(match ? 'correct' : 'incorrect')
  }

  const handleReset = () => {
    setTyped('')
    setStatus('idle')
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/30 p-2.5">
      <div className="flex items-center justify-between text-[0.7rem] font-semibold text-muted-foreground">
        <span className="flex items-center gap-1">
          <span>⌨️</span> Thử gõ từ này (Active Recall):
        </span>
        {status === 'correct' && (
          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
            <CheckCircle2Icon className="size-3" /> Chính xác!
          </span>
        )}
        {status === 'incorrect' && (
          <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-0.5">
            <AlertCircleIcon className="size-3" /> Chưa đúng! (Đáp án: {targetWord})
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          size="sm"
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value)
            if (status !== 'idle') setStatus('idle')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleCheck()
            }
          }}
          placeholder={effectiveMask}
          className={`font-mono text-xs ${
            status === 'correct'
              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
              : status === 'incorrect'
              ? 'border-rose-500 bg-rose-500/10 text-rose-800 dark:text-rose-200'
              : ''
          }`}
        />
        <Button
          type="button"
          size="sm"
          variant={status === 'correct' ? 'default' : 'outline'}
          className="h-8 px-2.5 text-xs shrink-0 cursor-pointer"
          onClick={handleCheck}
        >
          Kiểm tra
        </Button>
        {typed && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs shrink-0 cursor-pointer text-muted-foreground"
            onClick={handleReset}
          >
            Xóa
          </Button>
        )}
      </div>
    </div>
  )
}

function HomePage() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [inputMode, setInputMode] = useState<'preset' | 'url' | 'text'>('preset')

  // Preset Mode State
  const [selectedBook, setSelectedBook] = useState<string>(
    'english-vocabulary-in-use-pre-intermediate-and-intermediate',
  )
  const [unitNumber, setUnitNumber] = useState<number>(9)

  // URL Mode State
  const [url, setUrl] = useState(DEFAULT_URL)
  const [urlUnitOverride, setUrlUnitOverride] = useState<string>('')

  // Text Mode State
  const [rawText, setRawText] = useState('')

  // Deck Configuration
  const [deckName, setDeckName] = useState(
    'English Vocabulary in Use: Pre-intermediate & Intermediate::Unit 9: The body and movement',
  )

  // Extracted Lesson State
  const [lesson, setLesson] = useState<LessonAnalysis | null>(null)
  const [allWords, setAllWords] = useState<string[]>([])
  const [checkedWords, setCheckedWords] = useState<Record<string, boolean>>({})
  const [wordFilter, setWordFilter] = useState('')

  const [allPhrases, setAllPhrases] = useState<string[]>([])
  const [checkedPhrases, setCheckedPhrases] = useState<Record<string, boolean>>({})
  const [phraseFilter, setPhraseFilter] = useState('')
  const [phraseHints, setPhraseHints] = useState<Record<string, string>>({})
  const [itemImages, setItemImages] = useState<Record<string, string>>({})

  const [allNotes, setAllNotes] = useState<ExtractedNote[]>([])
  const [checkedNotes, setCheckedNotes] = useState<Record<string, boolean>>({})

  // Generated Cards State
  const [cards, setCards] = useState<AnyAnkiCard[]>([])
  const [cardFilterType, setCardFilterType] = useState<string>('all')

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingChunks, setIsGeneratingChunks] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [authRequired, setAuthRequired] = useState(false)
  const [inputPassword, setInputPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  useEffect(() => {
    async function initAuth() {
      try {
        const { required } = await checkAuthRequirement()
        setAuthRequired(required)
        if (!required) {
          setIsAuthenticated(true)
          return
        }

        const savedToken = sessionStorage.getItem('anki_auth_token')
        if (savedToken) {
          const { valid } = await verifySessionToken({ data: { token: savedToken } })
          if (valid) {
            setIsAuthenticated(true)
            return
          }
          sessionStorage.removeItem('anki_auth_token')
        }
        setIsAuthenticated(false)
      } catch (err) {
        console.error('Auth initialization error', err)
        setIsAuthenticated(false)
      }
    }
    void initAuth()
  }, [])

  async function onUnlock(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!inputPassword.trim()) {
      setAuthError('Vui lòng nhập mật khẩu.')
      return
    }
    setAuthError('')
    setIsVerifying(true)
    try {
      const res = await verifyPassword({ data: { password: inputPassword } })
      if (res.success && res.token) {
        sessionStorage.setItem('anki_auth_token', res.token)
        setIsAuthenticated(true)
        setInputPassword('')
      } else {
        setAuthError(res.message || 'Mật khẩu không chính xác.')
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Lỗi xác thực mật khẩu.')
    } finally {
      setIsVerifying(false)
    }
  }

  function onLock() {
    sessionStorage.removeItem('anki_auth_token')
    setIsAuthenticated(false)
  }

  const selectedWords = useMemo(
    () => allWords.filter((w) => checkedWords[w] !== false),
    [allWords, checkedWords],
  )

  const selectedPhrases = useMemo(
    () => allPhrases.filter((p) => checkedPhrases[p] !== false),
    [allPhrases, checkedPhrases],
  )

  const selectedNotes = useMemo(
    () => allNotes.filter((n) => checkedNotes[n.id] !== false),
    [allNotes, checkedNotes],
  )

  const filteredWords = useMemo(() => {
    if (!wordFilter.trim()) return allWords
    const q = wordFilter.toLowerCase()
    return allWords.filter((w) => w.toLowerCase().includes(q))
  }, [allWords, wordFilter])

  const filteredPhrases = useMemo(() => {
    if (!phraseFilter.trim()) return allPhrases
    const q = phraseFilter.toLowerCase()
    return allPhrases.filter((p) => p.toLowerCase().includes(q))
  }, [allPhrases, phraseFilter])

  const selectedCards = useMemo(
    () => cards.filter((c) => c.selected),
    [cards],
  )

  const wordCardCount = useMemo(
    () => cards.filter((c) => c.type === 'vocabulary' && c.kind !== 'phrase').length,
    [cards],
  )

  const phraseCardCount = useMemo(
    () => cards.filter((c) => c.type === 'vocabulary' && c.kind === 'phrase').length,
    [cards],
  )

  const noteCardCount = useMemo(
    () => cards.filter((c) => c.type === 'note').length,
    [cards],
  )

  const adjCount = useMemo(
    () =>
      cards.filter(
        (c) =>
          c.type === 'vocabulary' &&
          normalizePartOfSpeech(c.partOfSpeech) === 'adjective',
      ).length,
    [cards],
  )

  const advCount = useMemo(
    () =>
      cards.filter(
        (c) =>
          c.type === 'vocabulary' &&
          normalizePartOfSpeech(c.partOfSpeech) === 'adverb',
      ).length,
    [cards],
  )

  const nounCount = useMemo(
    () =>
      cards.filter(
        (c) =>
          c.type === 'vocabulary' &&
          normalizePartOfSpeech(c.partOfSpeech) === 'noun',
      ).length,
    [cards],
  )

  const verbCount = useMemo(
    () =>
      cards.filter(
        (c) =>
          c.type === 'vocabulary' &&
          normalizePartOfSpeech(c.partOfSpeech) === 'verb',
      ).length,
    [cards],
  )

  const displayedCards = useMemo(() => {
    if (cardFilterType === 'all') return cards
    if (cardFilterType === 'word')
      return cards.filter((c) => c.type === 'vocabulary' && c.kind !== 'phrase')
    if (cardFilterType === 'phrase')
      return cards.filter((c) => c.type === 'vocabulary' && c.kind === 'phrase')
    if (cardFilterType === 'note')
      return cards.filter((c) => c.type === 'note')
    return cards.filter(
      (c) =>
        c.type === 'vocabulary' &&
        normalizePartOfSpeech(c.partOfSpeech) === cardFilterType,
    )
  }, [cards, cardFilterType])

  function getStoredToken(): string | undefined {
    if (typeof window === 'undefined') return undefined
    return sessionStorage.getItem('anki_auth_token') || undefined
  }

  async function onAnalyze() {
    setError('')
    setStatus('Đang phân tích bài học từ nguồn dữ liệu…')
    setIsAnalyzing(true)
    try {
      const result = await analyzeLesson({
        data: {
          bookSlug: inputMode === 'preset' ? selectedBook : undefined,
          unitNumber:
            inputMode === 'preset'
              ? unitNumber
              : urlUnitOverride.trim()
                ? Number(urlUnitOverride)
                : undefined,
          url: inputMode === 'url' ? url.trim() : undefined,
          token: getStoredToken(),
        },
      })

      setLesson(result)
      setAllWords(result.words)
      setCheckedWords(Object.fromEntries(result.words.map((w) => [w, true])))

      setAllPhrases(result.phrases)
      setCheckedPhrases(Object.fromEntries(result.phrases.map((p) => [p, true])))

      const hints: Record<string, string> = {}
      const images: Record<string, string> = {}
      for (const item of result.vocabularyList) {
        if (item.hint) hints[item.word] = item.hint
        if (item.image) images[item.word] = item.image
      }
      setPhraseHints(hints)
      setItemImages(images)

      setAllNotes(result.notes)
      setCheckedNotes(Object.fromEntries(result.notes.map((n) => [n.id, false])))

      const bookPrefix = result.bookTitle || 'English Vocabulary in Use'
      const cleanUnitTitle =
        result.title.replace(/^English Vocabulary in Use\s*[:-]?\s*/i, '').trim() ||
        result.title
      setDeckName(`${bookPrefix}::${cleanUnitTitle}`)
      setStatus(
        `Đã bóc tách thành công: ${result.words.length} từ vựng, ${result.phrases.length} cụm từ/thành ngữ và ${result.notes.length} phần ghi chú bài học.`,
      )
      setStep(2)
    } catch (err) {
      setStatus('')
      if (err instanceof Error && err.message.includes('401')) {
        sessionStorage.removeItem('anki_auth_token')
        setIsAuthenticated(false)
        setAuthError('Phiên xác thực không hợp lệ. Vui lòng nhập lại mật khẩu.')
        return
      }
      setError(err instanceof Error ? err.message : 'Không thể đọc bài học')
    } finally {
      setIsAnalyzing(false)
    }
  }

  function onProceedWithText() {
    setError('')
    const parsed = parseCustomWords(rawText)
    if (!parsed.length) {
      setError('Vui lòng nhập ít nhất 1 từ vựng.')
      return
    }
    const words: string[] = []
    const phrases: string[] = []
    for (const item of parsed) {
      if (item.includes(' ') || item.includes('-')) {
        phrases.push(item)
      } else {
        words.push(item)
      }
    }
    setLesson(null)
    setAllWords(words)
    setCheckedWords(Object.fromEntries(words.map((w) => [w, true])))
    setAllPhrases(phrases)
    setCheckedPhrases(Object.fromEntries(phrases.map((p) => [p, true])))
    setPhraseHints({})
    setItemImages({})
    setAllNotes([])
    setCheckedNotes({})
    setStatus(
      `Đã ghi nhận ${words.length} từ vựng và ${phrases.length} cụm từ từ danh sách.`,
    )
    setStep(2)
  }

  async function onGenerateAiChunks() {
    const candidateWords = selectedWords.length > 0 ? selectedWords : allWords
    if (!candidateWords.length) {
      setError('Vui lòng chọn hoặc có ít nhất 1 từ vựng để tạo chunks.')
      return
    }

    setError('')
    setStatus('Đang dùng AI tạo thêm cụm từ Lexical Chunks tự nhiên…')
    setIsGeneratingChunks(true)

    try {
      const token = getStoredToken()
      const storyText =
        lesson?.notes?.map((n) => n.content?.join(' ')).filter(Boolean).join('\n') || ''
      const generated = await generateChunks({
        data: {
          words: candidateWords.slice(0, 30),
          storyText,
          token,
        },
      })

      if (!generated.length) {
        setStatus('Không tìm thấy chunks mới nào.')
        return
      }

      const existingSet = new Set(allPhrases.map((p) => p.toLowerCase()))
      const newPhrases: string[] = []
      const newHints: Record<string, string> = { ...phraseHints }

      for (const item of generated) {
        const lower = item.word.toLowerCase()
        if (!existingSet.has(lower)) {
          existingSet.add(lower)
          newPhrases.push(item.word)
          if (item.vietnamese) {
            newHints[item.word] = item.vietnamese
          }
        }
      }

      if (!newPhrases.length) {
        setStatus('Tất cả các chunks được đề xuất đã có trong danh sách cụm từ.')
        return
      }

      setAllPhrases((prev) => [...prev, ...newPhrases])
      setCheckedPhrases((prev) => {
        const next = { ...prev }
        for (const p of newPhrases) next[p] = true
        return next
      })
      setPhraseHints(newHints)
      setStatus(`Đã tạo và thêm thành công ${newPhrases.length} cụm từ Lexical Chunks vào bài học!`)
    } catch (err) {
      setStatus('')
      if (err instanceof Error && err.message.includes('401')) {
        sessionStorage.removeItem('anki_auth_token')
        setIsAuthenticated(false)
        setAuthError('Phiên xác thực không hợp lệ. Vui lòng nhập lại mật khẩu.')
      } else {
        setError(err instanceof Error ? err.message : 'Không thể tạo chunks bằng AI.')
      }
    } finally {
      setIsGeneratingChunks(false)
    }
  }

  function onSplitChunksToCards() {
    const newCards: VocabularyCard[] = []
    const existingWords = new Set(
      cards.map((c) => (c.type === 'vocabulary' ? c.word.toLowerCase() : '')),
    )

    for (const card of cards) {
      if (card.type !== 'vocabulary' || !Array.isArray(card.chunks)) continue

      for (const chunk of card.chunks) {
        const trimmed = chunk.text?.trim()
        if (!trimmed) continue
        const lower = trimmed.toLowerCase()
        if (existingWords.has(lower)) continue
        existingWords.add(lower)

        const chunkAudio = chunk.audioUrl || getYoudaoDictVoiceUrl(trimmed, 2)
        const exampleText = chunk.example || card.example || ''
        const chunkExampleAudio =
          chunk.exampleAudioUrl ||
          (exampleText ? getYoudaoDictVoiceUrl(exampleText, 2) : '')
        const chunkQuery = chunk.imageQuery || trimmed
        const chunkImg = chunk.imageUrl || getBingImageUrl(chunkQuery)

        newCards.push({
          type: 'vocabulary',
          id: `chunk-${Date.now()}-${newCards.length}`,
          selected: true,
          unitNumber: card.unitNumber,
          kind: 'phrase',
          partOfSpeech: normalizePartOfSpeech(chunk.partOfSpeech) || 'phrase',
          word: trimmed,
          maskedWord: generateMaskedWord(trimmed),
          ipa: chunk.ipa || '',
          vietnamese: chunk.meaningVi || card.vietnamese,
          englishDefinition:
            chunk.englishDefinition ||
            `Common lexical chunk related to "${card.word}".`,
          example: exampleText,
          imageUrl: chunkImg,
          imageQuery: chunkQuery,
          wordAudioUrl: chunkAudio,
          exampleAudioUrl: chunkExampleAudio,
          sourceUrl: card.sourceUrl,
          hint: `Lexical Chunk đi liền với "${card.word}"`,
        })
      }
    }

    if (!newCards.length) {
      setStatus('Tất cả các chunks đã tồn tại dưới dạng thẻ độc lập hoặc chưa có chunks nào.')
      return
    }

    setCards((prev) => [...prev, ...newCards])
    setStatus(`Đã tách thành công ${newCards.length} thẻ flashcard độc lập từ các Chunks!`)
  }

  async function onGenerateCards() {
    const totalVocabItems = [...selectedWords, ...selectedPhrases]
    if (!totalVocabItems.length && !selectedNotes.length) {
      setError('Vui lòng chọn ít nhất 1 từ vựng, cụm từ hoặc ghi chú.')
      return
    }
    setError('')
    setStatus(
      `Đang dùng TanStack AI tạo thẻ cho ${selectedWords.length} từ vựng, ${selectedPhrases.length} cụm từ và ${selectedNotes.length} ghi chú…`,
    )
    setIsGenerating(true)

    try {
      const token = getStoredToken()
      const phraseSet = new Set(selectedPhrases)

      const promises: [Promise<any>, Promise<any>] = [
        totalVocabItems.length > 0
          ? generateVocabulary({ data: { words: totalVocabItems, token } })
          : Promise.resolve([]),
        selectedNotes.length > 0
          ? generateNotes({
              data: {
                notes: selectedNotes.map((n) => ({
                  title: n.title,
                  content: n.content,
                })),
                token,
              },
            })
          : Promise.resolve([]),
      ]

      const [generatedVocab, generatedNotes] = await Promise.all(promises)

      const vocabCards: VocabularyCard[] = []
      const createdWordSet = new Set<string>()

      for (const [index, item] of (generatedVocab as any[]).entries()) {
        const isPhrase = phraseSet.has(item.word) || item.word.includes(' ')
        const customImg = itemImages[item.word]
        const hint = phraseHints[item.word]

        const rawChunks = Array.isArray(item.chunks) ? item.chunks : []
        const chunks: LexicalChunk[] = rawChunks.map((c: any) => {
          const text = String(c.text || c || '').trim()
          const exampleText = String(c.example || '').trim()
          const chunkQuery = String(c.imageQuery || text).trim()
          return {
            text,
            ipa: String(c.ipa || '').trim(),
            meaningVi: String(c.meaningVi || '').trim(),
            englishDefinition: String(c.englishDefinition || '').trim(),
            example: exampleText,
            imageQuery: chunkQuery,
            imageUrl: c.imageUrl || (chunkQuery ? getBingImageUrl(chunkQuery) : ''),
            partOfSpeech: normalizePartOfSpeech(c.partOfSpeech) || 'phrase',
            audioUrl: c.audioUrl || (text ? getYoudaoDictVoiceUrl(text, 2) : ''),
            exampleAudioUrl:
              c.exampleAudioUrl ||
              (exampleText ? getYoudaoDictVoiceUrl(exampleText, 2) : ''),
          }
        })

        const mainWordLower = item.word.toLowerCase()
        createdWordSet.add(mainWordLower)

        // 1. Thẻ từ vựng / cụm từ chính
        vocabCards.push({
          type: 'vocabulary',
          id: `vocab-${Date.now()}-${index}`,
          selected: true,
          unitNumber: lesson?.unitNumber,
          kind: isPhrase ? 'phrase' : 'word',
          hint,
          ...item,
          maskedWord: generateMaskedWord(item.word),
          chunks,
          partOfSpeech: item.partOfSpeech || (isPhrase ? 'phrase' : 'noun'),
          imageUrl: customImg || getBingImageUrl(item.imageQuery),
          wordAudioUrl: getYoudaoDictVoiceUrl(item.word, 2),
          exampleAudioUrl: getYoudaoDictVoiceUrl(item.example, 2),
          sourceUrl: lesson?.sourceUrl ?? 'custom-input',
        })

        // 2. Tách Chunks thành các thẻ độc lập hoàn chỉnh: IPA, nghĩa, ví dụ, audio US, ảnh minh họa
        for (const [cIdx, chunk] of chunks.entries()) {
          const chunkText = chunk.text?.trim()
          if (!chunkText) continue
          const chunkLower = chunkText.toLowerCase()
          if (createdWordSet.has(chunkLower)) continue
          createdWordSet.add(chunkLower)

          const chunkAudio = chunk.audioUrl || getYoudaoDictVoiceUrl(chunkText, 2)
          const exampleText = chunk.example || item.example || ''
          const chunkExampleAudio =
            chunk.exampleAudioUrl ||
            (exampleText ? getYoudaoDictVoiceUrl(exampleText, 2) : '')
          const chunkQuery = chunk.imageQuery || chunkText
          const chunkImg = chunk.imageUrl || getBingImageUrl(chunkQuery)

          vocabCards.push({
            type: 'vocabulary',
            id: `vocab-chunk-${Date.now()}-${index}-${cIdx}`,
            selected: true,
            unitNumber: lesson?.unitNumber,
            kind: 'phrase',
            partOfSpeech: chunk.partOfSpeech || 'phrase',
            word: chunkText,
            maskedWord: generateMaskedWord(chunkText),
            ipa: chunk.ipa || '',
            vietnamese: chunk.meaningVi || item.vietnamese,
            englishDefinition:
              chunk.englishDefinition ||
              `Common lexical chunk related to "${item.word}".`,
            example: exampleText,
            imageQuery: chunkQuery,
            imageUrl: chunkImg,
            wordAudioUrl: chunkAudio,
            exampleAudioUrl: chunkExampleAudio,
            sourceUrl: lesson?.sourceUrl ?? 'custom-input',
            hint: `Lexical Chunk đi liền với "${item.word}"`,
          })
        }
      }

      const noteCards: NoteCard[] = generatedNotes.map(
        (item: any, index: number): NoteCard => ({
          type: 'note',
          id: `note-${Date.now()}-${index}`,
          selected: true,
          unitNumber: lesson?.unitNumber,
          title: item.title,
          content: item.content,
          vietnameseExplanation: item.vietnameseExplanation,
          example: item.example,
          exampleAudioUrl: getYoudaoDictVoiceUrl(item.example, 2),
          sourceUrl: lesson?.sourceUrl ?? 'custom-input',
        }),
      )

      const nextCards: AnyAnkiCard[] = [...vocabCards, ...noteCards]
      setCards(nextCards)
      const wordCount = vocabCards.filter((c) => c.kind === 'word').length
      const chunkCount = vocabCards.filter((c) => c.kind === 'phrase').length
      setStatus(
        `Đã tạo thành công ${nextCards.length} thẻ (${wordCount} từ vựng, ${chunkCount} cụm từ/chunks kèm ảnh & âm thanh US, ${noteCards.length} ghi chú).`,
      )
      setStep(3)
    } catch (err) {
      setStatus('')
      if (err instanceof Error && err.message.includes('401')) {
        sessionStorage.removeItem('anki_auth_token')
        setIsAuthenticated(false)
        setAuthError('Phiên xác thực không hợp lệ. Vui lòng nhập lại mật khẩu.')
        return
      }
      setError(err instanceof Error ? err.message : 'Không thể tạo thẻ Anki')
    } finally {
      setIsGenerating(false)
    }
  }

  function patchCard(index: number, patch: Partial<AnyAnkiCard>) {
    setCards((current) =>
      current.map((card, i) => {
        if (i !== index) return card
        const next: any = { ...card, ...patch }
        if (next.type === 'vocabulary') {
          const vPatch = patch as Partial<VocabularyCard>
          if (vPatch.imageUrl !== undefined) {
            next.imageUrl = vPatch.imageUrl
          } else if (vPatch.imageQuery !== undefined) {
            next.imageUrl = getBingImageUrl(vPatch.imageQuery)
          }
          if (vPatch.word !== undefined) {
            next.wordAudioUrl = getYoudaoDictVoiceUrl(vPatch.word, 2)
            if (vPatch.maskedWord === undefined) {
              next.maskedWord = generateMaskedWord(vPatch.word)
            }
          }
          if (vPatch.example !== undefined) {
            next.exampleAudioUrl = getYoudaoDictVoiceUrl(vPatch.example, 2)
          }
          if (vPatch.chunks !== undefined) {
            next.chunks = vPatch.chunks.map((c) => ({
              ...c,
              audioUrl: c.audioUrl || getYoudaoDictVoiceUrl(c.text, 2),
            }))
          }
        } else if (next.type === 'note') {
          const nPatch = patch as Partial<NoteCard>
          if (nPatch.example !== undefined) {
            next.exampleAudioUrl = getYoudaoDictVoiceUrl(nPatch.example, 2)
          }
        }
        return next
      }),
    )
  }

  async function onExport() {
    if (!selectedCards.length) return
    setError('')
    setStatus(`Đang nén ${selectedCards.length} thẻ cùng media thành gói Anki (.apkg)…`)
    setIsExporting(true)

    try {
      const token = getStoredToken()
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { 'x-access-token': token } : {}),
        },
        body: JSON.stringify({ deckName, cards: selectedCards, token }),
      })
      if (!response.ok) {
        if (response.status === 401) {
          sessionStorage.removeItem('anki_auth_token')
          setIsAuthenticated(false)
          setAuthError('Phiên xác thực không hợp lệ. Vui lòng nhập lại mật khẩu.')
          return
        }
        const text = await response.text()
        throw new Error(text || `Xuất thẻ thất bại (${response.status})`)
      }
      const blob = await response.blob()
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = `${deckName
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '') || 'anki-deck'}.apkg`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(href)
      setStatus('Xuất file Anki (.apkg) thành công!')
    } catch (err) {
      setStatus('')
      if (err instanceof Error && err.message.includes('401')) {
        sessionStorage.removeItem('anki_auth_token')
        setIsAuthenticated(false)
        setAuthError('Phiên xác thực không hợp lệ. Vui lòng nhập lại mật khẩu.')
        return
      }
      setError(err instanceof Error ? err.message : 'Không thể xuất file Anki')
    } finally {
      setIsExporting(false)
    }
  }

  // Loading state while verifying existing session token
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-8 text-primary" />
          <span className="text-sm text-muted-foreground animate-pulse">
            Đang kiểm tra quyền truy cập…
          </span>
        </div>
      </div>
    )
  }

  // Lock Screen: blocked until correct password is submitted
  if (!isAuthenticated) {
    return (
      <main className="mx-auto flex min-h-[85vh] max-w-md items-center justify-center px-4 py-12">
        <Card className="w-full border-border/80 bg-card/80 shadow-2xl backdrop-blur-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-xs">
              <LockIcon className="size-7" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl font-bold">Xác thực quyền truy cập</CardTitle>
            <CardDescription>
              Vui lòng nhập mật khẩu bảo vệ để truy cập Anki Deck Builder.
            </CardDescription>
          </CardHeader>
          <CardPanel>
            <form onSubmit={onUnlock} className="flex flex-col gap-4 mt-2">
              {authError && (
                <div className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircleIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span>{authError}</span>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="gate-password"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Mật khẩu hệ thống
                </label>
                <div className="relative">
                  <Input
                    id="gate-password"
                    type={showPassword ? 'text' : 'password'}
                    value={inputPassword}
                    onChange={(e) => setInputPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-4" aria-hidden="true" />
                    ) : (
                      <EyeIcon className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                loading={isVerifying}
                className="w-full gap-2 font-semibold mt-1"
              >
                <KeyRoundIcon className="size-4" aria-hidden="true" />
                Mở khóa ứng dụng
              </Button>
            </form>
          </CardPanel>
        </Card>
      </main>
    )
  }

  const selectedPresetBook = PRESET_BOOKS.find((b) => b.slug === selectedBook)

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 pb-32 sm:px-6 sm:py-12">
      {/* Top Brand Header */}
      <header className="mb-8 flex flex-col gap-3 sm:mb-12">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Badge variant="outline" className="gap-1.5 py-0.5 text-xs font-mono">
              <SparklesIcon className="size-3 text-primary" aria-hidden="true" />
              TanStack AI
            </Badge>
            <span className="text-border">/</span>
            <Badge variant="secondary" className="py-0.5 text-xs font-mono">
              coss.com/ui
            </Badge>
            <span className="text-border">/</span>
            <span>Vocabulary & Notes Anki Builder</span>
          </div>

          {authRequired && (
            <Button
              variant="outline"
              size="xs"
              onClick={onLock}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              title="Khóa ứng dụng"
            >
              <LockIcon className="size-3" aria-hidden="true" />
              Khóa ứng dụng
            </Button>
          )}
        </div>

        <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-5xl text-foreground">
          Tạo Anki Deck Thông Minh
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
          Trích xuất đầy đủ từ vựng (Vocabulary) và các ghi chú cách dùng quan trọng (Language Notes) từ toàn bộ bộ sách English Vocabulary in Use, làm giàu nội dung bằng TanStack AI và xuất file Anki (.apkg) có âm thanh offline.
        </p>
      </header>

      {/* Stepper Navigation */}
      <nav aria-label="Tiến trình các bước" className="mb-8">
        <div className="grid grid-cols-3 gap-2 sm:gap-4 rounded-xl border border-border/80 bg-card/40 p-1.5 sm:p-2 shadow-xs backdrop-blur-xs">
          {/* Step 1 Tab */}
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium transition-all ${
              step === 1
                ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                : step > 1
                  ? 'bg-primary/10 text-primary hover:bg-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold border border-current">
              {step > 1 ? <CheckIcon className="size-3" aria-hidden="true" /> : '1'}
            </span>
            <span className="hidden sm:inline">1. Chọn bài học</span>
            <span className="sm:hidden">Bài học</span>
          </button>

          {/* Step 2 Tab */}
          <button
            type="button"
            onClick={() =>
              (allWords.length > 0 || allPhrases.length > 0 || allNotes.length > 0) &&
              setStep(2)
            }
            disabled={
              allWords.length === 0 &&
              allPhrases.length === 0 &&
              allNotes.length === 0
            }
            className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              step === 2
                ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                : step > 2
                  ? 'bg-primary/10 text-primary hover:bg-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold border border-current">
              {step > 2 ? <CheckIcon className="size-3" aria-hidden="true" /> : '2'}
            </span>
            <span className="hidden sm:inline">2. Chọn nội dung</span>
            <span className="sm:hidden">Nội dung</span>
          </button>

          {/* Step 3 Tab */}
          <button
            type="button"
            onClick={() => cards.length > 0 && setStep(3)}
            disabled={cards.length === 0}
            className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              step === 3
                ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold border border-current">
              3
            </span>
            <span className="hidden sm:inline">3. Xem & Xuất thẻ</span>
            <span className="sm:hidden">Xuất thẻ</span>
          </button>
        </div>
      </nav>

      {/* Global Status / Error Alert Banner */}
      {(status || error) && (
        <div
          role="status"
          className={`mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm transition-all ${
            error
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-primary/30 bg-primary/10 text-foreground'
          }`}
        >
          {error ? (
            <AlertCircleIcon className="size-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
          ) : (
            <CheckCircle2Icon className="size-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
          )}
          <div className="flex-1 font-medium">{error || status}</div>
          <button
            type="button"
            onClick={() => {
              setError('')
              setStatus('')
            }}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* STEP 1: IMPORT / INPUT */}
      {step === 1 && (
        <Card className="border-border/80 bg-card/80 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <BookOpenIcon className="size-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle>Bước 1: Nguồn dữ liệu bài học</CardTitle>
                <CardDescription>
                  Chọn bộ sách và số Unit có sẵn, hoặc dán URL bài học / link data.json tùy ý.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardPanel className="flex flex-col gap-6">
            {/* Input Mode Selector */}
            <div className="flex flex-wrap gap-2 border-b border-border/60 pb-4">
              <Button
                variant={inputMode === 'preset' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setInputMode('preset')}
                className="gap-2"
              >
                <CompassIcon className="size-4" aria-hidden="true" />
                Chọn sách & Unit có sẵn
              </Button>
              <Button
                variant={inputMode === 'url' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setInputMode('url')}
                className="gap-2"
              >
                <LinkIcon className="size-4" aria-hidden="true" />
                Nhập URL / link data.json
              </Button>
              <Button
                variant={inputMode === 'text' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setInputMode('text')}
                className="gap-2"
              >
                <FileTextIcon className="size-4" aria-hidden="true" />
                Dán danh sách từ tự do
              </Button>
            </div>

            {/* Mode 1: Preset Book & Unit Selector */}
            {inputMode === 'preset' && (
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-4">
                  {/* Book Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="book-select" className="text-sm font-semibold text-foreground">
                      Bộ sách English Vocabulary in Use
                    </label>
                    <select
                      id="book-select"
                      value={selectedBook}
                      onChange={(e) => {
                        setSelectedBook(e.target.value)
                        const book = PRESET_BOOKS.find((b) => b.slug === e.target.value)
                        if (book && unitNumber > book.totalUnits) {
                          setUnitNumber(1)
                        }
                      }}
                      className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-sm font-medium shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      {PRESET_BOOKS.map((book) => (
                        <option key={book.slug} value={book.slug}>
                          {book.title} ({book.level} - {book.totalUnits} Units)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Unit Picker */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="unit-number" className="text-sm font-semibold text-foreground">
                      Số Unit (1 - {selectedPresetBook?.totalUnits || 100})
                    </label>
                    <Input
                      id="unit-number"
                      type="number"
                      min={1}
                      max={selectedPresetBook?.totalUnits || 100}
                      value={unitNumber}
                      onChange={(e) => setUnitNumber(Math.max(1, Number(e.target.value)))}
                      className="font-mono text-sm font-bold"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/20 bg-primary/5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <InfoIcon className="size-4 text-primary shrink-0" aria-hidden="true" />
                    <span>
                      Hệ thống sẽ tự động bóc tách từ vựng, hình ảnh, cụm từ chính và ghi chú của{' '}
                      <strong className="text-foreground">
                        {selectedPresetBook?.title} (Unit {unitNumber})
                      </strong>.
                    </span>
                  </div>
                  <Button
                    onClick={onAnalyze}
                    loading={isAnalyzing}
                    className="shrink-0 gap-2 font-semibold w-full sm:w-auto"
                  >
                    <SparklesIcon className="size-4" aria-hidden="true" />
                    Phân tích bài học
                  </Button>
                </div>
              </div>
            )}

            {/* Mode 2: Custom URL input */}
            {inputMode === 'url' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="lesson-url" className="text-sm font-semibold text-foreground">
                    URL bài học hoặc link file data.json
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <Input
                      id="lesson-url"
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://www.essentialenglish.review/apps/... hoặc https://.../data.json"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={1}
                      max={150}
                      value={urlUnitOverride}
                      onChange={(e) => setUrlUnitOverride(e.target.value)}
                      placeholder="Unit # (tùy chọn)"
                      className="w-full sm:w-32 font-mono"
                      title="Chỉ định số Unit nếu link data.json không có số unit"
                    />
                    <Button
                      onClick={onAnalyze}
                      loading={isAnalyzing}
                      className="shrink-0 gap-2 font-semibold"
                    >
                      <SparklesIcon className="size-4" aria-hidden="true" />
                      Phân tích bài học
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Hỗ trợ link bài học trực tuyến (ví dụ: <code className="font-mono text-primary">/apps/english-vocabulary-in-use-upper-intermediate/unit-9-...</code>) hoặc link JSON trực tiếp (<code className="font-mono text-primary">.../data/data.json</code>).
                  </p>
                </div>
              </div>
            )}

            {/* Mode 3: Text input */}
            {inputMode === 'text' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="custom-words" className="text-sm font-semibold text-foreground">
                    Dán các từ vựng tiếng Anh (mỗi dòng hoặc phân tách bằng dấu phẩy)
                  </label>
                  <Textarea
                    id="custom-words"
                    rows={5}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="elbow&#10;kneel&#10;shoulder&#10;waist&#10;eyebrow"
                    className="font-mono text-sm"
                  />
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-muted-foreground">
                      Đã phát hiện: {parseCustomWords(rawText).length} từ hợp lệ
                    </span>
                    <Button
                      onClick={onProceedWithText}
                      disabled={parseCustomWords(rawText).length === 0}
                      className="gap-2 font-semibold"
                    >
                      Tiếp tục chọn từ
                      <ArrowRightIcon className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Deck Name setting */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
              <label htmlFor="deck-name" className="text-sm font-semibold text-foreground">
                Tên Deck Anki
              </label>
              <Input
                id="deck-name"
                type="text"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="English Vocabulary in Use::Unit 9"
              />
              <p className="text-xs text-muted-foreground">
                Mẹo Anki: Dùng ký tự <code className="rounded bg-muted px-1.5 py-0.5 text-primary font-mono text-[0.8rem]">::</code> để tạo cấu trúc cây thư mục (ví dụ: <code className="text-muted-foreground font-mono">English Vocabulary in Use::Unit 9: The body and movement</code>).
              </p>
            </div>
          </CardPanel>
        </Card>
      )}

      {/* STEP 2: CONTENT SELECTION (VOCABULARY & NOTES) */}
      {step === 2 && (
        <div className="flex flex-col gap-6">
          {/* Header summary of extracted unit */}
          <Card className="border-border/80 bg-card/80 backdrop-blur-md">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <CheckSquareIcon className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Bước 2: Chọn nội dung bài học</CardTitle>
                    <CardDescription className="text-sm">
                      {lesson?.bookTitle ? `${lesson.bookTitle} — ` : ''}
                      <span className="font-semibold text-foreground">
                        {lesson?.unitTitle || 'Danh sách tùy chỉnh'}
                      </span>
                    </CardDescription>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">
                    {selectedWords.length} / {allWords.length} từ vựng
                  </Badge>
                  {allPhrases.length > 0 && (
                    <Badge
                      variant="outline"
                      className="text-xs font-mono border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10"
                    >
                      {selectedPhrases.length} / {allPhrases.length} cụm từ
                    </Badge>
                  )}
                  {allNotes.length > 0 && (
                    <Badge variant="secondary" className="text-xs font-mono">
                      {selectedNotes.length} / {allNotes.length} ghi chú
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Section 1: Vocabulary List (Single / Core Words) */}
          {allWords.length > 0 && (
            <Card className="border-border/80 bg-card/80 backdrop-blur-md">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <BookmarkIcon className="size-4 text-primary" aria-hidden="true" />
                    <CardTitle className="text-base font-bold">
                      1. Danh sách từ vựng (Vocabulary Words)
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {selectedWords.length} đã chọn
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() =>
                        setCheckedWords(
                          Object.fromEntries(allWords.map((w) => [w, true])),
                        )
                      }
                    >
                      Chọn tất cả ({allWords.length})
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        setCheckedWords(
                          Object.fromEntries(allWords.map((w) => [w, false])),
                        )
                      }
                    >
                      Bỏ chọn
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardPanel className="flex flex-col gap-4">
                {/* Search Filter */}
                <div className="relative">
                  <Input
                    type="search"
                    value={wordFilter}
                    onChange={(e) => setWordFilter(e.target.value)}
                    placeholder="Tìm nhanh từ vựng..."
                    className="pl-9 text-xs sm:text-sm"
                  />
                  <SearchIcon
                    className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>

                {/* Word Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[380px] overflow-y-auto p-1 pr-2 rounded-xl border border-border/40 bg-muted/20">
                  {filteredWords.map((word) => {
                    const isChecked = checkedWords[word] !== false
                    return (
                      <label
                        key={word}
                        className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-sm font-medium cursor-pointer transition-all select-none ${
                          isChecked
                            ? 'border-primary/50 bg-primary/10 text-foreground shadow-xs'
                            : 'border-border/40 bg-card/40 text-muted-foreground hover:border-border hover:bg-card/70'
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(c) =>
                            setCheckedWords((old) => ({
                              ...old,
                              [word]: Boolean(c),
                            }))
                          }
                        />
                        <span className="truncate flex-1 font-mono text-xs sm:text-sm">
                          {word}
                        </span>
                      </label>
                    )
                  })}
                  {filteredWords.length === 0 && (
                    <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                      Không tìm thấy từ vựng nào khớp với &quot;{wordFilter}&quot;.
                    </div>
                  )}
                </div>
              </CardPanel>
            </Card>
          )}

          {/* Section 2: Key Phrases & Expressions (Split into Individual Flashcards) */}
          {(allPhrases.length > 0 || allWords.length > 0) && (
            <Card className="border-border/80 bg-card/80 backdrop-blur-md">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <SparklesIcon className="size-4 text-purple-500" aria-hidden="true" />
                    <CardTitle className="text-base font-bold">
                      2. Cụm từ &amp; Chunks bài học (Key Phrases &amp; Lexical Chunks)
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="text-xs border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10"
                    >
                      {selectedPhrases.length} đã chọn
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="xs"
                      className="border-purple-500/40 text-purple-600 dark:text-purple-300 hover:bg-purple-500/10 gap-1.5"
                      onClick={onGenerateAiChunks}
                      disabled={
                        isGeneratingChunks ||
                        (allWords.length === 0 && !lesson?.notes?.length)
                      }
                    >
                      {isGeneratingChunks ? (
                        <>
                          <Loader2Icon className="size-3 animate-spin" />
                          Đang tạo Chunks...
                        </>
                      ) : (
                        <>
                          <SparklesIcon className="size-3 text-purple-500" />
                          Tạo thêm Chunks bằng AI
                        </>
                      )}
                    </Button>
                    {allPhrases.length > 0 && (
                      <>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() =>
                            setCheckedPhrases(
                              Object.fromEntries(allPhrases.map((p) => [p, true])),
                            )
                          }
                        >
                          Chọn tất cả ({allPhrases.length})
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            setCheckedPhrases(
                              Object.fromEntries(allPhrases.map((p) => [p, false])),
                            )
                          }
                        >
                          Bỏ chọn
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <CardDescription className="text-xs">
                  Mỗi cụm từ/thành ngữ/chunks dưới đây sẽ được tạo thành{' '}
                  <strong className="text-foreground">1 thẻ từ vựng Anki độc lập</strong>{' '}
                  (có phiên âm, dịch nghĩa tiếng Việt, định nghĩa tiếng Anh, câu ví dụ và âm thanh riêng).
                </CardDescription>
              </CardHeader>

              <CardPanel className="flex flex-col gap-4">
                {allPhrases.length === 0 ? (
                  <div className="text-center py-6 px-4 rounded-xl border border-dashed border-border/70 flex flex-col items-center justify-center gap-2">
                    <p className="text-xs text-muted-foreground max-w-md">
                      Bài học này chưa có sẵn cụm từ trích xuất từ SGK. Bạn có thể nhấn &quot;Tạo thêm Chunks bằng AI&quot; để AI trích xuất các cụm lexical chunks tự nhiên từ các từ vựng và bài đọc của unit.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-purple-500/40 text-purple-600 dark:text-purple-300 hover:bg-purple-500/10 gap-1.5"
                      onClick={onGenerateAiChunks}
                      disabled={
                        isGeneratingChunks ||
                        (allWords.length === 0 && !lesson?.notes?.length)
                      }
                    >
                      {isGeneratingChunks ? (
                        <>
                          <Loader2Icon className="size-3.5 animate-spin" />
                          Đang phân tích và tạo Chunks...
                        </>
                      ) : (
                        <>
                          <SparklesIcon className="size-3.5 text-purple-500" />
                          Tạo Lexical Chunks bằng AI ngay
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Search Filter for Phrases */}
                    <div className="relative">
                      <Input
                        type="search"
                        value={phraseFilter}
                        onChange={(e) => setPhraseFilter(e.target.value)}
                        placeholder="Tìm nhanh cụm từ / thành ngữ trong bài..."
                        className="pl-9 text-xs sm:text-sm"
                      />
                      <SearchIcon
                        className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>

                    {/* Phrases Grid / List */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto p-1 pr-2 rounded-xl border border-border/40 bg-muted/20">
                  {filteredPhrases.map((phrase) => {
                    const isChecked = checkedPhrases[phrase] !== false
                    const hint = phraseHints[phrase]
                    const hasOriginalImage = Boolean(itemImages[phrase])

                    return (
                      <label
                        key={phrase}
                        className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all select-none ${
                          isChecked
                            ? 'border-purple-500/50 bg-purple-500/10 text-foreground shadow-xs'
                            : 'border-border/40 bg-card/40 text-muted-foreground hover:border-border hover:bg-card/70'
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(c) =>
                            setCheckedPhrases((old) => ({
                              ...old,
                              [phrase]: Boolean(c),
                            }))
                          }
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm font-mono text-foreground">
                              {phrase}
                            </span>
                            {hasOriginalImage && (
                              <Badge
                                variant="secondary"
                                className="text-[0.65rem] px-1.5 py-0 h-4 font-normal"
                              >
                                Ảnh SGK
                              </Badge>
                            )}
                          </div>
                          {hint && (
                            <span className="text-xs text-muted-foreground/90 italic truncate">
                              💡 {hint}
                            </span>
                          )}
                        </div>
                      </label>
                    )
                  })}
                  {filteredPhrases.length === 0 && (
                    <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                      Không tìm thấy cụm từ nào khớp với &quot;{phraseFilter}&quot;.
                    </div>
                  )}
                </div>
                  </>
                )}
              </CardPanel>
            </Card>
          )}

          {/* Section 3: Language Notes (General Grammar & Rules) */}
          {allNotes.length > 0 && (
            <Card className="border-border/80 bg-card/80 backdrop-blur-md">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <FileTextIcon className="size-4 text-amber-500" aria-hidden="true" />
                    <CardTitle className="text-base font-bold">
                      3. Ghi chú quy tắc &amp; Lời khuyên (Language Notes)
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="text-xs border-amber-500/30 text-amber-500 bg-amber-500/10"
                    >
                      {selectedNotes.length} đã chọn
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() =>
                        setCheckedNotes(
                          Object.fromEntries(allNotes.map((n) => [n.id, true])),
                        )
                      }
                    >
                      Chọn tất cả ({allNotes.length})
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        setCheckedNotes(
                          Object.fromEntries(allNotes.map((n) => [n.id, false])),
                        )
                      }
                    >
                      Bỏ chọn
                    </Button>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  Tùy chọn tạo thêm thẻ ghi chú quy tắc hoặc lưu ý tổng quan của bài học (mỗi mục thành 1 Note Card).
                </CardDescription>
              </CardHeader>

              <CardPanel className="flex flex-col gap-3">
                {allNotes.map((note) => {
                  const isChecked = checkedNotes[note.id] !== false
                  return (
                    <div
                      key={note.id}
                      className={`flex flex-col gap-2 rounded-xl border p-3.5 transition-all ${
                        isChecked
                          ? 'border-amber-500/40 bg-amber-500/5'
                          : 'border-border/40 bg-card/40 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(c) =>
                              setCheckedNotes((old) => ({
                                ...old,
                                [note.id]: Boolean(c),
                              }))
                            }
                          />
                          <span className="font-bold text-sm text-foreground">
                            {note.title}
                          </span>
                        </label>
                        {note.sectionLetter && (
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs font-bold"
                          >
                            Mục {note.sectionLetter}
                          </Badge>
                        )}
                      </div>

                      {/* Content snippet */}
                      <div className="pl-6 flex flex-col gap-1 pt-1 text-xs text-muted-foreground">
                        {note.content.map((line, pIdx) => (
                          <div key={pIdx} className="leading-relaxed">
                            • {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </CardPanel>
            </Card>
          )}

          {/* Bottom Action Footer */}
          <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-2">
            <Button variant="ghost" onClick={() => setStep(1)} className="gap-2">
              <ArrowLeftIcon className="size-4" aria-hidden="true" />
              Quay lại Bước 1
            </Button>

            <Button
              onClick={onGenerateCards}
              loading={isGenerating}
              disabled={
                selectedWords.length === 0 &&
                selectedPhrases.length === 0 &&
                selectedNotes.length === 0
              }
              className="gap-2 font-semibold shadow-md"
            >
              <SparklesIcon className="size-4" aria-hidden="true" />
              Tạo Anki Deck (
              {[
                selectedWords.length > 0 ? `${selectedWords.length} từ vựng` : '',
                selectedPhrases.length > 0 ? `${selectedPhrases.length} cụm từ` : '',
                selectedNotes.length > 0 ? `${selectedNotes.length} ghi chú` : '',
              ]
                .filter(Boolean)
                .join(', ') || 'Chưa chọn nội dung'}
              )
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: CARD REVIEW & EXPORT */}
      {step === 3 && (
        <div className="flex flex-col gap-6">
          {/* Deck Configuration & Header Banner */}
          <Card className="border-border/80 bg-card/80 backdrop-blur-md">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <LayersIcon className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Bước 3: Xem & Tinh chỉnh thẻ Anki</CardTitle>
                    <CardDescription>
                      Đã tạo <span className="font-semibold text-foreground">{cards.length}</span> thẻ
                      flashcard ({wordCardCount} từ vựng, {phraseCardCount} cụm từ
                      {noteCardCount > 0 ? `, ${noteCardCount} ghi chú` : ''}). Bạn có thể chỉnh sửa trước khi xuất file.
                    </CardDescription>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(2)}
                  className="gap-2 shrink-0 self-start sm:self-auto"
                >
                  <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
                  Chọn lại nội dung
                </Button>
              </div>
            </CardHeader>

            <CardPanel className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/20">
                <label
                  htmlFor="review-deck-name"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                >
                  Tên Deck Anki:
                </label>
                <Input
                  id="review-deck-name"
                  type="text"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  className="flex-1 font-medium text-sm"
                />
              </div>

              {/* Card Type & POS Filter Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-semibold text-muted-foreground">Lọc hiển thị:</span>
                <Button
                  variant={cardFilterType === 'all' ? 'default' : 'outline'}
                  size="xs"
                  onClick={() => setCardFilterType('all')}
                >
                  Tất cả ({cards.length})
                </Button>
                {adjCount > 0 && (
                  <Button
                    variant={cardFilterType === 'adjective' ? 'default' : 'outline'}
                    size="xs"
                    onClick={() => setCardFilterType('adjective')}
                    className={
                      cardFilterType === 'adjective'
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                    }
                  >
                    Tính từ ({adjCount})
                  </Button>
                )}
                {advCount > 0 && (
                  <Button
                    variant={cardFilterType === 'adverb' ? 'default' : 'outline'}
                    size="xs"
                    onClick={() => setCardFilterType('adverb')}
                    className={
                      cardFilterType === 'adverb'
                        ? 'bg-teal-600 hover:bg-teal-700 text-white'
                        : 'border-teal-500/40 text-teal-600 dark:text-teal-400 hover:bg-teal-500/10'
                    }
                  >
                    Trạng từ ({advCount})
                  </Button>
                )}
                {nounCount > 0 && (
                  <Button
                    variant={cardFilterType === 'noun' ? 'default' : 'outline'}
                    size="xs"
                    onClick={() => setCardFilterType('noun')}
                    className={
                      cardFilterType === 'noun'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10'
                    }
                  >
                    Danh từ ({nounCount})
                  </Button>
                )}
                {verbCount > 0 && (
                  <Button
                    variant={cardFilterType === 'verb' ? 'default' : 'outline'}
                    size="xs"
                    onClick={() => setCardFilterType('verb')}
                    className={
                      cardFilterType === 'verb'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                    }
                  >
                    Động từ ({verbCount})
                  </Button>
                )}
                {phraseCardCount > 0 && (
                  <Button
                    variant={cardFilterType === 'phrase' ? 'default' : 'outline'}
                    size="xs"
                    onClick={() => setCardFilterType('phrase')}
                    className={
                      cardFilterType === 'phrase'
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'border-purple-500/40 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10'
                    }
                  >
                    Cụm từ ({phraseCardCount})
                  </Button>
                )}
                {noteCardCount > 0 && (
                  <Button
                    variant={cardFilterType === 'note' ? 'default' : 'outline'}
                    size="xs"
                    onClick={() => setCardFilterType('note')}
                  >
                    Ghi chú ({noteCardCount})
                  </Button>
                )}
                {cards.some(
                  (c) =>
                    c.type === 'vocabulary' && c.chunks && c.chunks.length > 0,
                ) && (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={onSplitChunksToCards}
                    className="border-purple-500/40 text-purple-600 dark:text-purple-300 hover:bg-purple-500/10 ml-auto gap-1.5"
                    title="Chuyển tất cả Lexical Chunks trong các thẻ thành các thẻ từ vựng Anki độc lập"
                  >
                    <SparklesIcon className="size-3 text-purple-500" />
                    Tách Chunks thành thẻ riêng
                  </Button>
                )}
              </div>
            </CardPanel>
          </Card>

          {/* Cards List */}
          <div className="flex flex-col gap-5">
            {displayedCards.map((card, index) => {
              const realIndex = cards.findIndex((c) => c.id === card.id)

              if (card.type === 'note') {
                return (
                  <CardFrame
                    key={card.id}
                    className={`transition-all ${
                      card.selected
                        ? 'border-amber-500/40 bg-card/80 shadow-xs'
                        : 'opacity-60 border-dashed border-border/40'
                    }`}
                  >
                    <CardFrameHeader className="border-b border-border/40 pb-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="flex size-6 items-center justify-center rounded-md bg-amber-500/10 text-xs font-mono font-bold text-amber-500">
                          #{realIndex + 1}
                        </span>
                        <Badge variant="outline" className="border-amber-500/30 text-amber-500 font-bold text-xs">
                          LANGUAGE NOTE
                        </Badge>
                        <CardFrameTitle className="text-base font-bold text-foreground">
                          {card.title}
                        </CardFrameTitle>
                      </div>

                      <CardFrameAction>
                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
                          <Checkbox
                            checked={card.selected}
                            onCheckedChange={(c) =>
                              patchCard(realIndex, { selected: Boolean(c) })
                            }
                          />
                          <span>Bao gồm trong deck</span>
                        </label>
                      </CardFrameAction>
                    </CardFrameHeader>

                    <div className="p-5 flex flex-col gap-4">
                      {/* Audio Button */}
                      {card.example && (
                        <div className="flex items-center gap-2 pb-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => playAudio(card.exampleAudioUrl)}
                            className="gap-1.5 text-xs"
                          >
                            <Volume2Icon className="size-3.5 text-primary" aria-hidden="true" />
                            Nghe câu ví dụ ghi chú (US)
                          </Button>
                        </div>
                      )}

                      {/* Title input */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
                          Tiêu đề ghi chú (Topic Title)
                        </label>
                        <Input
                          size="sm"
                          value={card.title}
                          onChange={(e) => patchCard(realIndex, { title: e.target.value })}
                          className="font-semibold text-sm"
                        />
                      </div>

                      {/* Content Bullet Items */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
                          Các cụm từ / Quy tắc trọng tâm (mỗi dòng 1 ý)
                        </label>
                        <Textarea
                          size="sm"
                          rows={3}
                          value={card.content.join('\n')}
                          onChange={(e) =>
                            patchCard(realIndex, {
                              content: e.target.value
                                .split('\n')
                                .map((l) => l.trim())
                                .filter(Boolean),
                            })
                          }
                          className="font-mono text-xs"
                        />
                      </div>

                      {/* Vietnamese Explanation */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
                          Giải thích tiếng Việt (Vietnamese Explanation)
                        </label>
                        <Input
                          size="sm"
                          value={card.vietnameseExplanation}
                          onChange={(e) =>
                            patchCard(realIndex, { vietnameseExplanation: e.target.value })
                          }
                          className="text-sm"
                        />
                      </div>

                      {/* Example Sentence */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
                          Câu ví dụ ngữ cảnh (Example Sentence)
                        </label>
                        <Textarea
                          size="sm"
                          value={card.example}
                          onChange={(e) => patchCard(realIndex, { example: e.target.value })}
                          className="text-sm italic"
                        />
                      </div>
                    </div>
                  </CardFrame>
                )
              }

              // Vocabulary Card Render
              return (
                <CardFrame
                  key={card.id}
                  className={`transition-all ${
                    card.selected
                      ? 'border-border/80 shadow-xs'
                      : 'opacity-60 border-dashed border-border/40'
                  }`}
                >
                  <CardFrameHeader>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-mono font-bold text-muted-foreground">
                        #{realIndex + 1}
                      </span>
                      {(() => {
                        const pos = getPosInfo(
                          card.partOfSpeech || (card.kind === 'phrase' ? 'phrase' : 'noun'),
                        )
                        return (
                          <Badge
                            variant="outline"
                            className={`font-bold text-xs ${pos.badgeClass}`}
                          >
                            {pos.labelVi} • {pos.abbr}
                          </Badge>
                        )
                      })()}
                      <CardFrameTitle className="text-base font-bold text-foreground">
                        {card.word}
                      </CardFrameTitle>
                      {card.hint && (
                        <span className="text-xs text-muted-foreground bg-muted/70 px-2 py-0.5 rounded border border-border/40 font-normal">
                          💡 {card.hint}
                        </span>
                      )}
                      {card.ipa && (
                        <Badge variant="outline" className="font-mono text-xs">
                          {card.ipa}
                        </Badge>
                      )}
                      {card.vietnamese && (
                        <Badge variant="secondary" className="text-xs font-medium">
                          {card.vietnamese}
                        </Badge>
                      )}
                    </div>

                    <CardFrameAction>
                      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
                        <Checkbox
                          checked={card.selected}
                          onCheckedChange={(c) =>
                            patchCard(realIndex, { selected: Boolean(c) })
                          }
                        />
                        <span>Bao gồm trong deck</span>
                      </label>
                    </CardFrameAction>
                  </CardFrameHeader>

                  {/* Body: Two columns layout */}
                  <div className="p-5 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
                    {/* Left Column: Image & Image Query */}
                    <VocabularyImageEditor
                      card={card}
                      realIndex={realIndex}
                      patchCard={patchCard}
                    />

                    {/* Right Column: Editable fields & Audio buttons */}
                    <div className="flex flex-col gap-4">
                      {/* Audio Preview Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pb-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => playAudio(card.wordAudioUrl)}
                          className="gap-1.5 text-xs"
                        >
                          <Volume2Icon className="size-3.5 text-primary" aria-hidden="true" />
                          Nghe phát âm từ (US)
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => playAudio(card.exampleAudioUrl)}
                          className="gap-1.5 text-xs"
                        >
                          <Volume2Icon className="size-3.5 text-primary" aria-hidden="true" />
                          Nghe câu ví dụ (US)
                        </Button>
                      </div>

                      {/* Word, POS & IPA row */}
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px_1fr] gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
                            Từ vựng (Word)
                          </label>
                          <Input
                            size="sm"
                            value={card.word}
                            onChange={(e) => patchCard(realIndex, { word: e.target.value })}
                            className="font-medium"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
                              Loại từ (POS)
                            </label>
                            <span className="text-[0.65rem] text-muted-foreground font-mono">
                              {getPosInfo(card.partOfSpeech).abbr}
                            </span>
                          </div>
                          <select
                            value={
                              normalizePartOfSpeech(card.partOfSpeech) ||
                              (card.kind === 'phrase' ? 'phrase' : 'noun')
                            }
                            onChange={(e) => {
                              const newPos = e.target.value
                              const isPhr =
                                newPos === 'phrase' ||
                                newPos === 'phrasal verb' ||
                                newPos === 'idiom'
                              patchCard(realIndex, {
                                partOfSpeech: newPos,
                                kind: isPhr ? 'phrase' : 'word',
                              })
                            }}
                            className="h-8 w-full rounded-lg border border-input bg-card px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                          >
                            {QUICK_POS_OPTIONS.map((opt) => (
                              <option
                                key={opt.code}
                                value={opt.code}
                                className="bg-popover text-popover-foreground"
                              >
                                {opt.label}
                              </option>
                            ))}
                            <option
                              value="conjunction"
                              className="bg-popover text-popover-foreground"
                            >
                              Liên từ (conj.)
                            </option>
                            <option
                              value="pronoun"
                              className="bg-popover text-popover-foreground"
                            >
                              Đại từ (pron.)
                            </option>
                            <option
                              value="interjection"
                              className="bg-popover text-popover-foreground"
                            >
                              Thán từ (int.)
                            </option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
                            Phiên âm (IPA - US)
                          </label>
                          <Input
                            size="sm"
                            value={card.ipa}
                            onChange={(e) => patchCard(realIndex, { ipa: e.target.value })}
                            className="font-mono"
                          />
                        </div>
                      </div>

                      {/* Vietnamese Translation */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
                          Nghĩa tiếng Việt
                        </label>
                        <Input
                          size="sm"
                          value={card.vietnamese}
                          onChange={(e) =>
                            patchCard(realIndex, { vietnamese: e.target.value })
                          }
                        />
                      </div>

                      {/* Gợi ý gõ từ (Cloze Pattern & Typing Practice) */}
                      <div className="flex flex-col gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 sm:p-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">🔤</span>
                            <label className="text-[0.7rem] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                              Gợi ý gõ từ (Cloze Pattern & Gõ Thử)
                            </label>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="h-6 text-[0.7rem] text-amber-700 dark:text-amber-300 hover:bg-amber-500/15 gap-1 cursor-pointer"
                            title="Tạo lại mẫu che từ tự động"
                            onClick={() => {
                              patchCard(realIndex, {
                                maskedWord: generateMaskedWord(card.word),
                              })
                            }}
                          >
                            <RefreshCwIcon className="size-2.5" />
                            Tạo lại mẫu
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-[0.68rem] text-muted-foreground">
                              Mẫu hiển thị trên mặt trước thẻ Anki:
                            </span>
                            <Input
                              size="sm"
                              value={card.maskedWord ?? generateMaskedWord(card.word)}
                              onChange={(e) =>
                                patchCard(realIndex, { maskedWord: e.target.value })
                              }
                              className="font-mono text-xs font-semibold tracking-wider text-amber-900 dark:text-amber-200 bg-background"
                              placeholder={generateMaskedWord(card.word)}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[0.68rem] text-muted-foreground">
                              Xem trước mẫu gợi ý:
                            </span>
                            <div className="h-8 flex items-center px-2.5 rounded-md border border-dashed border-amber-500/40 bg-background font-mono text-xs font-bold tracking-widest text-amber-700 dark:text-amber-300 select-all">
                              {card.maskedWord || generateMaskedWord(card.word)}
                            </div>
                          </div>
                        </div>

                        <CardTypingTester
                          targetWord={card.word}
                          maskedWord={card.maskedWord || generateMaskedWord(card.word)}
                        />
                      </div>

                      {/* English Definition */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
                          Định nghĩa tiếng Anh (English Definition)
                        </label>
                        <Textarea
                          size="sm"
                          value={card.englishDefinition}
                          onChange={(e) =>
                            patchCard(realIndex, {
                              englishDefinition: e.target.value,
                            })
                          }
                        />
                      </div>

                      {/* Example Sentence */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
                          Câu ví dụ (Example Sentence)
                        </label>
                        <Textarea
                          size="sm"
                          value={card.example}
                          onChange={(e) =>
                            patchCard(realIndex, { example: e.target.value })
                          }
                        />
                      </div>

                      {/* Lexical Chunks (Cụm từ tự nhiên đi kèm) */}
                      <div className="flex flex-col gap-2 rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 sm:p-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <SparklesIcon className="size-3.5 text-purple-500" aria-hidden="true" />
                            <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                              Lexical Chunks (Cụm từ tự nhiên đi kèm)
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-[0.65rem] px-1.5 py-0 h-4 bg-purple-500/10 text-purple-600 dark:text-purple-300 font-mono"
                            >
                              {(card.chunks || []).length}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="h-6 text-[0.7rem] text-purple-600 dark:text-purple-400 hover:text-purple-700 hover:bg-purple-500/15 gap-1"
                            onClick={() => {
                              const currentChunks = card.chunks || []
                              patchCard(realIndex, {
                                chunks: [...currentChunks, { text: '', meaningVi: '' }],
                              })
                            }}
                          >
                            <PlusIcon className="size-3" aria-hidden="true" />
                            Thêm chunk
                          </Button>
                        </div>

                        {(!card.chunks || card.chunks.length === 0) ? (
                          <p className="text-[0.75rem] text-muted-foreground italic">
                            Chưa có chunks nào cho từ này. Nhấn &quot;Thêm chunk&quot; để bổ sung cụm từ đi kèm.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {card.chunks.map((chunk, cIdx) => (
                              <div
                                key={cIdx}
                                className="flex flex-col gap-2 p-2.5 rounded-lg bg-background/80 border border-border/60"
                              >
                                <div className="flex items-center gap-2">
                                  {chunk.text && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 shrink-0 text-muted-foreground hover:text-primary"
                                      title="Nghe phát âm chunk (US)"
                                      onClick={() =>
                                        playAudio(
                                          chunk.audioUrl ||
                                            getYoudaoDictVoiceUrl(chunk.text, 2),
                                        )
                                      }
                                    >
                                      <Volume2Icon className="size-3.5" aria-hidden="true" />
                                    </Button>
                                  )}
                                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1.3fr_110px_1fr] gap-2">
                                    <Input
                                      size="sm"
                                      placeholder="Cụm từ (e.g. take advantage of)"
                                      value={chunk.text}
                                      onChange={(e) => {
                                        const newChunks = [...(card.chunks || [])]
                                        newChunks[cIdx] = {
                                          ...newChunks[cIdx],
                                          text: e.target.value,
                                        }
                                        patchCard(realIndex, { chunks: newChunks })
                                      }}
                                      className="h-7 text-xs font-mono font-medium"
                                    />
                                    <Input
                                      size="sm"
                                      placeholder="IPA (US)"
                                      value={chunk.ipa || ''}
                                      onChange={(e) => {
                                        const newChunks = [...(card.chunks || [])]
                                        newChunks[cIdx] = {
                                          ...newChunks[cIdx],
                                          ipa: e.target.value,
                                        }
                                        patchCard(realIndex, { chunks: newChunks })
                                      }}
                                      className="h-7 text-xs font-mono"
                                    />
                                    <Input
                                      size="sm"
                                      placeholder="Nghĩa tiếng Việt"
                                      value={chunk.meaningVi}
                                      onChange={(e) => {
                                        const newChunks = [...(card.chunks || [])]
                                        newChunks[cIdx] = {
                                          ...newChunks[cIdx],
                                          meaningVi: e.target.value,
                                        }
                                        patchCard(realIndex, { chunks: newChunks })
                                      }}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                                    title="Xóa chunk"
                                    onClick={() => {
                                      const newChunks = (card.chunks || []).filter(
                                        (_, idx) => idx !== cIdx,
                                      )
                                      patchCard(realIndex, { chunks: newChunks })
                                    }}
                                  >
                                    <Trash2Icon className="size-3.5" aria-hidden="true" />
                                  </Button>
                                </div>

                                <div className="flex items-center gap-2 pl-9">
                                  <div className="flex-1">
                                    <Input
                                      size="sm"
                                      placeholder="Câu ví dụ cho cụm từ này..."
                                      value={chunk.example || ''}
                                      onChange={(e) => {
                                        const newChunks = [...(card.chunks || [])]
                                        newChunks[cIdx] = {
                                          ...newChunks[cIdx],
                                          example: e.target.value,
                                        }
                                        patchCard(realIndex, { chunks: newChunks })
                                      }}
                                      className="h-7 text-xs italic"
                                    />
                                  </div>
                                  {chunk.example && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 shrink-0 text-muted-foreground hover:text-primary"
                                      title="Nghe câu ví dụ của chunk (US)"
                                      onClick={() =>
                                        playAudio(
                                          chunk.exampleAudioUrl ||
                                            getYoudaoDictVoiceUrl(chunk.example!, 2),
                                        )
                                      }
                                    >
                                      <Volume2Icon className="size-3.5" aria-hidden="true" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardFrame>
              )
            })}
          </div>

          {/* Sticky Bottom Export Action Bar */}
          <div className="sticky bottom-6 z-30 mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card/90 p-4 shadow-2xl backdrop-blur-lg">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
                {selectedCards.length}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">
                  {selectedCards.length} thẻ flashcard sẵn sàng xuất
                </span>
                <span className="text-xs text-muted-foreground">
                  Bao gồm {selectedCards.filter((c) => c.type === 'vocabulary').length} thẻ từ vựng và{' '}
                  {selectedCards.filter((c) => c.type === 'note').length} thẻ ghi chú kèm âm thanh offline.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="flex-1 sm:flex-none"
              >
                Chọn lại nội dung
              </Button>
              <Button
                onClick={onExport}
                loading={isExporting}
                disabled={selectedCards.length === 0}
                className="flex-1 sm:flex-none gap-2 font-semibold shadow-md"
              >
                <DownloadIcon className="size-4" aria-hidden="true" />
                Xuất file Anki (.apkg)
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
