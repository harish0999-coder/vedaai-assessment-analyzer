'use client';

import { Sparkles } from 'lucide-react';

export default function LoadingState({ label = 'Extracting…', hint = 'This may take a while' }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="paper-sheet flex h-full w-full flex-col items-center justify-center rounded-sheet">
        <Sparkles className="sparkle-loading h-10 w-10 text-amber" strokeWidth={1.75} />
        <p className="mt-4 font-display text-lg font-semibold text-ink-900">{label}</p>
        <p className="mt-1 text-sm text-ink-500">{hint}</p>
      </div>
    </div>
  );
}
