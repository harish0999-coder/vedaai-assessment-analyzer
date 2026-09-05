'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import UploadPanel from '@/components/UploadPanel';
import LoadingState from '@/components/LoadingState';
import QuestionList from '@/components/QuestionList';
import AnswerSheetViewer from '@/components/AnswerSheetViewer';
import GradingSummary from '@/components/GradingSummary';

export default function Home() {
  const [stage, setStage] = useState('upload'); // 'upload' | 'processing' | 'results'
  const [assessment, setAssessment] = useState(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [mobileTab, setMobileTab] = useState('questions'); // 'questions' | 'answers' — mobile only
  const [error, setError] = useState('');

  async function handleProcess({ questionPaperImages, answerSheetImages }) {
    setStage('processing');
    setError('');
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionPaperImages, answerSheetImages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Processing failed.');
      // The server intentionally omits images from its response (we already
      // have them right here) — attach them back onto the assessment object.
      setAssessment({ ...data, questionPaperImages, answerSheetImages });
      setSelectedQuestionId(data.questions[0]?.id ?? null);
      setStage('results');
    } catch (err) {
      setError(err.message);
      setStage('upload');
    }
  }

  function reset() {
    setAssessment(null);
    setSelectedQuestionId(null);
    setStage('upload');
  }

  if (stage === 'upload' || stage === 'processing') {
    return (
      <AppShell>
        {stage === 'processing' ? (
          <LoadingState />
        ) : (
          <>
            <UploadPanel onProcess={handleProcess} busy={false} />
            {error && <p className="mx-auto -mt-4 max-w-lg text-center text-sm text-incorrect">{error}</p>}
          </>
        )}
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex h-full flex-col overflow-hidden px-4 py-4 md:px-6">
        <GradingSummary summary={assessment.summary} onReset={reset} />

        <div className="mb-3 flex gap-1 rounded-full bg-ink-100 p-1 md:hidden">
          <button
            onClick={() => setMobileTab('questions')}
            className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${
              mobileTab === 'questions' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'
            }`}
          >
            Questions
          </button>
          <button
            onClick={() => setMobileTab('answers')}
            className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${
              mobileTab === 'answers' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'
            }`}
          >
            Answer Sheet
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[minmax(0,380px)_1fr]">
          <section className={`min-h-0 ${mobileTab === 'answers' ? 'hidden md:block' : ''}`}>
            <h2 className="mb-3 hidden font-display text-lg font-semibold text-ink-900 md:block">Questions</h2>
            <QuestionList
              questions={assessment.questions}
              unansweredQuestionIds={assessment.unansweredQuestionIds}
              gradingByQuestionId={assessment.gradingByQuestionId}
              selectedId={selectedQuestionId}
              onSelect={(id) => {
                setSelectedQuestionId(id);
                setMobileTab('answers');
              }}
            />
          </section>
          <section className={`min-h-0 ${mobileTab === 'questions' ? 'hidden md:block' : ''}`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="hidden font-display text-lg font-semibold text-ink-900 md:block">Answer sheet</h2>
              {assessment.strayAnswerIds.length > 0 && (
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-stray">
                  <span className="inline-block h-2 w-2 rounded-sm border border-dashed border-stray" />
                  {assessment.strayAnswerIds.length} unmatched answer{assessment.strayAnswerIds.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <AnswerSheetViewer
              answerSheetImages={assessment.answerSheetImages}
              answers={assessment.answers}
              mappings={assessment.mappings}
              strayAnswerIds={assessment.strayAnswerIds}
              questions={assessment.questions}
              gradingByQuestionId={assessment.gradingByQuestionId}
              selectedQuestionId={selectedQuestionId}
            />
          </section>
        </div>
      </div>
    </AppShell>
  );
}
