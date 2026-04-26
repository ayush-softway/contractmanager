'use client';

// ClauseCoverage — 6 green checkmarks for legal clause verification

import type { ContractType } from '@cg/shared';

const CLAUSES = [
  'Limitation of Liability',
  'Indemnification',
  'IP Ownership',
  'Termination for Convenience',
  'Governing Law',
  'Confidentiality/NDA',
];

interface ClauseCoverageProps {
  contractType: ContractType;
}

export default function ClauseCoverage({ contractType }: ClauseCoverageProps) {
  if (contractType === 'change-order') {
    return (
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Clause Coverage</h3>
        <p className="text-sm text-slate-500 italic">
          Governed by original SOW — clauses apply from parent agreement.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Clause Coverage</h3>
      <ul className="space-y-2">
        {CLAUSES.map(clause => (
          <li key={clause} className="flex items-center gap-2 text-sm">
            <span className="text-emerald-600 font-bold">✅</span>
            <span className="text-slate-700">{clause}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
