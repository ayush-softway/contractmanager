'use client';

// ContractTypeSelector — radio card group for the 3 contract types

import type { ContractType } from '@cg/shared';

interface ContractTypeSelectorProps {
  value: ContractType;
  onChange: (type: ContractType) => void;
}

const TYPES: { slug: ContractType; label: string; description: string }[] = [
  { slug: 'msa-sow', label: 'MSA + SOW-01', description: 'New client — full legal package attached' },
  { slug: 'sow-standalone', label: 'Standalone SOW', description: 'Repeat client with existing MSA on file' },
  { slug: 'change-order', label: 'Change Order', description: 'Scope or pricing update to an existing SOW' },
];

export default function ContractTypeSelector({ value, onChange }: ContractTypeSelectorProps) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Contract Type</h2>
      <div className="grid gap-3">
        {TYPES.map(t => (
          <button
            key={t.slug}
            type="button"
            onClick={() => onChange(t.slug)}
            className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
              value === t.slug
                ? 'border-teal-600 bg-teal-50/60 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <h3 className="font-semibold text-slate-900">{t.label}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{t.description}</p>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-4 ${
                value === t.slug ? 'border-teal-600' : 'border-slate-300'
              }`}
            >
              {value === t.slug && <div className="w-2.5 h-2.5 bg-teal-600 rounded-full" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
