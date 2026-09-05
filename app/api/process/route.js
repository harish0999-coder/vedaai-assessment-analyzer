import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { extractQuestions, extractAnswers, mapAnswersToQuestions, gradeAnswer } from '@/lib/gemini';
import { getAssessmentsCollection } from '@/lib/mongodb';

export const maxDuration = 60; // allow Gemini calls room to run on serverless

// Vercel forcibly kills the function at maxDuration and returns an
// unreadable plain-text error (not JSON) when that happens. This races the
// real work against an internal deadline set a bit earlier, so on a bad day
// (e.g. Gemini returning repeated 503s) we return a clean, readable JSON
// error ourselves instead of letting the platform do it for us.
const INTERNAL_DEADLINE_MS = 50000;

function withDeadline(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Runs `fn` over `items` with at most `limit` in flight at once — fast, but
// still bounded so we don't burst past the free-tier RPM cap.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function runPipeline({ questionPaperImages, answerSheetImages, includeGrading }) {
  // Step 1 + 2: these two are independent, so run them in parallel —
  // Flash-Lite's free-tier RPM comfortably covers 2 concurrent calls.
  const [questions, answers] = await Promise.all([
    extractQuestions(questionPaperImages),
    extractAnswers(answerSheetImages),
  ]);

  // Step 3: map answers to questions (labels -> content similarity fallback).
  const { mappings, unansweredQuestionIds, strayAnswerIds } = await mapAnswersToQuestions(questions, answers);

  // Step 4: grade mapped questions with a small concurrency cap (fast, but
  // still bounded so a large paper doesn't burst past the RPM limit).
  let gradingByQuestionId = {};
  if (includeGrading) {
    const answerById = new Map(answers.map((a) => [a.id, a]));
    const graded = await mapWithConcurrency(mappings, 3, async (m) => {
      const question = questions.find((q) => q.id === m.questionId);
      const combinedText = m.answerIds.map((id) => answerById.get(id)?.text || '').join('\n');
      try {
        return [m.questionId, await gradeAnswer(question, combinedText)];
      } catch (err) {
        console.error('[grade] failed for', m.questionId, err.message);
        return [m.questionId, { score: null, maxScore: question.maxMarks ?? null, verdict: 'ungraded', feedback: 'Grading failed for this answer.' }];
      }
    });
    gradingByQuestionId = Object.fromEntries(graded);
  }

  const totalScore = Object.values(gradingByQuestionId).reduce((sum, g) => sum + (g.score || 0), 0);
  const totalMax = Object.values(gradingByQuestionId).reduce((sum, g) => sum + (g.maxScore || 0), 0);

  return {
    _id: uuidv4(),
    createdAt: new Date().toISOString(),
    questionPaperImages,
    answerSheetImages,
    questions,
    answers,
    mappings,
    unansweredQuestionIds,
    strayAnswerIds,
    gradingByQuestionId,
    summary: {
      totalQuestions: questions.length,
      answeredCount: mappings.length,
      unansweredCount: unansweredQuestionIds.length,
      strayAnswerCount: strayAnswerIds.length,
      totalScore,
      totalMax,
    },
  };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { questionPaperImages, answerSheetImages, includeGrading = true } = body;

    if (!Array.isArray(questionPaperImages) || questionPaperImages.length === 0) {
      return NextResponse.json({ error: 'questionPaperImages is required (at least one page image).' }, { status: 400 });
    }
    if (!Array.isArray(answerSheetImages) || answerSheetImages.length === 0) {
      return NextResponse.json({ error: 'answerSheetImages is required (at least one page image).' }, { status: 400 });
    }

    const assessment = await withDeadline(
      runPipeline({ questionPaperImages, answerSheetImages, includeGrading }),
      INTERNAL_DEADLINE_MS,
      'Processing is taking longer than expected (the AI service may be under heavy load right now). Please try again in a minute.'
    );

    try {
      const col = await getAssessmentsCollection();
      await col.insertOne(assessment);
    } catch (dbErr) {
      // Don't fail the whole request just because persistence failed — the
      // teacher still gets their results this session; log for diagnosis.
      console.error('[mongodb] failed to persist assessment:', dbErr.message);
    }

    // The browser already has questionPaperImages/answerSheetImages (it just
    // rendered them client-side to send here) — omit them from the response
    // so we're not echoing several MB of base64 back for no reason.
    const { questionPaperImages: _qp, answerSheetImages: _as, ...responseBody } = assessment;
    return NextResponse.json(responseBody);
  } catch (err) {
    console.error('[api/process] error:', err);
    return NextResponse.json({ error: err.message || 'Processing failed.' }, { status: 504 });
  }
}
