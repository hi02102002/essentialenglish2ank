# Anki AI — TanStack Start

A TanStack Start MVP that turns Essential English Vocabulary in Use lessons into Anki `.apkg` decks.

## What it does

1. Paste an Essential English lesson URL, for example Unit 9.
2. The server derives the book's `apps-data/.../data/data.json` URL.
3. It reads the exact `flashcard[].wordlist` for that unit — no HTML/menu/exercise scraping.
4. Select vocabulary items.
5. OpenAI creates IPA, Vietnamese meaning, English definition, example, and an image query.
6. Bing thumbnail URLs provide card images.
7. Youdao provides word + example audio.
8. Review/edit cards and export an offline `.apkg`.

## Setup

Requires Node.js 22.12+.

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Set your OpenAI key in `.env`:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.6-luna
```

## Vocabulary source

For this book the app reads:

```text
https://www.essentialenglish.review/apps-data/english-vocabulary-in-use-pre-intermediate-and-intermediate/data/data.json
```

A lesson URL such as:

```text
https://www.essentialenglish.review/apps/english-vocabulary-in-use-pre-intermediate-and-intermediate/unit-9-the-body-and-movement
```

is mapped to that dataset, then `Unit 9` is selected from `flashcard[]` and only its `wordlist[]` is returned.
