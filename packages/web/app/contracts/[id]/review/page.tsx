'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import LegalLockBadge from '@/components/LegalLockBadge';
import ClauseCoverage from '@/components/ClauseCoverage';
import AppShell from '@/components/AppShell';
import type { Contract, ContractType, ChatMessage } from '@cg/shared';

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [error, setError] = useState('');

  // AI chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Contract loaded. Ask me to make any changes — e.g. "Change the fee to $120k" or "Extend the timeline by 30 days".' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .getContract(params.id as string)
      .then(({ contract }) => setContract(contract))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendForSignature = async () => {
    setSending(true);
    setError('');
    try {
      const result = await api.sendForSignature(contract.id);
      setSendResult(result.message);
      setContract({ ...contract, status: 'sent' });
    } catch (err: any) {
      setError(err.message || 'Failed to send for signature.');
    } finally {
      setSending(false);
    }
  };

  const handleChatSend = async () => {
    const message = chatInput.trim();
    if (!message || chatLoading) return;
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: message }]);
    setChatLoading(true);
    try {
      const result = await api.reviewChat(contract.id, message);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I ran into an error. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !contract) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }
  if (!contract) return <div className="p-8 text-center text-red-500">Contract not found</div>;

  const fieldValues = typeof contract.field_values_json === 'string'
    ? JSON.parse(contract.field_values_json)
    : (contract.field_values_json ?? {});

  const contractType = (contract.contract_type || 'msa-sow') as ContractType;

  const typeLabel =
    contractType === 'msa-sow' ? 'MSA + SOW-01'
    : contractType === 'sow-standalone' ? 'Standalone SOW'
    : 'Change Order';

  const summaryFields = [
    { label: 'Client', value: fieldValues.client_legal_name },
    { label: 'Type', value: typeLabel },
    { label: 'Value', value: fieldValues.project_fee_usd ? `$${Number(fieldValues.project_fee_usd).toLocaleString()}` : undefined },
    { label: 'Rep', value: fieldValues.softway_rep },
    { label: 'Completion', value: fieldValues.completion_date },
    { label: 'Contact', value: fieldValues.client_contact_name },
    { label: 'Email', value: fieldValues.client_contact_email },
    { label: 'Service', value: fieldValues.service_type },
    { label: 'Location', value: fieldValues.location },
    { label: 'Workshops', value: fieldValues.workshop_count },
    { label: 'Attendees', value: fieldValues.attendee_count },
  ].filter((f): f is { label: string; value: string } => Boolean(f.value));

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        {/* Top banner */}
        <LegalLockBadge />

        {error && (
          <div className="mx-6 mt-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}
        {sendResult && (
          <div className="mx-6 mt-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-lg text-sm font-medium">
            {sendResult}
          </div>
        )}

        {/* Main 3-column layout */}
        <div className="flex flex-1 min-h-0">
          {/* Left panel — Contract Details + Clause Checks */}
          <div className="w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-y-auto">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-slate-900">Contract Details</h2>
                {contract.status === 'sent' && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold uppercase">
                    Sent ✓
                  </span>
                )}
              </div>
              <dl className="space-y-2.5 mt-3">
                {summaryFields.map((f) => (
                  <div key={f.label} className="flex items-start justify-between gap-2">
                    <dt className="text-xs text-slate-400 shrink-0 w-20">{f.label}</dt>
                    <dd className="text-xs font-medium text-slate-800 text-right leading-snug">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="p-5 flex-1">
              <ClauseCoverage contractType={contractType} />
            </div>

            <div className="p-4 border-t border-slate-100 space-y-2">
              <button
                onClick={() => router.push('/contracts/generate')}
                className="w-full border border-slate-200 text-slate-700 py-2 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors"
              >
                ← Edit Fields
              </button>
              <button
                onClick={handleSendForSignature}
                disabled={sending || contract.status === 'sent'}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white py-2 rounded-lg font-bold text-sm transition-colors"
              >
                {sending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : contract.status === 'sent' ? 'Sent ✓' : 'Send to DocuSign →'}
              </button>
            </div>
          </div>

          {/* Right panel — Google Doc iframe */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-100">
            <div className="flex-1 overflow-hidden">
              {contract.drive_file_id === 'demo-mock-id' ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center p-8 border border-slate-200 bg-white shadow-sm rounded-xl max-w-sm">
                    <span className="text-4xl block mb-4">📄</span>
                    <h3 className="font-bold text-slate-900 mb-2">Demo Mode Active</h3>
                    <p className="text-sm text-slate-500">
                      Google Drive sync is disabled in this demo. In production, the generated {typeLabel} Google Doc would appear here.
                    </p>
                  </div>
                </div>
              ) : contract.drive_file_id ? (
                <iframe
                  src={`https://docs.google.com/document/d/${contract.drive_file_id}/preview`}
                  className="w-full h-full border-0"
                  title="Contract Preview"
                />
              ) : (
                <div className="p-12 text-center text-slate-400">
                  <p className="font-medium">No preview available</p>
                </div>
              )}
            </div>

            {/* AI Chat — bottom */}
            <div className="border-t border-slate-200 bg-white">
              <div className="max-h-40 overflow-y-auto px-4 pt-3 space-y-2" style={{ scrollbarWidth: 'thin' }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px]">✨</span>
                      </div>
                    )}
                    <div className={`max-w-[75%] px-3 py-1.5 rounded-xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                      <span className="text-[10px]">✨</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl text-xs bg-slate-100 text-slate-400">Thinking...</div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="flex items-center gap-2 p-3 border-t border-slate-100">
                <span className="text-teal-500 text-sm">✨</span>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                  placeholder='Make a change... e.g. "Change the fee to $120k"'
                  className="flex-1 text-sm bg-transparent focus:outline-none text-slate-700 placeholder-slate-400"
                />
                <button
                  onClick={handleChatSend}
                  disabled={!chatInput.trim() || chatLoading}
                  className="text-teal-600 hover:text-teal-700 disabled:text-slate-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
