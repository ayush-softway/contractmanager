'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = 'choose' | 'upload' | 'analyzing' | 'error';

export default function ClientDocUploadModal({ open, onClose }: Props) {
  const router = useRouter();
  const [journey, setJourney] = useState<'j3a' | 'j3b' | null>(null);
  const [step, setStep] = useState<Step>('choose');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  function handleClose() {
    setJourney(null);
    setStep('choose');
    setError('');
    onClose();
  }

  function selectJourney(j: 'j3a' | 'j3b') {
    setJourney(j);
    setStep('upload');
  }

  async function handleFile(file: File) {
    if (!journey) return;
    setStep('analyzing');
    setError('');

    try {
      let text: string;
      const lower = file.name.toLowerCase();

      if (file.type === 'text/html' || lower.endsWith('.html') || lower.endsWith('.htm')) {
        text = await file.text();
      } else {
        const extracted = await api.extractText(file);
        text = extracted.text;
      }

      const analysis = await api.analyzeUpload({ text, journey });
      sessionStorage.setItem('uploadAnalysis', JSON.stringify(analysis));
      handleClose();
      router.push(`/upload/${analysis.journey}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed. Please try again.';
      setError(msg);
      setStep('error');
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [journey],
  );

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [journey],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Upload Client Document</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step 1 — Choose document type */}
        {step === 'choose' && (
          <div className="p-6">
            <p className="text-sm text-slate-500 mb-5">What kind of document are you uploading?</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => selectJourney('j3a')}
                className="text-left p-5 border-2 border-slate-200 rounded-xl hover:border-teal-500 hover:bg-teal-50 transition-all"
              >
                <div className="text-3xl mb-3">📝</div>
                <p className="font-semibold text-slate-900 text-sm mb-1.5">Client Redlines</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  We sent our MSA. Client returned it with tracked changes and proposed edits.
                </p>
              </button>
              <button
                onClick={() => selectJourney('j3b')}
                className="text-left p-5 border-2 border-slate-200 rounded-xl hover:border-teal-500 hover:bg-teal-50 transition-all"
              >
                <div className="text-3xl mb-3">📄</div>
                <p className="font-semibold text-slate-900 text-sm mb-1.5">Client's Own MSA</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Client sent us their own Master Services Agreement for us to work within.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Upload file */}
        {step === 'upload' && journey && (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <button
                onClick={() => setStep('choose')}
                className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <span className="text-sm text-slate-400">
                {journey === 'j3a' ? '📝 Client Redlines' : "📄 Client's Own MSA"}
              </span>
            </div>

            <label
              htmlFor="doc-upload-input"
              className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                dragging
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <svg
                className="w-10 h-10 text-slate-300 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-sm font-medium text-slate-600">Drop your document here</p>
              <p className="text-xs text-slate-400 mt-1">or click to browse — PDF, DOCX, HTML accepted</p>
              <input
                id="doc-upload-input"
                type="file"
                accept=".pdf,.docx,.doc,.html,.htm"
                className="hidden"
                onChange={onFileInput}
              />
            </label>
          </div>
        )}

        {/* Analyzing state */}
        {step === 'analyzing' && (
          <div className="p-10 flex flex-col items-center text-center">
            <div className="w-12 h-12 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-5" />
            <p className="font-semibold text-slate-800 mb-1.5">Analyzing your document...</p>
            <p className="text-sm text-slate-400">AI is reviewing the clauses. This may take a moment.</p>
          </div>
        )}

        {/* Error state */}
        {step === 'error' && (
          <div className="p-8 flex flex-col items-center text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="font-semibold text-slate-800 mb-2">Analysis failed</p>
            <p className="text-sm text-red-500 mb-5 max-w-xs">{error}</p>
            <button
              onClick={() => setStep('upload')}
              className="text-sm bg-teal-600 text-white px-5 py-2.5 rounded-lg hover:bg-teal-700 transition-colors font-medium"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
