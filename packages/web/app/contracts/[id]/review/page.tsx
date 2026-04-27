'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import StepIndicator from '@/components/StepIndicator';
import LegalLockBadge from '@/components/LegalLockBadge';
import ClauseCoverage from '@/components/ClauseCoverage';
import type { Contract, ContractType } from '@cg/shared';

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getContract(params.id as string)
      .then(({ contract }) => setContract(contract))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
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

  const summaryFields = [
    { label: 'Client', value: fieldValues.client_legal_name },
    { label: 'Type', value: contractType === 'msa-sow' ? 'MSA + SOW-01' : contractType === 'sow-standalone' ? 'Standalone SOW' : 'Change Order' },
    { label: 'Value', value: fieldValues.project_fee_usd ? `$${Number(fieldValues.project_fee_usd).toLocaleString()}` : '—' },
    { label: 'Rep', value: fieldValues.softway_rep },
    { label: 'Date', value: fieldValues.contract_date },
    { label: 'Completion', value: fieldValues.completion_date },
    { label: 'SOW #', value: fieldValues.sow_number },
    { label: 'Contact', value: fieldValues.client_contact_name },
    { label: 'Email', value: fieldValues.client_contact_email },
    { label: 'Service', value: fieldValues.service_type },
    { label: 'Location', value: fieldValues.location },
    { label: 'Workshops', value: fieldValues.workshop_count },
    { label: 'Attendees', value: fieldValues.attendee_count },
  ].filter(f => f.value);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <StepIndicator currentStep={3} />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {sendResult && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg mb-6 text-sm font-medium">
          {sendResult}
        </div>
      )}

      <div className="flex gap-8">
        {/* Left Column — Contract Summary */}
        <div className="w-80 flex-shrink-0 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Review & Send</h1>
            {contract.status === 'sent' && (
              <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold uppercase">
                Sent ✓
              </span>
            )}
          </div>

          {/* Summary Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Contract Summary</h2>
            <dl className="space-y-2">
              {summaryFields.map(f => (
                <div key={f.label}>
                  <dt className="text-xs text-slate-400 uppercase">{f.label}</dt>
                  <dd className="text-sm font-medium text-slate-900">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Clause Coverage */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <ClauseCoverage contractType={contractType} />
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => router.push('/contracts/generate')}
              className="w-full border border-slate-200 text-slate-700 py-2.5 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors"
            >
              ← Edit Fields
            </button>
            <button
              onClick={handleSendForSignature}
              disabled={sending || contract.status === 'sent'}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-bold text-sm transition-colors"
            >
              {sending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating PDF and creating envelope...
                </span>
              ) : contract.status === 'sent' ? (
                'Sent ✓'
              ) : (
                'Send to DocuSign →'
              )}
            </button>
          </div>
        </div>

        {/* Right Column — Contract Preview */}
        <div className="flex-1 space-y-4">
          <LegalLockBadge />

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {contract.drive_file_id === 'demo-mock-id' ? (
              <div className="w-full h-[700px] flex items-center justify-center bg-slate-50">
                <div className="text-center p-8 border border-slate-200 bg-white shadow-sm rounded-xl max-w-sm">
                  <span className="text-4xl block mb-4">📄</span>
                  <h3 className="font-bold text-slate-900 mb-2">Demo Mode Active</h3>
                  <p className="text-sm text-slate-500">
                    Google Drive sync is disabled in this unauthenticated demo. 
                    In production, the generated {contractType === 'msa-sow' ? 'MSA + SOW-01' : 'Contract'} Google Doc would appear here.
                  </p>
                </div>
              </div>
            ) : contract.drive_file_id ? (
              <iframe
                src={`https://docs.google.com/document/d/${contract.drive_file_id}/preview`}
                className="w-full h-[700px] border-0"
                title="Contract Preview"
              />
            ) : (
              <div className="p-12 text-center text-slate-400">
                <p className="text-lg font-medium">No preview available</p>
                <p className="text-sm mt-1">The contract document was not generated in Google Drive.</p>
              </div>
            )}
          </div>

          {contract.drive_file_id && (
            <a
              href={`https://docs.google.com/document/d/${contract.drive_file_id}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 font-medium"
            >
              📄 Open in Google Docs ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
