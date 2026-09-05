'use client';

function Stat({ label, value, tone }) {
  const toneClass = {
    ink: 'text-ink-900',
    correct: 'text-correct',
    incorrect: 'text-incorrect',
    stray: 'text-stray',
  }[tone || 'ink'];
  return (
    <div className="text-center">
      <p className={`font-display text-2xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-500">{label}</p>
    </div>
  );
}

export default function GradingSummary({ summary, onReset }) {
  const hasScore = summary.totalMax > 0;
  return (
    <div className="paper-sheet mb-6 flex flex-wrap items-center justify-between gap-4 rounded-sheet px-6 py-4">
      <div>
        <p className="font-display text-lg font-semibold text-ink-900">Assessment summary</p>
        <p className="text-xs text-ink-500">{summary.totalQuestions} questions extracted</p>
      </div>
      <div className="flex flex-wrap gap-6">
        {hasScore && <Stat label="Score" value={`${summary.totalScore}/${summary.totalMax}`} tone="ink" />}
        <Stat label="Answered" value={summary.answeredCount} tone="correct" />
        <Stat label="Unanswered" value={summary.unansweredCount} tone="incorrect" />
        <Stat label="Unmatched" value={summary.strayAnswerCount} tone="stray" />
      </div>
      <button onClick={onReset} className="rounded-sheet border border-ink-100 px-4 py-2 text-sm text-ink-700 hover:border-ink-300">
        New assessment
      </button>
    </div>
  );
}
