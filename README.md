# VedaAI — AI Assessment Extraction & Answer Mapping

A teacher uploads a question paper and a student's handwritten answer sheet.
The app extracts every question, transcribes and locates every handwritten
answer, maps answers to questions, highlights the exact answer region on the
sheet when a question is clicked, and grades each answer with AI feedback.

## Approach

**Core flow:** Question Extraction → Answer Extraction → Answer Mapping → Grading/Feedback

1. **Client-side rasterization.** Uploaded PDFs are rendered to PNG images
   page-by-page in the browser with `pdfjs-dist` (images are passed through
   as-is). This avoids needing a native PDF/canvas toolchain on the server,
   which is fragile on serverless hosts like Vercel.
2. **Question extraction** (`lib/gemini.js :: extractQuestions`) sends the
   question paper page images to Gemini with instructions to return every
   question in printed order, splitting labelled sub-parts (e.g. `11(a)`,
   `11(b)`) into separate entries and preserving original numbering.
3. **Answer extraction** (`extractAnswers`) sends the answer sheet images to
   Gemini and asks for every distinct handwritten block: its transcribed
   text, the question label the student wrote (if any), which page it's on,
   a normalized bounding box (`[ymin,xmin,ymax,xmax]` on a 0–1000 scale) for
   highlighting, and whether it's a continuation of an earlier block (for
   answers spanning multiple pages).
4. **Mapping** (`mapAnswersToQuestions`) is two-pass:
   - Pass 1: normalize and match declared labels against question numbers
     (handles correctly-labelled answers, including ones written out of
     order, and stitches continuation blocks onto the right question).
   - Pass 2: for answers with no usable label, ask Gemini to match remaining
     answers to remaining questions purely on content, only accepting
     confident matches.
   - Whatever's left over becomes either an **unanswered question** or a
     **stray/unmatched answer** — both are surfaced explicitly in the UI
     rather than silently dropped.
5. **Grading** (`gradeAnswer`) runs once per mapped question, returning a
   score, a verdict (correct / partially correct / incorrect), and one or
   two sentences of feedback.
6. **Persistence.** Each processed assessment (source images, extracted
   questions/answers, mappings, grading) is written to MongoDB as a single
   document, keyed by a generated id, via `GET /api/assessment/[id]`. The
   assignment doesn't require a database or auth, but the document shape
   keeps this response reproducible/shareable if the teacher reloads.

## UI

The layout follows the provided Figma reference: a left sidebar (branding,
"AI Teacher's Toolkit", nav), a top bar, an upload screen with two file
cards, and a centered "Extracting…" loading state.

- Upload screen: two upload cards (question paper, answer sheet), each
  showing the file name, size, and page count once selected; "Start
  Mapping" activates once both are uploaded.
- Loading screen: a centered card with a spinner and status text while
  extraction/mapping/grading run.
- Results screen: left pane is the extracted question list, with an
  answered/unanswered/graded badge per question and its grading feedback.
  Right pane is the actual answer sheet page images. Clicking a question
  scrolls to and highlights (pulsing) the exact bounding box of its matched
  answer — across pages if the answer continues onto a later page.
  Unmatched answer blocks always show a dashed outline so a teacher can spot
  handwriting that didn't map to any question. A top summary bar shows total
  score and counts of answered / unanswered / unmatched.

## AI model / API used

**Google Gemini** (`gemini-flash-lite-latest`, free tier) via `@google/generative-ai`,
chosen specifically because Flash-Lite carries a much higher free-tier rate
limit (roughly 15-30 requests/minute, ~1,000-1,500/day) than the newer
preview Flash models, which fits this app's extraction/classification-style
calls better than a tight 5 RPM cap would,
used for vision-based question/answer extraction (including bounding boxes)
and for text-based mapping and grading. `responseMimeType: "application/json"`
is used throughout for structured output.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in GEMINI_API_KEY and MONGODB_URI
npm run dev
```

- **Gemini API key:** https://aistudio.google.com/app/apikey (free tier)
- **MongoDB:** a free MongoDB Atlas cluster works — use its connection string
  as `MONGODB_URI`. Local `mongod` also works for development.

## Deploying

The app is a standard Next.js app, so any Next.js-friendly host works:

1. Push this repo to GitHub.
2. Import it into [Vercel](https://vercel.com/new) (or Netlify, Render, etc.).
3. Add the `GEMINI_API_KEY` and `MONGODB_URI` environment variables in the
   host's project settings (same values as `.env.local`).
4. Deploy. No build configuration is needed beyond the defaults.

## Assumptions & limitations

- Handwriting transcription quality depends entirely on Gemini's OCR of the
  photo/scan — very messy handwriting or low-resolution photos will reduce
  extraction and mapping accuracy.
- Bounding boxes are Gemini's own visual grounding output; they're generally
  tight around the handwritten block but not pixel-perfect.
- Content-based mapping (Pass 2) is a best-effort fallback for answers with
  no legible question label — it only accepts matches Gemini reports as
  confident, so ambiguous handwriting-only answers may end up unmatched
  rather than guessed incorrectly.
- Grading is AI-generated and meant as a first-pass aid for the teacher, not
  a final/authoritative score.
- No authentication, per the assignment scope — anyone with the URL can
  upload and process a paper.
