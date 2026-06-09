'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import type { ClientMSAAnalysis, ChatMessage } from '@cg/shared';

export default function J3BReviewPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<ClientMSAAnalysis | null>(null);
  const [confirmedRisks, setConfirmedRisks] = useState<Set<number>>(new Set());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "I've read the client's MSA and built Softway's SOW around it. Confirm my extractions below, or ask about any risk flag." },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [sessionExpired, setSessionExpired] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('uploadAnalysis');
    if (!raw) { setSessionExpired(true); return; }
    const data = JSON.parse(raw) as ClientMSAAnalysis;
    if (data.journey !== 'j3b') { router.push('/upload/j3a'); return; }
    setAnalysis(data);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  async function sendChat() {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);
    try {
      const context = analysis?.risks ?? [];
      const result = await api.uploadChat('j3b', context, msg);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I ran into an error.' }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleFinalize() {
    if (!allConfirmed || finalizing || !analysis) return;
    setFinalizing(true);
    try {
      const { contractId } = await api.finalizeJ3B({
        sowDraft: analysis.sowDraft,
        risks: analysis.risks,
      });
      sessionStorage.removeItem('uploadAnalysis');
      router.push(`/contracts/${contractId}/review`);
    } catch {
      setFinalizing(false);
    }
  }

  const allConfirmed = analysis ? confirmedRisks.size >= analysis.risks.length : false;

  if (sessionExpired) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <div className="text-4xl mb-4">⏱️</div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Session expired</h2>
          <p className="text-sm text-slate-500 mb-6 max-w-xs">
            The document analysis session is no longer available. Please upload your document again.
          </p>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-teal-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to homepage
          </button>
        </div>
      </AppShell>
    );
  }

  if (!analysis) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        {/* Risk flags banner */}
        {analysis.risks.length > 0 && (
          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2 shrink-0">
            <span className="text-amber-500">⚠️</span>
            <span className="text-sm font-medium text-amber-800">
              {analysis.risks.length} risk flag{analysis.risks.length !== 1 ? 's' : ''} identified in client MSA — review before finalizing
            </span>
          </div>
        )}

        {/* Split diff view */}
        <div className="flex flex-1 min-h-0">
          {/* Left panel — Client MSA */}
          <div className="flex-1 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-semibold text-slate-900">Client MSA</h2>
              <span className="text-xs text-slate-400">View: All</span>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {analysis.risks.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No risk flags identified.</p>
              ) : (
                analysis.risks.map((risk, i) => (
                  <div
                    key={i}
                    className="border border-amber-200 rounded-lg bg-amber-50 p-4"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-amber-500 text-sm shrink-0">🟡</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{risk.clauseName}</p>
                        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">{risk.risk}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {/* Placeholder for full MSA text */}
              <div className="border border-dashed border-slate-200 rounded-lg p-4 text-center">
                <p className="text-xs text-slate-400">Full client MSA text rendered here in production (Google Docs iframe)</p>
              </div>
            </div>
          </div>

          {/* Drag divider */}
          <div className="w-1 bg-slate-200 flex items-center justify-center cursor-col-resize hover:bg-teal-400 transition-colors shrink-0">
            <div className="w-3 h-6 flex flex-col gap-0.5 items-center justify-center">
              <div className="w-0.5 h-3 bg-slate-400 rounded-full" />
              <div className="w-0.5 h-3 bg-slate-400 rounded-full" />
            </div>
          </div>

          {/* Right panel — Softway SOW */}
          <div className="flex-1 bg-white flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-semibold text-slate-900">Softway SOW — Generated</h2>
              <span className="text-xs text-slate-400">View: All</span>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {analysis.risks.map((risk, i) => (
                <div key={i} className="border border-emerald-200 rounded-lg bg-emerald-50 p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-emerald-500 text-sm shrink-0">✅</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{risk.clauseName}</p>
                      <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">{risk.softwayVersion}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmedRisks((prev) => { const s = new Set(prev); s.add(i); return s; })}
                    className={`mt-2 text-[10px] font-semibold px-2.5 py-1 rounded transition-colors ${
                      confirmedRisks.has(i)
                        ? 'bg-emerald-200 text-emerald-800'
                        : 'bg-white border border-emerald-300 text-emerald-600 hover:bg-emerald-100'
                    }`}
                  >
                    {confirmedRisks.has(i) ? '✓ Confirmed' : 'Confirm this version'}
                  </button>
                </div>
              ))}
              {analysis.sowDraft && (
                <div className="border border-slate-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Generated SOW Draft</p>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-mono">
                    {analysis.sowDraft.slice(0, 1500)}{analysis.sowDraft.length > 1500 ? '\n...' : ''}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom — Finalize + chat */}
        <div className="border-t border-slate-200 bg-white">
          {allConfirmed && (
            <div className="px-4 pt-3">
              <button
                onClick={handleFinalize}
                disabled={finalizing}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {finalizing ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Finalizing...</>
                ) : (
                  'Finalize → Send to DocuSign'
                )}
              </button>
            </div>
          )}
          <div className="max-h-32 overflow-y-auto px-4 pt-3 space-y-2">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                    <span className="text-[10px]">✨</span>
                  </div>
                )}
                <div className={`max-w-[75%] px-3 py-1.5 rounded-xl text-xs leading-relaxed ${msg.role === 'user' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-2"><div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center shrink-0"><span className="text-[10px]">✨</span></div><div className="px-3 py-1.5 rounded-xl text-xs bg-slate-100 text-slate-400">Thinking...</div></div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="flex items-center gap-2 p-3 border-t border-slate-100">
            <span className="text-teal-500 text-sm">✨</span>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              placeholder="Ask about any risk flag or confirm extracted values..."
              className="flex-1 text-sm bg-transparent focus:outline-none text-slate-700 placeholder-slate-400"
            />
            <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading} className="text-teal-600 hover:text-teal-700 disabled:text-slate-300 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
