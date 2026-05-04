'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import type { ChatMessage, ContractType } from '@cg/shared';

const REQUIRED_FIELDS = [
  'client_legal_name', 'client_address', 'client_contact_name', 'client_contact_email',
  'softway_rep', 'contract_type', 'project_fee_usd', 'completion_date', 'service_type',
];

const FIELD_LABELS: Record<string, string> = {
  client_legal_name: 'Client Legal Name',
  client_address: 'Client Address',
  client_contact_name: 'Contact Name',
  client_contact_email: 'Contact Email',
  softway_rep: 'Softway Rep',
  contract_type: 'Contract Type',
  project_fee_usd: 'Project Fee',
  completion_date: 'Completion Date',
  service_type: 'Service Type',
  msa_date: 'Prior MSA Date',
  sow_number: 'SOW Number',
  workshop_count: 'Workshop Count',
  duration_hrs: 'Duration (hrs)',
  attendee_count: 'Attendee Count',
  facilitator_count: 'Facilitators',
  location: 'Location',
  travel_required: 'Travel Required',
  travel_cap: 'Travel Cap',
  payment_structure: 'Payment Structure',
};

const ALL_FIELDS = Object.keys(FIELD_LABELS);

function extractChips(reply: string): string[] {
  const match = reply.match(/\[CHIPS:\s*([^\]]+)\]/);
  if (!match || !match[1]) return [];
  return match[1].split('|').map((s) => s.trim()).filter(Boolean);
}

function cleanReply(reply: string): string {
  return reply.replace(/\[CHIPS:[^\]]*\]/g, '').trim();
}

export default function GenerateContractPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateSlug = searchParams.get('template');

  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [displayedMessages, setDisplayedMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: templateSlug
        ? `Using the ${templateSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} template. Let's build your contract. Who's the client?`
        : "Let's build your contract. Who's the client?",
    },
  ]);
  const [capturedFields, setCapturedFields] = useState<Record<string, string>>(
    templateSlug ? { contract_type: templateSlug } : {},
  );
  const [chips, setChips] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [fieldPanelOpen, setFieldPanelOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filledCount = REQUIRED_FIELDS.filter((f) => capturedFields[f]).length;
  const allReady = filledCount >= REQUIRED_FIELDS.length;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedMessages, loading]);

  useEffect(() => {
    // Slide in the checklist panel after first field is captured
    if (Object.keys(capturedFields).length > 0 && !fieldPanelOpen) {
      setFieldPanelOpen(true);
    }
  }, [capturedFields]);

  async function sendMessage(text: string) {
    const userMsg = text.trim();
    if (!userMsg || loading) return;
    setInput('');
    setChips([]);

    const newUserMsg: ChatMessage = { role: 'user', content: userMsg };
    const newHistory = [...history, newUserMsg];
    setHistory(newHistory);
    setDisplayedMessages((prev) => [...prev, newUserMsg]);
    setLoading(true);

    try {
      const result = await api.intakeChat({ history: newHistory, message: userMsg });

      // Merge newly captured fields
      if (Object.keys(result.fields).length > 0) {
        setCapturedFields((prev) => ({ ...prev, ...result.fields }));
      }

      const assistantMsg: ChatMessage = { role: 'assistant', content: result.reply };
      setHistory((prev) => [...prev, assistantMsg]);
      setDisplayedMessages((prev) => [...prev, assistantMsg]);

      const newChips = extractChips(result.reply);
      setChips(newChips);

      if (result.ready) {
        // All fields captured — generate the contract
        await generateContract({ ...capturedFields, ...result.fields });
      }
    } catch {
      setDisplayedMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I ran into an issue. Please try again.' },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
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

  const progressPct = Math.round((filledCount / REQUIRED_FIELDS.length) * 100);

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-3rem)]">
        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Progress bar */}
          <div className="px-6 py-3 border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-600">
                {filledCount} of {REQUIRED_FIELDS.length} fields captured
              </span>
              <button
                onClick={() => setFieldPanelOpen((o) => !o)}
                className="text-xs text-teal-600 hover:text-teal-700 font-medium"
              >
                {fieldPanelOpen ? 'Hide checklist' : 'Show checklist'}
              </button>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div
                className="bg-teal-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {displayedMessages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center shrink-0 mt-1">
                    <span className="text-sm">✨</span>
                  </div>
                )}
                <div
                  className={`max-w-lg px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-teal-600 text-white rounded-br-sm'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? cleanReply(msg.content) : msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                  <span className="text-sm">✨</span>
                </div>
                <div className="px-4 py-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {generating && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                  <span className="text-sm">✨</span>
                </div>
                <div className="px-4 py-3 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 text-sm font-medium shadow-sm">
                  Generating your contract...
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Option chips */}
          {chips.length > 0 && (
            <div className="px-6 py-2 flex flex-wrap gap-2 border-t border-slate-100 bg-white">
              {chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-teal-100 hover:text-teal-700 border border-slate-200 hover:border-teal-300 rounded-full transition-colors disabled:opacity-50"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Generate button when ready */}
          {allReady && !generating && (
            <div className="px-6 py-3 border-t border-slate-100 bg-emerald-50">
              <button
                onClick={handleConfirmGenerate}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold text-sm transition-colors"
              >
                Generate Contract →
              </button>
            </div>
          )}

          {/* Text input */}
          <div className="px-6 py-4 border-t border-slate-200 bg-white">
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100 transition-all">
              <span className="text-teal-500 text-base shrink-0">✨</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
                placeholder="Type or choose an option..."
                disabled={loading || generating}
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none disabled:opacity-50"
              />
              <label className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <input type="file" className="sr-only" />
              </label>
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading || generating}
                className="shrink-0 text-teal-600 hover:text-teal-700 disabled:text-slate-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Right panel — field checklist (slides in after first field) */}
        <div
          className={`border-l border-slate-200 bg-white transition-all duration-300 overflow-hidden shrink-0 ${
            fieldPanelOpen ? 'w-64' : 'w-0'
          }`}
        >
          <div className="w-64 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Field Checklist</h3>
              <button onClick={() => setFieldPanelOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              {ALL_FIELDS.map((field) => {
                const captured = Boolean(capturedFields[field]);
                const required = REQUIRED_FIELDS.includes(field);
                return (
                  <div key={field} className="flex items-start gap-2">
                    <span className={`mt-0.5 text-sm ${captured ? 'text-teal-500' : 'text-slate-300'}`}>
                      {captured ? '✅' : '⬜'}
                    </span>
                    <div>
                      <span className={`text-xs ${captured ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                        {FIELD_LABELS[field]}
                      </span>
                      {required && !captured && (
                        <span className="ml-1 text-[10px] text-slate-300">*</span>
                      )}
                      {captured && capturedFields[field] && (
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[160px]">
                          {capturedFields[field]}
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
    </AppShell>
  );
}
