import { GoogleGenerativeAI } from '@google/generative-ai';

function getModel(responseSchema) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured. Add it to your .env.local file.');
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: 'gemini-flash-lite-latest',
    generationConfig: {
      responseMimeType: 'application/json',
      ...(responseSchema ? { responseSchema } : {}),
      temperature: 0.1,
    },
  });
}

// Strip stray markdown fences just in case the model ignores the JSON mime type.
function safeParseJson(text) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const match = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Model did not return valid JSON: ' + err.message);
  }
}

// Retries a Gemini call on 429 rate-limit errors and 503 "overloaded"
// errors — both transient and worth waiting out — honoring the server's
// suggested retryDelay when present, with exponential backoff as a
// fallback. The free tier allows only a handful of requests per minute per
// model, and this app can easily fire more than that across extraction +
// grading calls; separately, Google's servers occasionally return 503s
// under high demand regardless of your own usage.
async function withRetry(fn, { retries = 3 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const message = err?.message || '';
      const status = err?.status;
      const isRetryable =
        status === 429 ||
        status === 503 ||
        /429|quota|rate limit|503|service unavailable|overloaded|high demand/i.test(message);
      if (!isRetryable || attempt === retries) throw err;
      const suggested = message.match(/retryDelay":"(\d+(?:\.\d+)?)s"/) || message.match(/retry in ([\d.]+)s/i);
      const rawDelay = suggested
        ? Math.ceil(parseFloat(suggested[1]) * 1000) + 500
        : 1000 * Math.pow(2, attempt) + Math.random() * 500;
      const delayMs = Math.min(rawDelay, 8000); // never wait more than 8s per attempt
      console.warn(`[gemini] ${status || 'error'} — retrying in ${Math.round(delayMs)}ms (attempt ${attempt + 1}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

// Safety net for the "skip instructional stems" prompt rule above — catches
// entries like "4. Answer the following:" that have no marks of their own
// and are immediately followed by lettered sub-parts sharing the same base
// number, in case the model includes them despite being told not to.
function isLikelyInstructionalStem(q, index, all) {
  if (q.maxMarks) return false;
  const base = String(q.number ?? '').match(/^(\d+)/)?.[1];
  if (!base) return false;
  const hasSiblingSubpart = all.some((other, i) => {
    if (i === index) return false;
    const otherBase = String(other.number ?? '').match(/^(\d+)\s*\(/);
    return otherBase && otherBase[1] === base;
  });
  const wordCount = String(q.text ?? '').trim().split(/\s+/).filter(Boolean).length;
  return hasSiblingSubpart && wordCount <= 8;
}

function imagePart(base64Image) {
  // base64Image is a data URL like "data:image/jpeg;base64,..." (or png/etc.)
  if (base64Image.startsWith('data:')) {
    const [header, data] = base64Image.split(',');
    const mimeType = header.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
    return { inlineData: { data, mimeType } };
  }
  // Raw base64 with no data URL prefix — assume JPEG (our client always sends one).
  return { inlineData: { data: base64Image, mimeType: 'image/jpeg' } };
}

/**
 * Extract every question from the question paper page images, in printed order.
 * Labelled sub-parts (11a, 11b) are returned as separate entries.
 */
export async function extractQuestions(pageImages) {
  const model = getModel();
  const parts = pageImages.map((img, i) => imagePart(img, i));
  const prompt = `You are reading a scanned/typed question paper made of ${pageImages.length} page image(s), in order (page 1 first).

Extract EVERY question in the exact order they are printed. Rules:
- If a question has labelled sub-parts (e.g. "11 (a)", "11 (b)", or "2.1", "2.2"), output each sub-part as its OWN separate entry. Do not merge sub-parts into one entry.
- Do NOT create a separate entry for a bare instructional stem that only introduces its own sub-parts and carries no marks of its own — e.g. a line reading just "Answer the following:" right before 4(a) and 4(b). That stem is not something a student answers on its own; skip it and extract only its lettered sub-parts.
- Preserve the original printed numbering exactly as written (e.g. "11(a)", "Q5", "3").
- Include the full question text (instructions, marks in brackets if shown, and any sub-context needed to understand the question).
- Note the page number (1-indexed) the question appears on.
- If a question spans multiple pages, use the page where it starts.
- Return questions in printed order, not sorted numerically.

Return ONLY a JSON array, no prose, with this exact shape:
[
  {
    "number": "11(a)",
    "text": "full question text here",
    "page": 1,
    "maxMarks": 5
  }
]
If marks are not shown, omit "maxMarks" or set it to null.`;

  const result = await withRetry(() => model.generateContent([prompt, ...parts]));
  const data = safeParseJson(result.response.text());
  const arr = Array.isArray(data) ? data : data.questions || [];
  const filtered = arr.filter((q, i) => !isLikelyInstructionalStem(q, i, arr));
  return filtered.map((q, i) => ({
    id: `q_${i + 1}`,
    number: String(q.number ?? i + 1),
    text: q.text ?? '',
    page: Number(q.page) || 1,
    maxMarks: q.maxMarks ?? null,
  }));
}

/**
 * Extract every distinct handwritten answer block from the answer sheet page
 * images, with a normalized bounding box (0-1000 scale, [ymin,xmin,ymax,xmax])
 * for highlighting, and the question label the student wrote next to it (if any).
 */
export async function extractAnswers(pageImages) {
  const model = getModel();
  const parts = pageImages.map((img, i) => imagePart(img, i));
  const prompt = `You are reading a student's handwritten answer sheet made of ${pageImages.length} page image(s), in order (page 1 first).

Find every distinct answer block a student has written. Rules:
- A student may write the question number/label next to their answer (e.g. "Q3", "11(a)", "2."). Capture that label exactly as written if present, otherwise set "declaredLabel" to null.
- Transcribe the handwritten text as best you can into "text".
- If an answer clearly continues onto a later page (no new question label appears, ruled-off continuation, "contd." notes, etc.), still report it as a separate block for that page, but set "continuesFrom" to the 1-indexed order position of the block it continues (order position = index+1 within this returned array, use -1 if this is not a continuation).
- Give a bounding box in "box" as [ymin, xmin, ymax, xmax], integers normalized to a 0-1000 scale relative to the page image, tightly cropping the handwritten answer region (not the whole page).
- Include the 1-indexed "page" number the block is on.
- If handwriting is illegible in places transcribe what you can and note "[illegible]" inline.

Return ONLY a JSON array, no prose, with this exact shape:
[
  {
    "declaredLabel": "11(a)",
    "text": "transcribed handwritten answer",
    "page": 2,
    "box": [120, 80, 340, 900],
    "continuesFrom": -1
  }
]`;

  const result = await withRetry(() => model.generateContent([prompt, ...parts]));
  const data = safeParseJson(result.response.text());
  const arr = Array.isArray(data) ? data : data.answers || [];
  return arr.map((a, i) => ({
    id: `a_${i + 1}`,
    declaredLabel: a.declaredLabel ? String(a.declaredLabel) : null,
    text: a.text ?? '',
    page: Number(a.page) || 1,
    box: Array.isArray(a.box) && a.box.length === 4 ? a.box.map(Number) : null,
    continuesFrom: typeof a.continuesFrom === 'number' ? a.continuesFrom : -1,
  }));
}

// Normalize a question/answer label for loose matching: "11 (a)" -> "11a", "Q3" -> "3"
function normalizeLabel(label) {
  if (!label) return '';
  return String(label)
    .toLowerCase()
    .replace(/^q(uestion)?\.?\s*/i, '')
    .replace(/[().\s]/g, '');
}

/**
 * Map answers to questions. First pass: exact/normalized label match.
 * Second pass: ask Gemini to resolve any answers without a clean label match
 * (handles out-of-order answers and answers with no declared label) by
 * comparing question text against transcribed answer text.
 * Returns { mappings, unansweredQuestionIds, strayAnswerIds }
 */
export async function mapAnswersToQuestions(questions, answers) {
  const mappings = []; // { questionId, answerIds: [...] }
  const usedAnswerIds = new Set();
  const qByNorm = new Map(questions.map((q) => [normalizeLabel(q.number), q]));

  // Pass 1: direct label matches (handles correctly labelled + out-of-order answers)
  for (const a of answers) {
    if (!a.declaredLabel) continue;
    const norm = normalizeLabel(a.declaredLabel);
    const q = qByNorm.get(norm);
    if (q) {
      let entry = mappings.find((m) => m.questionId === q.id);
      if (!entry) {
        entry = { questionId: q.id, answerIds: [] };
        mappings.push(entry);
      }
      entry.answerIds.push(a.id);
      usedAnswerIds.add(a.id);
    }
  }

  // Attach continuation blocks (blocks marked continuesFrom another block) to
  // whichever question their source block was mapped to.
  const answerById = new Map(answers.map((a) => [a.id, a]));
  for (const a of answers) {
    if (a.continuesFrom && a.continuesFrom > 0 && !usedAnswerIds.has(a.id)) {
      const sourceIndex = a.continuesFrom - 1;
      const source = answers[sourceIndex];
      if (source && usedAnswerIds.has(source.id)) {
        const entry = mappings.find((m) => m.answerIds.includes(source.id));
        if (entry) {
          entry.answerIds.push(a.id);
          usedAnswerIds.add(a.id);
        }
      }
    }
  }

  const unmatchedAnswers = answers.filter((a) => !usedAnswerIds.has(a.id));
  const unmatchedQuestions = questions.filter((q) => !mappings.some((m) => m.questionId === q.id));

  // Pass 2: for remaining unlabeled/unmatched answers, use content similarity via Gemini
  if (unmatchedAnswers.length && unmatchedQuestions.length) {
    const model = getModel();
    const prompt = `Match each ANSWER to the QUESTION it most likely responds to, based on content. Only propose a match if you are reasonably confident; otherwise mark it unmatched.

QUESTIONS:
${unmatchedQuestions.map((q) => `[${q.id}] (${q.number}) ${q.text}`).join('\n')}

ANSWERS:
${unmatchedAnswers.map((a) => `[${a.id}] ${a.text}`).join('\n')}

Return ONLY a JSON array with this shape:
[{ "answerId": "a_3", "questionId": "q_5", "confident": true }]
Omit any answer you cannot confidently match.`;

    try {
      const result = await withRetry(() => model.generateContent(prompt));
      const data = safeParseJson(result.response.text());
      const arr = Array.isArray(data) ? data : [];
      for (const m of arr) {
        if (!m.confident) continue;
        const q = questions.find((q) => q.id === m.questionId);
        const a = answerById.get(m.answerId);
        if (!q || !a || usedAnswerIds.has(a.id)) continue;
        let entry = mappings.find((e) => e.questionId === q.id);
        if (!entry) {
          entry = { questionId: q.id, answerIds: [] };
          mappings.push(entry);
        }
        entry.answerIds.push(a.id);
        usedAnswerIds.add(a.id);
      }
    } catch (err) {
      console.error('[gemini] content-similarity mapping pass failed, continuing without it:', err.message);
    }
  }

  const unansweredQuestionIds = questions
    .filter((q) => !mappings.some((m) => m.questionId === q.id))
    .map((q) => q.id);
  const strayAnswerIds = answers.filter((a) => !usedAnswerIds.has(a.id)).map((a) => a.id);

  return { mappings, unansweredQuestionIds, strayAnswerIds };
}

/**
 * Grade one question/answer pair.
 */
export async function gradeAnswer(question, answerText) {
  const model = getModel();
  const prompt = `You are grading a student's exam answer.

QUESTION (${question.number}${question.maxMarks ? `, ${question.maxMarks} marks` : ''}): ${question.text}

STUDENT ANSWER: ${answerText}

Grade fairly. Return ONLY JSON with this shape:
{
  "score": 3,
  "maxScore": ${question.maxMarks ?? 5},
  "verdict": "correct" | "partially_correct" | "incorrect",
  "feedback": "one or two sentence, specific, constructive feedback"
}`;

  const result = await withRetry(() => model.generateContent(prompt));
  const data = safeParseJson(result.response.text());
  return {
    score: Number(data.score) || 0,
    maxScore: Number(data.maxScore) || question.maxMarks || 5,
    verdict: data.verdict || 'incorrect',
    feedback: data.feedback || '',
  };
}
