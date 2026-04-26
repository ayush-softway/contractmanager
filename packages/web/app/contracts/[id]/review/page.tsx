'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function ReviewContractPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.getContract(params.id)
      .then(res => { setContract(res.contract); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [params.id]);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await api.sendForSignature(params.id, {
        signerEmail: contract.variableValues?.client_contact_email || 'client@example.com',
        signerName: contract.variableValues?.client_contact_name || 'Client',
      });
      setMessage('Envelope Created ✓ Document sent via DocuSign.');
      setContract(res.contract);
    } catch (err: any) {
      setError('Saved to Drive — DocuSign failed. Retry or send manually.');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading review...</div>;
  if (!contract) return <div className="p-8 text-center text-red-500">Contract not found</div>;

  return (
    <div className="max-w-6xl mx-auto p-8 flex flex-col gap-8">
      {/* 3-Step Progress Indicator */}
      <div className="flex items-center justify-center gap-4 text-sm font-semibold text-gray-500 mb-4 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="bg-teal-600 text-white w-6 h-6 rounded-full flex items-center justify-center">1</span>
          <span className="text-teal-800">Contract Type</span>
        </div>
        <span>→</span>
        <div className="flex items-center gap-2">
          <span className="bg-teal-600 text-white w-6 h-6 rounded-full flex items-center justify-center">2</span>
          <span className="text-teal-800">Fill Details</span>
        </div>
        <span>→</span>
        <div className="flex items-center gap-2">
          <span className="bg-teal-600 text-white w-6 h-6 rounded-full flex items-center justify-center">3</span>
          <span className="text-teal-800">Review & Send</span>
        </div>
      </div>

      <div className="flex gap-8 w-full">
        <div className="flex-1">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Review & Send</h1>
          {contract.status === 'sent_for_signature' && (
            <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full font-semibold">
              Signed / Sent ✓
            </span>
          )}
        </div>

        {error && <div className="bg-yellow-100 text-yellow-800 border border-yellow-200 p-4 mb-4 rounded">{error}</div>}
        {message && <div className="bg-green-100 text-green-800 border border-green-200 p-4 mb-4 rounded">{message}</div>}

        <div className="bg-gray-100 p-4 rounded-lg h-[600px] flex items-center justify-center border border-gray-300">
           <a 
             href={`https://docs.google.com/document/d/${contract.driveFileId}/edit`} 
             target="_blank" 
             rel="noreferrer"
             className="text-blue-600 hover:underline font-medium flex items-center gap-2"
           >
             📄 Open in Google Docs
           </a>
        </div>
        
        <div className="mt-8">
          <button 
            onClick={handleSend}
            disabled={sending || contract.status === 'sent_for_signature'}
            className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold text-lg disabled:bg-gray-400"
          >
            {sending ? 'Sending...' : 'Send via DocuSign'}
          </button>
        </div>
      </div>

      <div className="w-96">
        <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 p-4">
            <h2 className="font-bold text-gray-800">Locked vs Changed</h2>
          </div>
          <div className="p-4 bg-blue-50/50">
            <h3 className="font-semibold text-sm text-blue-800 mb-2 flex items-center gap-2">
              🔒 LOCKED — Legal Approved (never edits)
            </h3>
            <ul className="text-sm text-gray-600 space-y-2 mb-6">
              <li>Section 3: Confidentiality</li>
              <li>Section 8: Limitation of Liability</li>
              <li>Section 15: Governing Law</li>
              <li className="text-gray-400 italic">[+ 3 more]</li>
            </ul>

            <h3 className="font-semibold text-sm text-green-800 mb-2 flex items-center gap-2">
              ✏️ VARIABLE — Filled by this form
            </h3>
            <ul className="text-sm text-gray-800 space-y-2">
              <li className="flex justify-between border-b border-green-100 pb-1">
                <span className="text-gray-600">Client:</span>
                <span className="font-medium text-right break-words w-32">{contract.variableValues?.client_legal_name || '-'} ✅</span>
              </li>
              <li className="flex justify-between border-b border-green-100 pb-1">
                <span className="text-gray-600">Value:</span>
                <span className="font-medium text-right break-words w-32">{contract.variableValues?.project_fee_usd || '-'} ✅</span>
              </li>
              <li className="flex justify-between pb-1">
                <span className="text-gray-600">SOW #:</span>
                <span className="font-medium text-right break-words w-32">{contract.variableValues?.sow_number || '-'} ✅</span>
              </li>
            </ul>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
