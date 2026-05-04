'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import type { RedlineAnalysis, RedlineClause, ClauseVerdict, ChatMessage } from '@cg/shared';

const verdictConfig: Record<ClauseVerdict, { label: string; color: string; dot: string }> = {
  safe: { label: 'Safe to Accept', color: 'text-emerald-700', dot: '🟢' },
  review: { label: 'Needs Review', color: 'text-amber-700', dot: '🟡' },
  conflict: { label: 'Conflicts with Softway Standard', color: 'text-red-700', dot: '🔴' },
};

export default function J3AReviewPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<RedlineAnalysis | null>(null);
  const [clauses, setClauses] = useState<(RedlineClause & { expanded?: boolean })[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Ask me about any flagged clause — e.g. "Why is Clause 2 flagged red?"' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('uploadAnalysis');
    if (!raw) { router.push('/upload'); return; }
    const data = JSON.parse(raw) as RedlineAnalysis;
    if (data.journey !== 'j3a') { router.push('/upload/j3b'); return; }
    setAnalysis(data);
    setClauses(data.clauses.map((c) => ({ ...c, expanded: true })));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  function resolve(id: string, action: 'accepted' | 'rejected' | 'countered') {
    setClauses((prev) => prev.map((c) => (c.id === id ? { ...c, resolution: action } : c)));
    api.resolveClause({ clauseId: id, action }).catch(() => {});
  }

  async function sendChat() {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);
    try {
      const context = (analysis?.clauses ?? []).map((c) => `${c.name}: ${c.explanation}`).join('\n');
      const result = await api.reviewChat('redline-context', `Context:\n${context}\n\nQuestion: ${msg}`);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I ran into an error.' }]);
    } finally {
      setChatLoading(false);
    }
  }

  const resolved = clauses.filter((c) => c.resolution).length;
  const total = clauses.length;
  const allResolved = total > 0 && resolved === total;

  const grouped = (['conflict', 'review', 'safe'] as ClauseVerdict[]).map((v) => ({
    verdict: v,
    config: verdictConfig[v],
    clauses: clauses.filter((c) => c.verdict === v),
  })).filter((g) => g.clauses.length > 0);

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
        <div className="flex flex-1 min-h-0">
          {/* Left panel — Redline Analysis */}
          <div className="w-80 shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-sm font-semibold text-slate-900">Redline Analysis</h2>
                <span className="text-slate-400 text-xs" title="AI analysis of client's proposed changes">ℹ️</span>
              </div>
              <p className="text-xs text-slate-500">{resolved} of {total} clauses resolved</p>
              <div className="w-full bg-slate-100 rounded-full h-1 mt-2">
                <div
                  className="bg-teal-500 h-1 rounded-full transition-all"
                  style={{ width: total > 0 ? `${(resolved / total) * 100}%` : '0%' }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {grouped.map(({ verdict, config, clauses: grpClauses }) => (
                <div key={verdict}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span>{config.dot}</span>
                    <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
                    <span className="text-xs text-slate-400 ml-auto bg-slate-100 px-1.5 py-0.5 rounded-full font-medium">
                      {grpClauses.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {grpClauses.map((clause) => (
                      <div key={clause.id} className="border border-slate-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setClauses((prev) => prev.map((c) => c.id === clause.id ? { ...c, expanded: !c.expanded } : c))}
                          className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors"
                        >
                          <span className="text-xs font-medium text-slate-800">{clause.name}</span>
                          {clause.resolution ? (
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              clause.resolution === 'accepted' ? 'bg-emerald-100 text-emerald-700'
                              : clause.resolution === 'rejected' ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                            }`}>
                              {clause.resolution}
                            </span>
                          ) : (
                            <svg className={`w-3 h-3 text-slate-400 transition-transform ${clause.expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </button>
                        {clause.expanded && (
                          <div className="px-3 pb-3 border-t border-slate-100 bg-slate-50">
                            <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">{clause.explanation}</p>
                            {!clause.resolution && (
                              <div className="flex gap-1.5 mt-2">
                                <button onClick={() => resolve(clause.id, 'accepted')} className="flex-1 text-[10px] font-semibold py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors">Accept</button>
                                <button onClick={() => resolve(clause.id, 'rejected')} className="flex-1 text-[10px] font-semibold py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors">Reject</button>
                                <button onClick={() => resolve(clause.id, 'countered')} className="flex-1 text-[10px] font-semibold py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">Counter</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100">
              <button
                disabled={!allResolved}
                className="w-full bg-teal-600 disabled:bg-slate-200 disabled:text-slate-400 hover:bg-teal-700 text-white py-2.5 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
                title={!allResolved ? 'Resolve all flagged items to enable' : ''}
              >
                {!allResolved && <span className="text-slate-400">🔒</span>}
                Finalize Document
              </button>
              {!allResolved && (
                <p className="text-[10px] text-slate-400 text-center mt-1.5">Resolve all flagged items to enable</p>
              )}
            </div>
          </div>

          {/* Right panel — Document iframe placeholder */}
          <div className="flex-1 flex flex-col bg-slate-100">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8 bg-white border border-slate-200 rounded-xl shadow-sm max-w-sm">
                <span className="text-4xl block mb-4">📝</span>
                <h3 className="font-bold text-slate-900 mb-2">Client Document</h3>
                <p className="text-sm text-slate-500">
                  {analysis.driveFileId
                    ? 'Connect a Google Drive document to see tracked changes here.'
                    : 'In production, the client\'s redlined Google Doc with tracked changes appears here.'}
                </p>
                {analysis.driveFileId && (
                  <a
                    href={`https://docs.google.com/document/d/${analysis.driveFileId}/preview`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    Open in Google Docs ↗
                  </a>
                )}
              </div>
            </div>

            {/* Chat bar */}
            <div className="border-t border-slate-200 bg-white">
              <div className="max-h-36 overflow-y-auto px-4 pt-3 space-y-2">
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
                  placeholder="Ask about any flagged clause..."
                  className="flex-1 text-sm bg-transparent focus:outline-none text-slate-700 placeholder-slate-400"
                />
                <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading} className="text-teal-600 hover:text-teal-700 disabled:text-slate-300 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
