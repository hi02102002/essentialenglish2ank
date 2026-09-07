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
} from 'lucide-react'
import {
  analyzeLesson,
  generateVocabulary,
  generateNotes,
  checkAuthRequirement,
  verifyPassword,
  verifySessionToken,
} from '@/server/functions'
import { PRESET_BOOKS } from '@/server/lesson'
import { getBingImageUrl } from '@/lib/bing-image'
import { getYoudaoDictVoiceUrl } from '@/lib/youdao'
import type {
  AnyAnkiCard,
  ExtractedNote,
  LessonAnalysis,
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

  const [allNotes, setAllNotes] = useState<ExtractedNote[]>([])
  const [checkedNotes, setCheckedNotes] = useState<Record<string, boolean>>({})

  // Generated Cards State
  const [cards, setCards] = useState<AnyAnkiCard[]>([])
  const [cardFilterType, setCardFilterType] = useState<'all' | 'vocabulary' | 'note'>('all')

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
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

  const selectedNotes = useMemo(
    () => allNotes.filter((n) => checkedNotes[n.id] !== false),
    [allNotes, checkedNotes],
  )

  const filteredWords = useMemo(() => {
    if (!wordFilter.trim()) return allWords
    const q = wordFilter.toLowerCase()
    return allWords.filter((w) => w.toLowerCase().includes(q))
  }, [allWords, wordFilter])

  const selectedCards = useMemo(
    () => cards.filter((c) => c.selected),
    [cards],
  )

  const displayedCards = useMemo(() => {
    if (cardFilterType === 'all') return cards
    return cards.filter((c) => c.type === cardFilterType)
  }, [cards, cardFilterType])

  const vocabCardCount = useMemo(
    () => cards.filter((c) => c.type === 'vocabulary').length,
    [cards],
  )

  const noteCardCount = useMemo(
    () => cards.filter((c) => c.type === 'note').length,
    [cards],
  )

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

      setAllNotes(result.notes)
      setCheckedNotes(Object.fromEntries(result.notes.map((n) => [n.id, true])))

      const bookPrefix = result.bookTitle || 'English Vocabulary in Use'
      const cleanUnitTitle =
        result.title.replace(/^English Vocabulary in Use\s*[:-]?\s*/i, '').trim() ||
        result.title
      setDeckName(`${bookPrefix}::${cleanUnitTitle}`)
      setStatus(
        `Đã tìm thấy ${result.words.length} từ vựng và ${result.notes.length} phần ghi chú bài học.`,
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
    setLesson(null)
    setAllWords(parsed)
    setCheckedWords(Object.fromEntries(parsed.map((w) => [w, true])))
    setAllNotes([])
    setCheckedNotes({})
    setStatus(`Đã ghi nhận ${parsed.length} từ vựng từ danh sách.`)
    setStep(2)
  }

  async function onGenerateCards() {
    if (!selectedWords.length && !selectedNotes.length) {
      setError('Vui lòng chọn ít nhất 1 từ vựng hoặc 1 mục ghi chú.')
      return
    }
    setError('')
    setStatus(
      `Đang dùng TanStack AI tạo thẻ cho ${selectedWords.length} từ vựng và ${selectedNotes.length} ghi chú…`,
    )
    setIsGenerating(true)

    try {
      const token = getStoredToken()

      const promises: [Promise<any>, Promise<any>] = [
        selectedWords.length > 0
          ? generateVocabulary({ data: { words: selectedWords, token } })
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

      const vocabCards: VocabularyCard[] = generatedVocab.map(
        (item: any, index: number): VocabularyCard => ({
          type: 'vocabulary',
          id: `vocab-${Date.now()}-${index}`,
          selected: true,
          unitNumber: lesson?.unitNumber,
          ...item,
          imageUrl: getBingImageUrl(item.imageQuery),
          wordAudioUrl: getYoudaoDictVoiceUrl(item.word, 1),
          exampleAudioUrl: getYoudaoDictVoiceUrl(item.example, 1),
          sourceUrl: lesson?.sourceUrl ?? 'custom-input',
        }),
      )

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
          exampleAudioUrl: getYoudaoDictVoiceUrl(item.example, 1),
          sourceUrl: lesson?.sourceUrl ?? 'custom-input',
        }),
      )

      const nextCards: AnyAnkiCard[] = [...vocabCards, ...noteCards]
      setCards(nextCards)
      setStatus(
        `Đã tạo thành công ${nextCards.length} thẻ (${vocabCards.length} từ vựng, ${noteCards.length} ghi chú).`,
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
          if (vPatch.imageQuery !== undefined) {
            next.imageUrl = getBingImageUrl(vPatch.imageQuery)
          }
          if (vPatch.word !== undefined) {
            next.wordAudioUrl = getYoudaoDictVoiceUrl(vPatch.word, 1)
          }
          if (vPatch.example !== undefined) {
            next.exampleAudioUrl = getYoudaoDictVoiceUrl(vPatch.example, 1)
          }
        } else if (next.type === 'note') {
          const nPatch = patch as Partial<NoteCard>
          if (nPatch.example !== undefined) {
            next.exampleAudioUrl = getYoudaoDictVoiceUrl(nPatch.example, 1)
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
            onClick={() => (allWords.length > 0 || allNotes.length > 0) && setStep(2)}
            disabled={allWords.length === 0 && allNotes.length === 0}
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

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">
                    {selectedWords.length} / {allWords.length} từ vựng
                  </Badge>
                  {allNotes.length > 0 && (
                    <Badge variant="secondary" className="text-xs font-mono">
                      {selectedNotes.length} / {allNotes.length} ghi chú
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Section 1: Vocabulary List */}
          <Card className="border-border/80 bg-card/80 backdrop-blur-md">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <BookmarkIcon className="size-4 text-primary" aria-hidden="true" />
                  <CardTitle className="text-base font-bold">
                    1. Danh sách từ vựng (Vocabulary List)
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
                      setCheckedWords(Object.fromEntries(allWords.map((w) => [w, true])))
                    }
                  >
                    Chọn tất cả ({allWords.length})
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() =>
                      setCheckedWords(Object.fromEntries(allWords.map((w) => [w, false])))
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
                  placeholder="Tìm nhanh từ vựng trong bài..."
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
                          setCheckedWords((old) => ({ ...old, [word]: Boolean(c) }))
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

          {/* Section 2: Language Notes / Important Phrases */}
          {allNotes.length > 0 && (
            <Card className="border-border/80 bg-card/80 backdrop-blur-md">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <SparklesIcon className="size-4 text-amber-500" aria-hidden="true" />
                    <CardTitle className="text-base font-bold">
                      2. Ghi chú quan trọng & Cụm từ (Language Notes)
                    </CardTitle>
                    <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-500">
                      {selectedNotes.length} đã chọn
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() =>
                        setCheckedNotes(Object.fromEntries(allNotes.map((n) => [n.id, true])))
                      }
                    >
                      Chọn tất cả ({allNotes.length})
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        setCheckedNotes(Object.fromEntries(allNotes.map((n) => [n.id, false])))
                      }
                    >
                      Bỏ chọn
                    </Button>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  Mỗi ghi chú sẽ được AI chuyển thành 1 Note Card trong Anki (tóm tắt cụm từ, giải thích tiếng Việt và câu ví dụ).
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
                              setCheckedNotes((old) => ({ ...old, [note.id]: Boolean(c) }))
                            }
                          />
                          <span className="font-bold text-sm text-foreground">
                            {note.title}
                          </span>
                        </label>
                        {note.sectionLetter && (
                          <Badge variant="secondary" className="font-mono text-xs font-bold">
                            Mục {note.sectionLetter}
                          </Badge>
                        )}
                      </div>

                      {/* Content phrases snippet */}
                      <div className="pl-6 flex flex-wrap gap-1.5 pt-1">
                        {note.content.map((phrase, pIdx) => (
                          <span
                            key={pIdx}
                            className="inline-block rounded-md bg-muted/60 px-2 py-0.5 text-xs text-foreground/85 border border-border/40"
                          >
                            {phrase}
                          </span>
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
              disabled={selectedWords.length === 0 && selectedNotes.length === 0}
              className="gap-2 font-semibold shadow-md"
            >
              <SparklesIcon className="size-4" aria-hidden="true" />
              Tạo Anki Deck ({selectedWords.length} từ vựng
              {selectedNotes.length > 0 ? `, ${selectedNotes.length} ghi chú` : ''})
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
                      flashcard ({vocabCardCount} từ vựng, {noteCardCount} ghi chú). Bạn có thể chỉnh sửa trước khi xuất file.
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

              {/* Card Type Filter Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs font-semibold text-muted-foreground">Lọc hiển thị:</span>
                <Button
                  variant={cardFilterType === 'all' ? 'default' : 'outline'}
                  size="xs"
                  onClick={() => setCardFilterType('all')}
                >
                  Tất cả ({cards.length})
                </Button>
                <Button
                  variant={cardFilterType === 'vocabulary' ? 'default' : 'outline'}
                  size="xs"
                  onClick={() => setCardFilterType('vocabulary')}
                >
                  Từ vựng ({vocabCardCount})
                </Button>
                {noteCardCount > 0 && (
                  <Button
                    variant={cardFilterType === 'note' ? 'default' : 'outline'}
                    size="xs"
                    onClick={() => setCardFilterType('note')}
                  >
                    Ghi chú ({noteCardCount})
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
                            Nghe câu ví dụ ghi chú
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
                      <Badge variant="outline" className="text-primary font-bold text-xs">
                        VOCABULARY
                      </Badge>
                      <CardFrameTitle className="text-base font-bold text-foreground">
                        {card.word}
                      </CardFrameTitle>
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
                    <div className="flex flex-col gap-3">
                      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border/60 bg-muted/40 shadow-xs group">
                        <img
                          src={card.imageUrl}
                          alt={card.word}
                          className="size-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
                          Bing Image Query
                        </label>
                        <div className="flex gap-1.5">
                          <Input
                            size="sm"
                            value={card.imageQuery}
                            onChange={(e) =>
                              patchCard(realIndex, { imageQuery: e.target.value })
                            }
                            aria-label="Từ khóa tìm ảnh Bing"
                            className="font-mono text-xs"
                          />
                          <Button
                            size="icon-sm"
                            variant="outline"
                            title="Tải lại hình ảnh theo query mới"
                            onClick={() =>
                              patchCard(realIndex, { imageQuery: card.imageQuery.trim() })
                            }
                          >
                            <RefreshCwIcon className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </div>

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
                          Nghe phát âm từ
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => playAudio(card.exampleAudioUrl)}
                          className="gap-1.5 text-xs"
                        >
                          <Volume2Icon className="size-3.5 text-primary" aria-hidden="true" />
                          Nghe câu ví dụ
                        </Button>
                      </div>

                      {/* Word & IPA row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                          <label className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
                            Phiên âm (IPA)
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
