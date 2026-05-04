'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import type { UploadAnalysis } from '@cg/shared';

export default function UploadPage() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [journey, setJourney] = useState<'j3a' | 'j3b' | 'auto'>('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAnalyze() {
    const content = text.trim() || driveUrl.trim();
    if (!content) {
      setError('Paste document text or a Google Drive URL to continue.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const payload: { text: string; driveFileId?: string; journey?: 'j3a' | 'j3b' } = {
        text: content,
        journey: journey === 'auto' ? undefined : journey,
      };

      // Extract Drive file ID if a URL was pasted
      const driveMatch = content.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (driveMatch) {
        payload.driveFileId = driveMatch[1];
      }

      const analysis: UploadAnalysis = await api.analyzeUpload(payload);

      // Pass analysis to the appropriate review page via sessionStorage (avoids URL encoding large blobs)
      sessionStorage.setItem('uploadAnalysis', JSON.stringify(analysis));
      router.push(`/upload/${analysis.journey}`);
    } catch (err: any) {
      setError(err.message ?? 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="px-8 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-slate-900">Upload Client Document</h1>
          <p className="text-sm text-slate-500 mt-1">
            Upload a client's redlined version of your contract or their own MSA.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          {/* Journey selector */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Document type</p>
            <div className="flex gap-3">
              {[
                { value: 'auto', label: 'Auto-detect', desc: 'Let AI decide' },
                { value: 'j3a', label: 'Client Redlines', desc: "Client returned our contract with changes" },
                { value: 'j3b', label: "Client's MSA", desc: 'Client sent their own master agreement' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setJourney(opt.value as typeof journey)}
                  className={`flex-1 text-left px-3 py-2.5 rounded-lg border text-xs transition-colors ${
                    journey === opt.value
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="font-semibold block">{opt.label}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Drive URL input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Google Drive URL
            </label>
            <input
              type="text"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="flex-1 h-px bg-slate-200" />
            <span>or paste document text</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Text paste area */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Document text
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the full document text here..."
              rows={8}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none font-mono"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            onClick={handleAnalyze}
            disabled={loading || (!text.trim() && !driveUrl.trim())}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-3 rounded-xl font-bold text-sm transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analysing with Claude...
              </span>
            ) : (
              'Analyse Document →'
            )}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
