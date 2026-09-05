'use client';

import { useCallback, useState } from 'react';
import { Upload, X, FileText, ArrowRight } from 'lucide-react';
import { fileToPageImages } from '@/lib/pdfToImages';

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function UploadCard({ label, labelAccent, file, pageCount, onFile, onClear, busy }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) onFile(f);
    },
    [onFile]
  );

  if (file) {
    return (
      <div className="flex-1 rounded-sheet border border-ink-100 bg-white p-5">
        <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-paper-dim p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-incorrect text-[10px] font-bold text-white">
            PDF
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900">{file.name}</p>
            <p className="text-xs text-ink-500">
              {formatSize(file.size)} {pageCount ? `• ${pageCount} Page${pageCount > 1 ? 's' : ''}` : ''}
            </p>
          </div>
          {!busy && (
            <button
              onClick={onClear}
              aria-label="Remove file"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-900 text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex-1 cursor-pointer rounded-sheet border-2 border-dashed p-8 text-center transition-colors
        ${dragOver ? 'border-amber bg-amber-soft' : 'border-ink-100 bg-white hover:border-ink-300'}`}
    >
      <input
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-ink-50">
        <Upload className="h-4.5 w-4.5 text-ink-700" />
      </div>
      <p className="text-sm font-medium text-ink-900">
        Upload <span className="text-amber">{labelAccent}</span>
      </p>
      <p className="mt-1 text-xs text-ink-500">Max 10MB</p>
    </label>
  );
}

function Mascot() {
  return (
    <div className="relative mx-auto mb-6 h-16 w-16">
      <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber/50" />
      <div className="absolute inset-2 flex items-center justify-center rounded-full bg-amber-soft">
        <FileText className="h-6 w-6 text-amber" />
      </div>
      <span className="absolute -right-0.5 top-1 h-2 w-2 rounded-full bg-amber" />
      <span className="absolute -left-1 bottom-2 h-1.5 w-1.5 rounded-full bg-amber/70" />
      <span className="absolute bottom-0 right-3 h-1.5 w-1.5 rounded-full bg-amber/70" />
    </div>
  );
}

export default function UploadPanel({ onProcess, busy }) {
  const [qFile, setQFile] = useState(null);
  const [aFile, setAFile] = useState(null);
  const [qPages, setQPages] = useState(null);
  const [aPages, setAPages] = useState(null);
  const [qPageCount, setQPageCount] = useState(0);
  const [aPageCount, setAPageCount] = useState(0);
  const [renderingWhich, setRenderingWhich] = useState(null); // 'question' | 'answer' | null
  const [error, setError] = useState('');

  async function handleQuestionFile(file) {
    setError('');
    setQFile(file);
    setQPages(null);
    setRenderingWhich('question');
    try {
      const pages = await fileToPageImages(file);
      setQPages(pages);
      setQPageCount(pages.length);
    } catch (err) {
      setError(err.message);
      setQFile(null);
    } finally {
      setRenderingWhich(null);
    }
  }

  async function handleAnswerFile(file) {
    setError('');
    setAFile(file);
    setAPages(null);
    setRenderingWhich('answer');
    try {
      const pages = await fileToPageImages(file);
      setAPages(pages);
      setAPageCount(pages.length);
    } catch (err) {
      setError(err.message);
      setAFile(null);
    } finally {
      setRenderingWhich(null);
    }
  }

  function clearQuestion() {
    setQFile(null);
    setQPages(null);
    setQPageCount(0);
  }

  function clearAnswer() {
    setAFile(null);
    setAPages(null);
    setAPageCount(0);
  }

  const canProcess = qPages?.length && aPages?.length && !busy;

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-bold text-ink-900">
            Upload <span className="text-amber">Question Paper &amp; Answer Sheets</span>
          </h1>
          <p className="mt-2 text-sm text-ink-500">Upload both files to get started</p>
        </div>

        <Mascot />

        <div className="flex flex-col gap-4 sm:flex-row">
          <UploadCard
            label="question"
            labelAccent="Question Paper"
            file={qFile}
            pageCount={qPageCount}
            onFile={handleQuestionFile}
            onClear={clearQuestion}
            busy={busy || renderingWhich === 'question'}
          />
          <UploadCard
            label="answer"
            labelAccent="Answer Sheet"
            file={aFile}
            pageCount={aPageCount}
            onFile={handleAnswerFile}
            onClear={clearAnswer}
            busy={busy || renderingWhich === 'answer'}
          />
        </div>

        {renderingWhich && (
          <p className="mt-4 text-center text-xs text-ink-500">Reading {renderingWhich === 'question' ? 'question paper' : 'answer sheet'}…</p>
        )}
        {error && <p className="mt-4 text-center text-sm text-incorrect">{error}</p>}

        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            disabled={!canProcess}
            onClick={() => onProcess({ questionPaperImages: qPages, answerSheetImages: aPages })}
            className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors
              ${canProcess ? 'bg-ink-900 text-white hover:opacity-90' : 'cursor-not-allowed bg-ink-100 text-ink-300'}`}
          >
            Start Mapping
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="text-xs text-ink-500">Once both files are uploaded, you&apos;ll be able to map answers with questions</p>
        </div>
      </div>
    </div>
  );
}
