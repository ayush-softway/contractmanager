'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import LegalLockBadge from '@/components/LegalLockBadge';
import ClauseCoverage from '@/components/ClauseCoverage';
import ContractDoc from '@/components/ContractDoc';
import AppShell from '@/components/AppShell';
import type { ContractType, ChatMessage } from '@cg/shared';

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const [contract, setContract] = useState<any>(null);
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [lastPatchedField, setLastPatchedField] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [error, setError] = useState('');

  // Clause checks
  const [clauseChecks, setClauseChecks] = useState<Record<string, boolean>>({});
  const [clauseNames, setClauseNames] = useState<Record<string, string>>({});

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
      .then(({ contract: c }) => {
        const raw = c as any;
        setContract(raw);
        if (raw.renderedHtmlSnapshot) {
          setRenderedHtml(raw.renderedHtmlSnapshot);
        }
        if (raw.clauseChecksJson) {
          try { setClauseChecks(JSON.parse(raw.clauseChecksJson)); } catch {}
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    // Fetch clause names for display
    api.listClauses()
      .then(({ clauses }) => {
        const names: Record<string, string> = {};
        clauses.forEach((c) => { names[c.id] = c.name; });
        setClauseNames(names);
      })
      .catch(() => {});
  }, [params.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendForSignature = async () => {
    setShowSendModal(false);
    setSending(true);
    setError('');
    try {
      const result = await api.sendForSignature(contract.id);
      setSendResult(result.message ?? 'Envelope sent successfully.');
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

      if (result.updatedHtml) {
        setRenderedHtml(result.updatedHtml);
        setLastPatchedField(result.patch?.field);
        // Re-fetch contract to update left panel field values and clause checks
        const { contract: updated } = await api.getContract(contract.id as string);
        const updatedRaw = updated as any;
        setContract(updatedRaw);
        if (updatedRaw.clauseChecksJson) {
          try { setClauseChecks(JSON.parse(updatedRaw.clauseChecksJson)); } catch {}
        }
      }
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

  const rawFieldValues = typeof contract.fieldValuesJson === 'string'
    ? JSON.parse(contract.fieldValuesJson)
    : (contract.fieldValuesJson ?? {});

  // Strip internal tracking keys from display
  const fieldValues = { ...rawFieldValues };
  delete fieldValues.__clause_modifications;

  const contractType = (contract.contractType || 'msa-sow') as ContractType;

  const typeLabel =
    contractType === 'msa' ? 'Master Services Agreement'
    : contractType === 'msa-sow' ? 'MSA + SOW-01'
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

  const allClausesPass = Object.keys(clauseChecks).length > 0
    && Object.values(clauseChecks).every(Boolean);

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        {/* Top banner — conditional */}
        <LegalLockBadge allClausesPass={allClausesPass} status={contract.status} />

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

        {/* Main layout */}
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
              <ClauseCoverage clauseChecks={clauseChecks} clauseNames={clauseNames} />
            </div>

            <div className="p-4 border-t border-slate-100 space-y-2">
              {!allClausesPass && Object.keys(clauseChecks).length > 0 && (
                <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 text-center">
                  ⚠️ Some clause checks need review
                </p>
              )}
              <button
                onClick={() => router.push('/contracts/generate')}
                className="w-full border border-slate-200 text-slate-700 py-2 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors"
              >
                ← Edit Fields
              </button>
              <button
                onClick={() => setShowSendModal(true)}
                disabled={sending || contract.status === 'sent' || !allClausesPass}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2 rounded-lg font-bold text-sm transition-colors"
              >
                {sending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : contract.status === 'sent' ? 'Sent ✓'
                  : !allClausesPass ? '🔒 Resolve clauses first'
                  : 'Send to DocuSign →'}
              </button>
            </div>
          </div>

          {/* Right panel — rendered contract or Drive iframe */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-100">
            <div className="flex-1 overflow-hidden flex flex-col">
              {contract.driveFileId === 'demo-mock-id' ? (
                renderedHtml ? (
                  <ContractDoc
                  html={renderedHtml}
                  highlightField={lastPatchedField}
                  title={contract.title}
                  contractId={contract.id}
                  onHtmlChange={(html) => setRenderedHtml(html)}
                />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                    Generating preview...
                  </div>
                )
              ) : contract.driveFileId ? (
                <iframe
                  src={`https://docs.google.com/document/d/${contract.driveFileId}/preview`}
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
      {/* DocuSign send confirmation modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Send for Signature</h2>
              <p className="text-sm text-slate-500 mt-1">Review the envelope details before sending.</p>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <span className="text-lg">📧</span>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Sending to</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {fieldValues.client_contact_name || 'Client Signer'}
                    </p>
                    <p className="text-sm text-teal-700">
                      {fieldValues.client_contact_email || 'signer@example.com'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-lg">📄</span>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Document</p>
                    <p className="text-sm font-semibold text-slate-900">{contract.title}</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 text-center">
                A signature request will be sent via DocuSign.
              </p>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={() => setShowSendModal(false)}
                className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-xl font-medium text-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendForSignature}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-xl font-bold text-sm transition-colors"
              >
                Send →
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
