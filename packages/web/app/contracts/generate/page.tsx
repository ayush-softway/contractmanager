'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import StepIndicator from '@/components/StepIndicator';
import ContractTypeSelector from '@/components/ContractTypeSelector';
import AddSourceBar from '@/components/AddSourceBar';
import SmartField from '@/components/SmartField';
import type { ContractType, ImportSource } from '@cg/shared';

const ALL_FIELDS = [
  { id: 'client_legal_name', label: 'Client Legal Name', type: 'text' as const },
  { id: 'client_address', label: 'Client Address', type: 'text' as const },
  { id: 'client_contact_name', label: 'Client Contact Name', type: 'text' as const },
  { id: 'client_contact_email', label: 'Client Contact Email', type: 'email' as const },
  { id: 'softway_rep', label: 'Softway Rep', type: 'text' as const },
  { id: 'sow_number', label: 'SOW Number', type: 'text' as const },
  { id: 'contract_date', label: 'Contract Date', type: 'date' as const },
  { id: 'project_fee_usd', label: 'Total Value (USD)', type: 'number' as const },
  { id: 'service_type', label: 'Service Type / Scope', type: 'text' as const },
  { id: 'workshop_count', label: 'Workshop Count', type: 'number' as const },
  { id: 'duration_hrs', label: 'Duration (hrs)', type: 'number' as const },
  { id: 'attendee_count', label: 'Attendee Count', type: 'number' as const },
  { id: 'facilitator_count', label: 'Facilitator Count', type: 'number' as const },
  { id: 'location', label: 'Location', type: 'text' as const },
  { id: 'completion_date', label: 'Completion Date', type: 'date' as const },
  { id: 'event_dates', label: 'Event Dates', type: 'text' as const },
  { id: 'payment_structure', label: 'Payment Structure', type: 'select' as const },
  { id: 'discount_type', label: 'Discount Type', type: 'select' as const },
  { id: 'discount_amount', label: 'Discount Amount', type: 'number' as const },
  { id: 'travel_required', label: 'Travel Required', type: 'toggle' as const },
  { id: 'travel_cap', label: 'Travel Cap (USD)', type: 'number' as const, conditional: 'travel_required' },
  { id: 'msa_date', label: 'Prior MSA Date', type: 'date' as const, conditional: '_show_msa_date' },
];

const REQUIRED_FIELDS: Record<ContractType, string[]> = {
  'msa-sow': ['client_legal_name', 'client_address', 'client_contact_name', 'client_contact_email', 'softway_rep', 'project_fee_usd', 'completion_date', 'service_type'],
  'sow-standalone': ['client_legal_name', 'msa_date', 'softway_rep', 'project_fee_usd', 'completion_date', 'service_type'],
  'change-order': ['client_legal_name', 'sow_number', 'completion_date', 'project_fee_usd'],
};

export default function GenerateContractPage() {
  const router = useRouter();
  const [contractType, setContractType] = useState<ContractType>('msa-sow');
  const [fields, setFields] = useState<Record<string, string>>({
    contract_date: new Date().toLocaleDateString('en-US'),
  });
  const [fieldSources, setFieldSources] = useState<Record<string, ImportSource | 'auto' | 'manual'>>({
    contract_date: 'auto',
  });
  const [sourceChips, setSourceChips] = useState<{ id: string; label: string; type: string }[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const firstErrorRef = useRef<HTMLDivElement>(null);

  // Conditional field visibility
  const showTravelCap = fields.travel_required === 'yes';
  const showMsaDate = contractType === 'sow-standalone' || fields._prior_msa === 'yes';

  const visibleFields = ALL_FIELDS.filter(f => {
    if (f.conditional === 'travel_required' && !showTravelCap) return false;
    if (f.conditional === '_show_msa_date' && !showMsaDate) return false;
    return true;
  });

  const requiredForType = REQUIRED_FIELDS[contractType] ?? [];

  const handleSourceImported = (imported: {
    fields: Record<string, string>;
    source: string;
    label: string;
  }) => {
    const newSources: Record<string, ImportSource> = {};
    Object.keys(imported.fields).forEach(k => {
      if (imported.fields[k]) newSources[k] = imported.source as ImportSource;
    });
    setFields(prev => ({ ...prev, ...imported.fields }));
    setFieldSources(prev => ({ ...prev, ...newSources }));
    setSourceChips(prev => [
      ...prev,
      { id: Date.now().toString(), label: imported.label, type: imported.source },
    ]);
  };

  const handleFieldChange = (id: string, value: string) => {
    setFields(prev => ({ ...prev, [id]: value }));
    setFieldSources(prev => ({ ...prev, [id]: 'manual' }));
  };

  const handleGenerate = async () => {
    setShowValidation(true);
    setError('');

    const missing = requiredForType.filter(k => !fields[k]);
    if (missing.length > 0) {
      setError(`Missing required fields: ${missing.map(k => ALL_FIELDS.find(f => f.id === k)?.label || k).join(', ')}`);
      // Scroll to first error
      setTimeout(() => {
        const el = document.querySelector('[data-unfilled="true"]');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }

    setLoading(true);
    try {
      const result = await api.generateContract({ contractType, fields });
      router.push(`/contracts/${result.contractId}/review`);
    } catch (err: any) {
      setError(err.message || 'Contract generation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <StepIndicator currentStep={2} />

      <h1 className="text-3xl font-bold text-slate-900 mb-8">Generate Contract</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Contract Type */}
      <ContractTypeSelector value={contractType} onChange={setContractType} />

      {/* Step 1b: Add Source */}
      <AddSourceBar
        chips={sourceChips}
        onImported={handleSourceImported}
        onRemoveChip={(id) => setSourceChips(prev => prev.filter(c => c.id !== id))}
        onError={(msg) => setError(msg)}
      />

      {/* Step 2: Contract Details */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Contract Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {visibleFields.map(field => {
            const isRequired = requiredForType.includes(field.id);
            const isUnfilled = isRequired && !fields[field.id] && showValidation;
            return (
              <SmartField
                key={field.id}
                id={field.id}
                label={field.label}
                type={field.type}
                value={fields[field.id] || ''}
                source={fieldSources[field.id]}
                required={isRequired}
                unfilled={isUnfilled}
                onChange={(val) => handleFieldChange(field.id, val)}
              />
            );
          })}
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white py-4 rounded-xl font-bold text-lg transition-colors shadow-sm"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Generating...
          </span>
        ) : (
          'Generate Contract →'
        )}
      </button>
    </div>
  );
}
