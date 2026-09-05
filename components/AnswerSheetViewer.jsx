'use client';

import { useEffect, useRef } from 'react';
import { verdictFromGrade, VERDICT_COLORS } from '@/lib/gradeUtils';

// Convert a 0-1000 normalized [ymin,xmin,ymax,xmax] box into a CSS percentage box.
function boxToStyle(box) {
  const [ymin, xmin, ymax, xmax] = box;
  return {
    top: `${ymin / 10}%`,
    left: `${xmin / 10}%`,
    width: `${(xmax - xmin) / 10}%`,
    height: `${(ymax - ymin) / 10}%`,
  };
}

export default function AnswerSheetViewer({
  answerSheetImages,
  answers,
  mappings,
  strayAnswerIds,
  questions,
  gradingByQuestionId,
  selectedQuestionId,
}) {
  const pageRefs = useRef([]);
  const answerById = new Map(answers.map((a) => [a.id, a]));
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const selectedMapping = mappings.find((m) => m.questionId === selectedQuestionId);
  const selectedAnswerIds = new Set(selectedMapping?.answerIds || []);
  const strayIdSet = new Set(strayAnswerIds || []);
  const selectedQuestion = questionById.get(selectedQuestionId);
  const selectedGrade = gradingByQuestionId?.[selectedQuestionId];
  const selectedVerdict = verdictFromGrade(selectedGrade);
  const selectedColors = VERDICT_COLORS[selectedVerdict];

  useEffect(() => {
    if (!selectedMapping) return;
    const firstAnswer = answerById.get(selectedMapping.answerIds[0]);
    if (!firstAnswer) return;
    const el = pageRefs.current[firstAnswer.page - 1];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuestionId]);

  return (
    <div className="scroll-thin h-full space-y-6 overflow-y-auto pr-1">
      {answerSheetImages.map((src, pageIndex) => {
        const pageNum = pageIndex + 1;
        const pageAnswers = answers.filter((a) => a.page === pageNum && a.box);
        return (
          <div
            key={pageNum}
            ref={(el) => (pageRefs.current[pageIndex] = el)}
            className="paper-sheet relative mx-auto max-w-2xl overflow-visible rounded-sheet"
          >
            <div className="overflow-hidden rounded-sheet">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Answer sheet page ${pageNum}`} className="block w-full" />
            </div>
            {pageAnswers.map((a) => {
              const isSelected = selectedAnswerIds.has(a.id);
              const isStray = strayIdSet.has(a.id);
              if (!isSelected && !isStray) return null; // keep unrelated boxes out of the way visually
              const colors = isSelected ? selectedColors : VERDICT_COLORS.ungraded;
              return (
                <div
                  key={a.id}
                  style={boxToStyle(a.box)}
                  className={`absolute rounded-sheet border-2 transition-all
                    ${isSelected ? `z-10 ${colors.border} ${colors.bg} highlight-pulse` : ''}
                    ${!isSelected && isStray ? 'border-dashed border-stray bg-stray/5' : ''}`}
                  title={isStray && !isSelected ? 'Unmatched answer — no question found for this block' : undefined}
                >
                  {isSelected && selectedQuestion && (
                    <span className={`absolute -left-2 -top-3 z-20 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${colors.solid}`}>
                      Q{selectedQuestion.number}
                    </span>
                  )}
                  {!isSelected && isStray && (
                    <span className="absolute -left-2 -top-3 z-20 rounded-full bg-stray px-2 py-0.5 text-[11px] font-semibold text-white">
                      ?
                    </span>
                  )}
                </div>
              );
            })}
            <span className="absolute bottom-2 right-2 rounded bg-ink/70 px-2 py-0.5 font-mono text-[10px] text-white">
              page {pageNum}
            </span>
          </div>
        );
      })}
    </div>
  );
}
