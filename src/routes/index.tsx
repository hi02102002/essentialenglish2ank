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
} from 'lucide-react'
import {
  analyzeLesson,
  generateVocabulary,
  checkAuthRequirement,
  verifyPassword,
  verifySessionToken,
} from '@/server/functions'
import { getBingImageUrl } from '@/lib/bing-image'
import { getYoudaoDictVoiceUrl } from '@/lib/youdao'
import type { LessonAnalysis, VocabularyCard } from '@/lib/types'
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
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url')
  const [url, setUrl] = useState(DEFAULT_URL)
  const [rawText, setRawText] = useState('')
  const [deckName, setDeckName] = useState(
    'English Vocabulary in Use::Unit 9: The body and movement',
  )

  const [lesson, setLesson] = useState<LessonAnalysis | null>(null)
  const [allWords, setAllWords] = useState<string[]>([])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [wordFilter, setWordFilter] = useState('')

  const [cards, setCards] = useState<VocabularyCard[]>([])
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
    () => allWords.filter((w) => checked[w] !== false),
    [allWords, checked],
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

  async function onAnalyzeUrl() {
    setError('')
    setStatus('Đang phân tích bài học từ URL…')
    setIsAnalyzing(true)
    try {
      const result = await analyzeLesson({ data: { url } })
      setLesson(result)
      setAllWords(result.words)
      setChecked(Object.fromEntries(result.words.map((w) => [w, true])))
      const unitTitle =
        result.title.replace(/^English Vocabulary in Use\s*[:-]?\s*/i, '').trim() ||
        result.title
      setDeckName(`English Vocabulary in Use::${unitTitle}`)
      setStatus(`Đã tìm thấy ${result.words.length} từ vựng trong bài học.`)
      setStep(2)
    } catch (err) {
      setStatus('')
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
    setChecked(Object.fromEntries(parsed.map((w) => [w, true])))
    setStatus(`Đã ghi nhận ${parsed.length} từ vựng từ danh sách.`)
    setStep(2)
  }

  async function onGenerateCards() {
    if (!selectedWords.length) return
    setError('')
    setStatus(`Đang dùng TanStack AI tạo ${selectedWords.length} thẻ flashcard…`)
    setIsGenerating(true)
    try {
      const generated = await generateVocabulary({
        data: { words: selectedWords },
      })
      const nextCards = generated.map(
        (item, index): VocabularyCard => ({
          id: `${Date.now()}-${index}`,
          selected: true,
          ...item,
          imageUrl: getBingImageUrl(item.imageQuery),
          wordAudioUrl: getYoudaoDictVoiceUrl(item.word, 1),
          exampleAudioUrl: getYoudaoDictVoiceUrl(item.example, 1),
          sourceUrl: lesson?.sourceUrl ?? 'custom-input',
        }),
      )
      setCards(nextCards)
      setStatus(`Đã tạo thành công ${nextCards.length} thẻ flashcard.`)
      setStep(3)
    } catch (err) {
      setStatus('')
      setError(err instanceof Error ? err.message : 'Không thể tạo thẻ từ vựng')
    } finally {
      setIsGenerating(false)
    }
  }

  function patchCard(index: number, patch: Partial<VocabularyCard>) {
    setCards((current) =>
      current.map((card, i) => {
        if (i !== index) return card
        const next = { ...card, ...patch }
        if (patch.imageQuery !== undefined) {
          next.imageUrl = getBingImageUrl(patch.imageQuery)
        }
        if (patch.word !== undefined) {
          next.wordAudioUrl = getYoudaoDictVoiceUrl(patch.word, 1)
        }
        if (patch.example !== undefined) {
          next.exampleAudioUrl = getYoudaoDictVoiceUrl(patch.example, 1)
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
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deckName, cards: selectedCards }),
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Xuất thẻ thất bại (${response.status})`)
      }
      const blob = await response.blob()
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = `${deckName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') ||
        'anki-deck'
        }.apkg`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(href)
      setStatus('Xuất file Anki (.apkg) thành công!')
    } catch (err) {
      setStatus('')
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
            <span>Anki .apkg Generator</span>
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
          Trích xuất từ vựng từ bài học trực tuyến hoặc danh sách tùy ý, tự động làm phong phú định nghĩa bằng AI, kèm hình ảnh minh họa Bing và phát âm chuẩn Youdao.
        </p>
      </header>

      {/* Stepper Navigation */}
      <nav aria-label="Tiến trình các bước" className="mb-8">
        <div className="grid grid-cols-3 gap-2 sm:gap-4 rounded-xl border border-border/80 bg-card/40 p-1.5 sm:p-2 shadow-xs backdrop-blur-xs">
          {/* Step 1 Tab */}
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium transition-all ${step === 1
                ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                : step > 1
                  ? 'bg-primary/10 text-primary hover:bg-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold border border-current">
              {step > 1 ? <CheckIcon className="size-3" aria-hidden="true" /> : '1'}
            </span>
            <span className="hidden sm:inline">1. Nhập từ vựng</span>
            <span className="sm:hidden">Nhập từ</span>
          </button>

          {/* Step 2 Tab */}
          <button
            type="button"
            onClick={() => allWords.length > 0 && setStep(2)}
            disabled={allWords.length === 0}
            className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${step === 2
                ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                : step > 2
                  ? 'bg-primary/10 text-primary hover:bg-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold border border-current">
              {step > 2 ? <CheckIcon className="size-3" aria-hidden="true" /> : '2'}
            </span>
            <span className="hidden sm:inline">2. Chọn từ vựng</span>
            <span className="sm:hidden">Chọn từ</span>
          </button>

          {/* Step 3 Tab */}
          <button
            type="button"
            onClick={() => cards.length > 0 && setStep(3)}
            disabled={cards.length === 0}
            className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${step === 3
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
          className={`mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm transition-all ${error
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
                <CardTitle>Bước 1: Nguồn dữ liệu từ vựng</CardTitle>
                <CardDescription>
                  Chọn nhập bài học từ đường dẫn URL hoặc dán danh sách từ vựng tiếng Anh trực tiếp.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardPanel className="flex flex-col gap-6">
            {/* Input Mode Selector */}
            <div className="flex gap-2 border-b border-border/60 pb-4">
              <Button
                variant={inputMode === 'url' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setInputMode('url')}
                className="gap-2"
              >
                <LinkIcon className="size-4" aria-hidden="true" />
                Trích xuất từ URL bài học
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

            {/* Mode A: URL input */}
            {inputMode === 'url' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="lesson-url" className="text-sm font-semibold text-foreground">
                    URL bài học Essential English
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <Input
                      id="lesson-url"
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://www.essentialenglish.review/..."
                      className="flex-1"
                    />
                    <Button
                      onClick={onAnalyzeUrl}
                      loading={isAnalyzing}
                      className="shrink-0 gap-2 font-semibold"
                    >
                      <SparklesIcon className="size-4" aria-hidden="true" />
                      Phân tích bài học
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Hỗ trợ các bài học tại Essential English Review (sách English Vocabulary in Use).
                  </p>
                </div>
              </div>
            )}

            {/* Mode B: Text input */}
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
                Mẹo Anki: Dùng ký tự <code className="rounded bg-muted px-1.5 py-0.5 text-primary font-mono text-[0.8rem]">::</code> để tạo cấu trúc thư mục con (ví dụ: <code className="text-muted-foreground font-mono">Tiếng Anh::Giao tiếp::Bài 1</code>).
              </p>
            </div>
          </CardPanel>
        </Card>
      )}

      {/* STEP 2: WORD SELECTION */}
      {step === 2 && (
        <Card className="border-border/80 bg-card/80 backdrop-blur-md">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <CheckSquareIcon className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <CardTitle>Bước 2: Chọn từ vựng cần tạo thẻ</CardTitle>
                  <CardDescription>
                    Đã chọn <span className="font-semibold text-foreground">{selectedWords.length}</span> / {allWords.length} từ vựng.
                  </CardDescription>
                </div>
              </div>

              {/* Selection Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setChecked(Object.fromEntries(allWords.map((w) => [w, true])))
                  }
                >
                  Chọn tất cả ({allWords.length})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setChecked(Object.fromEntries(allWords.map((w) => [w, false])))
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
                placeholder="Tìm nhanh từ vựng trong danh sách..."
                className="pl-9"
              />
              <SearchIcon
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>

            {/* Word Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[460px] overflow-y-auto p-1 pr-2 rounded-xl border border-border/40 bg-muted/20">
              {filteredWords.map((word) => {
                const isChecked = checked[word] !== false
                return (
                  <label
                    key={word}
                    className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-sm font-medium cursor-pointer transition-all select-none ${isChecked
                        ? 'border-primary/50 bg-primary/10 text-foreground shadow-xs'
                        : 'border-border/40 bg-card/40 text-muted-foreground hover:border-border hover:bg-card/70'
                      }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(c) =>
                        setChecked((old) => ({ ...old, [word]: Boolean(c) }))
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

          <CardFooter className="flex flex-col-reverse sm:flex-row justify-between gap-3 border-t border-border/60 pt-4">
            <Button
              variant="ghost"
              onClick={() => setStep(1)}
              className="gap-2"
            >
              <ArrowLeftIcon className="size-4" aria-hidden="true" />
              Quay lại Bước 1
            </Button>

            <Button
              onClick={onGenerateCards}
              loading={isGenerating}
              disabled={selectedWords.length === 0}
              className="gap-2 font-semibold"
            >
              <SparklesIcon className="size-4" aria-hidden="true" />
              Tạo Flashcard AI ({selectedWords.length} từ)
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Button>
          </CardFooter>
        </Card>
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
                    <CardTitle>Bước 3: Xem & Tinh chỉnh thẻ Anki</CardTitle>
                    <CardDescription>
                      Đã tạo <span className="font-semibold text-foreground">{cards.length}</span> thẻ flashcard. Bạn có thể chỉnh sửa nội dung hoặc query hình ảnh trước khi xuất file.
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
                  Chọn lại từ vựng
                </Button>
              </div>
            </CardHeader>

            <CardPanel>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/20">
                <label
                  htmlFor="review-deck-name"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                >
                  Tên Deck:
                </label>
                <Input
                  id="review-deck-name"
                  type="text"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  className="flex-1 font-medium text-sm"
                />
              </div>
            </CardPanel>
          </Card>

          {/* Card Frame List */}
          <div className="flex flex-col gap-5">
            {cards.map((card, index) => (
              <CardFrame
                key={card.id}
                className={`transition-all ${card.selected
                    ? 'border-border/80 shadow-xs'
                    : 'opacity-60 border-dashed border-border/40'
                  }`}
              >
                {/* Header of each Card Frame */}
                <CardFrameHeader>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-mono font-bold text-muted-foreground">
                      #{index + 1}
                    </span>
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
                          patchCard(index, { selected: Boolean(c) })
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
                            patchCard(index, { imageQuery: e.target.value })
                          }
                          aria-label="Từ khóa tìm ảnh Bing"
                          className="font-mono text-xs"
                        />
                        <Button
                          size="icon-sm"
                          variant="outline"
                          title="Tải lại hình ảnh theo query mới"
                          onClick={() =>
                            patchCard(index, { imageQuery: card.imageQuery.trim() })
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
                          onChange={(e) =>
                            patchCard(index, { word: e.target.value })
                          }
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
                          onChange={(e) =>
                            patchCard(index, { ipa: e.target.value })
                          }
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
                          patchCard(index, { vietnamese: e.target.value })
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
                          patchCard(index, {
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
                          patchCard(index, { example: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </CardFrame>
            ))}
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
                  Tự động tải media hình ảnh Bing và 2 file phát âm Youdao vào file .apkg offline.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="flex-1 sm:flex-none"
              >
                Chọn lại từ
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
