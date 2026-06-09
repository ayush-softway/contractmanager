'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import AddSourceModal from '@/components/AddSourceModal';
import SourceChip from '@/components/SourceChip';
import type { ChatMessage, ContractType, FieldDef } from '@cg/shared';

const SOURCE_LABELS: Record<string, string> = {
  hubspot: 'HubSpot',
  drive: 'Google Drive',
  text: 'Text',
};

function extractChips(reply: string): string[] {
  const match = reply.match(/\[CHIPS:\s*([^\]]+)\]/);
  if (!match || !match[1]) return [];
  return match[1].split('|').map((s) => s.trim()).filter(Boolean);
}

function cleanReply(reply: string): string {
  return reply.replace(/\[CHIPS:[^\]]*\]/g, '').trim();
}

function GenerateContractPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateSlug = searchParams.get('template');

  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [displayedMessages, setDisplayedMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: templateSlug
        ? `Using the ${templateSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} template. Let's build your contract. Who's the client?`
        : "Let's build your contract. What type of contract do you need?",
    },
  ]);
  const [capturedFields, setCapturedFields] = useState<Record<string, string>>(
    templateSlug ? { contract_type: templateSlug } : {},
  );
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [chips, setChips] = useState<string[]>(
    templateSlug ? [] : ['New client — MSA + SOW', 'Repeat client — SOW only', 'MSA only', 'Change Order'],
  );
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [fieldPanelOpen, setFieldPanelOpen] = useState(false);
  const [addSourceOpen, setAddSourceOpen] = useState(false);
  const [sourceChips, setSourceChips] = useState<{ id: string; label: string; type: string }[]>([]);
  const [draftContractId, setDraftContractId] = useState<string | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentContractType = (capturedFields.contract_type ?? templateSlug ?? 'msa-sow') as ContractType;

  useEffect(() => {
    api.listFields(currentContractType)
      .then((r) => setFieldDefs(r.fields))
      .catch(() => {});
  }, [currentContractType]);

  const requiredKeys = fieldDefs.filter((f) => f.required).map((f) => f.key);
  const filledCount = requiredKeys.filter((k) => capturedFields[k]).length;
  const totalRequired = requiredKeys.length;
  const remainingRequired = totalRequired > filledCount ? totalRequired - filledCount : 0;
  const allReady = totalRequired > 0 && filledCount >= totalRequired;
  const progressPct = totalRequired > 0 ? Math.round((filledCount / totalRequired) * 100) : 0;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedMessages, loading]);

  useEffect(() => {
    if (Object.keys(capturedFields).length > 0 && !fieldPanelOpen) {
      setFieldPanelOpen(true);
    }
  }, [capturedFields]);

  // Debounced draft auto-save — fires 2s after fields stop changing
  useEffect(() => {
    const hasFields = Object.keys(capturedFields).filter((k) => k !== 'contract_type').length > 0;
    if (!hasFields) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      api.saveDraft({
        contractType: currentContractType,
        fields: capturedFields,
        draftId: draftContractId ?? undefined,
      }).then(({ contractId }) => setDraftContractId(contractId)).catch(() => {});
    }, 2000);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [capturedFields, currentContractType]);

  async function sendMessage(text: string) {
    const userMsg = text.trim();
    if (!userMsg || loading || streamingContent !== null) return;
    setInput('');
    setChips([]);

    const newUserMsg: ChatMessage = { role: 'user', content: userMsg };
    const newHistory = [...history, newUserMsg];
    setHistory(newHistory);
    setDisplayedMessages((prev) => [...prev, newUserMsg]);
    setLoading(true);

    try {
      const result = await api.intakeChat({ history: newHistory, message: userMsg, capturedFields });

      if (Object.keys(result.fields).length > 0) {
        setCapturedFields((prev) => ({ ...prev, ...result.fields }));
      }

      const assistantMsg: ChatMessage = { role: 'assistant', content: result.reply };
      setHistory((prev) => [...prev, assistantMsg]);
      setLoading(false);

      // Typewriter animation
      const cleanText = cleanReply(result.reply);
      const newChips = extractChips(result.reply);
      let pos = 0;
      setStreamingContent('');
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
      streamTimerRef.current = setInterval(() => {
        pos += 4;
        if (pos >= cleanText.length) {
          clearInterval(streamTimerRef.current!);
          streamTimerRef.current = null;
          setStreamingContent(null);
          setDisplayedMessages((prev) => [...prev, assistantMsg]);
          setChips(newChips);
          if (result.ready) {
            generateContract({ ...capturedFields, ...result.fields });
          }
        } else {
          setStreamingContent(cleanText.slice(0, pos));
        }
      }, 16);
    } catch {
      setLoading(false);
      setDisplayedMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I ran into an issue. Please try again.' },
      ]);
      inputRef.current?.focus();
    }
  }

  function handleImported(result: { fields: Record<string, string>; source: string; label: string }) {
    // Merge fields immediately so checklist updates
    setCapturedFields((prev) => ({ ...prev, ...result.fields }));

    // Add source chip
    const chipId = `${result.source}-${Date.now()}`;
    setSourceChips((prev) => [...prev, { id: chipId, label: result.label, type: result.source }]);

    // Close the add-source panel
    setAddSourceOpen(false);

    // Build a summary for the AI so it can confirm and ask for gaps
    const fieldSummary = Object.entries(result.fields)
      .map(([k, v]) => {
        const def = fieldDefs.find((f) => f.key === k);
        return `${def ? def.label : k}: ${v}`;
      })
      .join(', ');
    const sourceName = SOURCE_LABELS[result.source] ?? result.source;
    sendMessage(`I've imported from ${sourceName} (${result.label}): ${fieldSummary}. Please confirm these and ask for anything still missing.`);
  }

  function handleRemoveChip(id: string) {
    setSourceChips((prev) => prev.filter((c) => c.id !== id));
  }

  async function generateContract(fields: Record<string, string>) {
    setGenerating(true);
    try {
      const contractType = (fields.contract_type ?? 'msa-sow') as ContractType;
      const result = await api.generateContract({ contractType, fields });
      router.push(`/contracts/${result.contractId}/review`);
    } catch (err: any) {
      setDisplayedMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Generation failed: ${err.message ?? 'Unknown error'}. Please check your fields and try again.` },
      ]);
      setGenerating(false);
    }
  }

  async function handleConfirmGenerate() {
    await generateContract(capturedFields);
  }

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-4rem)] bg-[#fcfaf6]">
        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Progress bar */}
          <div className="px-6 py-3 border-b border-[#e5e3db]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {filledCount} of {totalRequired} required fields captured
              </span>
              <button
                onClick={() => setFieldPanelOpen((o) => !o)}
                className="text-xs text-[#d4a08c] hover:opacity-80 font-medium transition-opacity"
              >
                {fieldPanelOpen
                  ? 'Hide checklist'
                  : remainingRequired > 0
                    ? `Show checklist (${remainingRequired} left)`
                    : 'Show checklist'}
              </button>
            </div>
            <div className="w-full bg-[#e5e3db] rounded-full h-1">
              <div
                className="bg-[#d4a08c] h-1 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-8 flex flex-col items-center hide-scrollbar">
            <div className="w-full max-w-3xl space-y-8">
              {displayedMessages.map((msg, i) => (
                <div key={i} className={`flex gap-4 w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded shrink-0 mt-1 flex items-center justify-center">
                      <svg className="w-6 h-6 text-[#d4a08c]" viewBox="0 0 24 24" fill="currentColor">
                         <path d="M12 2l2.4 7.6H22l-6.4 4.8 2.4 7.6-6.4-4.8-6.4 4.8 2.4-7.6L2 9.6h7.6z" />
                      </svg>
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] px-5 py-3.5 text-[15px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#2e2e2e] text-white rounded-3xl rounded-tr-sm shadow-sm'
                        : 'text-slate-800'
                    }`}
                  >
                    {msg.role === 'assistant' ? cleanReply(msg.content) : msg.content}
                  </div>
                </div>
              ))}

              {streamingContent !== null && (
                <div className="flex gap-4 w-full justify-start">
                  <div className="w-8 h-8 rounded shrink-0 mt-1 flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#d4a08c]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l2.4 7.6H22l-6.4 4.8 2.4 7.6-6.4-4.8-6.4 4.8 2.4-7.6L2 9.6h7.6z" />
                    </svg>
                  </div>
                  <div className="max-w-[85%] px-5 py-3.5 text-[15px] leading-relaxed text-slate-800">
                    {streamingContent}<span className="inline-block w-0.5 h-4 bg-slate-400 ml-0.5 animate-pulse align-middle" />
                  </div>
                </div>
              )}

              {loading && (
                <div className="flex gap-4 w-full justify-start">
                  <div className="w-8 h-8 rounded shrink-0 mt-1 flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#d4a08c] animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                       <path d="M12 2l2.4 7.6H22l-6.4 4.8 2.4 7.6-6.4-4.8-6.4 4.8 2.4-7.6L2 9.6h7.6z" />
                    </svg>
                  </div>
                  <div className="px-5 py-3.5 text-[15px] text-slate-500">
                    Thinking...
                  </div>
                </div>
              )}

              {generating && (
                <div className="flex gap-4 w-full justify-start">
                  <div className="w-8 h-8 rounded shrink-0 mt-1 flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#d4a08c] animate-spin" viewBox="0 0 24 24" fill="currentColor">
                       <path d="M12 2l2.4 7.6H22l-6.4 4.8 2.4 7.6-6.4-4.8-6.4 4.8 2.4-7.6L2 9.6h7.6z" />
                    </svg>
                  </div>
                  <div className="px-5 py-3.5 text-[15px] text-[#d4a08c] font-medium">
                    Generating your contract...
                  </div>
                </div>
              )}

              {/* Quick reply cards */}
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-8">
                  {chips.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => sendMessage(chip)}
                      disabled={loading || streamingContent !== null}
                      className="flex-1 min-w-[200px] text-left px-4 py-4 bg-white border border-[#e5e3db] hover:bg-[#f4f2ec] rounded-xl transition-colors disabled:opacity-50 text-[14px] text-slate-700 shadow-sm font-medium"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div ref={chatEndRef} className="h-4" />
          </div>

          {/* Add Source modal */}
          {addSourceOpen && (
            <AddSourceModal
              onImported={handleImported}
              onClose={() => setAddSourceOpen(false)}
              onError={(msg: string) =>
                setDisplayedMessages((prev) => [
                  ...prev,
                  { role: 'assistant', content: msg },
                ])
              }
            />
          )}

          {/* Generate button when ready */}
          {allReady && !generating && (
            <div className="flex justify-center mb-4">
              <button
                onClick={handleConfirmGenerate}
                className="bg-[#2e2e2e] hover:bg-black text-white px-8 py-3 rounded-full font-semibold text-sm transition-colors shadow-md"
              >
                Generate Contract →
              </button>
            </div>
          )}

          {/* Input Area */}
          <div className="px-4 sm:px-10 pb-6 flex justify-center w-full">
            <div className="max-w-3xl w-full">
               {/* Source chips */}
               {sourceChips.length > 0 && (
                 <div className="mb-3 flex flex-wrap gap-2">
                   {sourceChips.map((chip) => (
                     <SourceChip key={chip.id} chip={chip} onRemove={() => handleRemoveChip(chip.id)} />
                   ))}
                 </div>
               )}
               
               <div className="bg-[#f4f2ec] border border-[#e5e3db] rounded-2xl flex flex-col focus-within:ring-2 focus-within:ring-[#e5e3db] focus-within:border-transparent transition-all shadow-sm">
                 <input
                   ref={inputRef}
                   type="text"
                   value={input}
                   onChange={(e) => setInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
                   placeholder="Reply to Claude..."
                   disabled={loading || generating || streamingContent !== null}
                   className="w-full bg-transparent text-[15px] text-slate-800 placeholder-slate-500 focus:outline-none disabled:opacity-50 px-4 pt-4 pb-2"
                 />
                 <div className="flex items-center justify-between px-3 pb-3">
                   {/* Left side attachment icon */}
                   <button
                     onClick={() => setAddSourceOpen((o) => !o)}
                     disabled={loading || generating || streamingContent !== null}
                     title="Add source (HubSpot, Drive, or paste text)"
                     className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                       addSourceOpen ? 'text-[#d4a08c] bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-black/5'
                     }`}
                   >
                     <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                     </svg>
                   </button>
                   
                   {/* Right side send button */}
                   <button
                     onClick={() => sendMessage(input)}
                     disabled={!input.trim() || loading || generating || streamingContent !== null}
                     className={`p-1.5 rounded-full transition-all flex items-center justify-center w-8 h-8 ${
                       input.trim() && !loading && !generating 
                         ? 'bg-[#d4a08c] text-white hover:opacity-90' 
                         : 'bg-black/5 text-black/30'
                     }`}
                   >
                     <svg className="w-4 h-4 ml-[1px] mb-[1px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 10l8-8m0 0l8 8m-8-8v20" />
                     </svg>
                   </button>
                 </div>
               </div>
               {/* Disclaimer text */}
               <div className="text-center mt-3">
                  <span className="text-[11px] text-slate-400">Claude can make mistakes. Please double-check responses.</span>
               </div>
            </div>
          </div>
        </div>

        {/* Right panel — field checklist */}
        <div
          className={`border-l border-slate-200 bg-white transition-all duration-300 overflow-hidden shrink-0 ${
            fieldPanelOpen ? 'w-64' : 'w-0'
          }`}
        >
          <div className="w-64 p-4 overflow-y-auto max-h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Field Checklist</h3>
              <button onClick={() => setFieldPanelOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            {/* Required fields */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Required</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  remainingRequired === 0
                    ? 'bg-teal-100 text-teal-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {filledCount}/{totalRequired}
                </span>
              </div>
              <div className="space-y-2">
                {fieldDefs.filter(f => f.required).map((fieldDef) => {
                  const captured = Boolean(capturedFields[fieldDef.key]);
                  return (
                    <div key={fieldDef.key} className="flex items-start gap-2">
                      <span className={`mt-0.5 text-sm shrink-0 ${captured ? 'text-teal-500' : 'text-amber-400'}`}>
                        {captured ? '✅' : '◉'}
                      </span>
                      <div className="min-w-0">
                        <span className={`text-xs ${captured ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                          {fieldDef.label}
                        </span>
                        {captured && capturedFields[fieldDef.key] && (
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[160px]">
                            {capturedFields[fieldDef.key]}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 my-3" />

            {/* Optional fields */}
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">Optional</span>
              <div className="space-y-2">
                {fieldDefs.filter((f) => !f.required).map((fieldDef) => {
                  const captured = Boolean(capturedFields[fieldDef.key]);
                  return (
                    <div key={fieldDef.key} className="flex items-start gap-2">
                      <span className={`mt-0.5 text-sm shrink-0 ${captured ? 'text-teal-500' : 'text-slate-300'}`}>
                        {captured ? '✅' : '⬜'}
                      </span>
                      <div className="min-w-0">
                        <span className={`text-xs ${captured ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                          {fieldDef.label}
                        </span>
                        {captured && capturedFields[fieldDef.key] && (
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[160px]">
                            {capturedFields[fieldDef.key]}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function GenerateContractPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <GenerateContractPageInner />
    </Suspense>
  );
}
