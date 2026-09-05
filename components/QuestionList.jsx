'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { verdictFromGrade, VERDICT_COLORS } from '@/lib/gradeUtils';

function ScorePill({ status, grade }) {
  if (status === 'unanswered') {
    return <span className="rounded-full bg-incorrect/10 px-2.5 py-0.5 text-xs font-semibold text-incorrect">Unanswered</span>;
  }
  const verdict = verdictFromGrade(grade);
  const colors = VERDICT_COLORS[verdict];
  if (verdict === 'ungraded') {
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors.bg} ${colors.text}`}>Answered</span>;
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors.bg} ${colors.text}`}>
      {grade.score}/{grade.maxScore}
    </span>
  );
}

export default function QuestionList({ questions, unansweredQuestionIds, gradingByQuestionId, selectedId, onSelect }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  function toggleExpanded(id, e) {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto pr-1">
      <ul className="space-y-2">
        {questions.map((q) => {
          const isUnanswered = unansweredQuestionIds.includes(q.id);
          const grade = gradingByQuestionId?.[q.id];
          const isSelected = selectedId === q.id;
          const isExpanded = expandedIds.has(q.id);
          const hasFeedback = !isUnanswered && grade?.feedback;

          return (
            <li key={q.id}>
              <div
                onClick={() => onSelect(q.id)}
                role="button"
                tabIndex={0}
                className={`w-full cursor-pointer rounded-sheet border p-3.5 text-left transition-colors
                  ${isSelected ? 'border-ink bg-ink-50' : 'border-ink-100 bg-white hover:border-ink-300'}`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">
                    {q.number}
                  </span>
                  <div className="flex flex-1 items-start justify-between gap-2 pt-0.5">
                    <p className="line-clamp-2 text-sm text-ink-900">{q.text}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <ScorePill status={isUnanswered ? 'unanswered' : 'answered'} grade={grade} />
                      {hasFeedback && (
                        <button
                          onClick={(e) => toggleExpanded(q.id, e)}
                          aria-label={isExpanded ? 'Hide feedback' : 'Show feedback'}
                          className="rounded-full p-0.5 text-ink-500 hover:bg-ink-100"
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {hasFeedback && isExpanded && (
                  <div className="ml-9 mt-2 rounded-lg bg-paper-dim p-2.5">
                    <p className="text-xs font-semibold text-ink-900">AI Feedback</p>
                    <p className="mt-1 text-xs text-ink-500">{grade.feedback}</p>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
