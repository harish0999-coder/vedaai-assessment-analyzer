// Single source of truth for how a grade maps to a verdict + color, used by
// both the question list and the answer sheet highlight so they never
// disagree with each other (or with the model's own possibly-inconsistent
// "verdict" string).
export function verdictFromGrade(grade) {
  if (!grade || grade.score == null || !grade.maxScore) return 'ungraded';
  const ratio = grade.score / grade.maxScore;
  if (ratio >= 0.999) return 'correct';
  if (ratio <= 0.001) return 'incorrect';
  return 'partially_correct';
}

export const VERDICT_COLORS = {
  correct: { border: 'border-correct', bg: 'bg-correct/10', text: 'text-correct', solid: 'bg-correct' },
  partially_correct: { border: 'border-amber', bg: 'bg-amber/10', text: 'text-amber', solid: 'bg-amber' },
  incorrect: { border: 'border-incorrect', bg: 'bg-incorrect/10', text: 'text-incorrect', solid: 'bg-incorrect' },
  ungraded: { border: 'border-ink-300', bg: 'bg-ink-100', text: 'text-ink-500', solid: 'bg-ink-500' },
};

export const VERDICT_LABELS = {
  correct: 'Correct',
  partially_correct: 'Partial',
  incorrect: 'Incorrect',
  ungraded: 'Answered',
};
