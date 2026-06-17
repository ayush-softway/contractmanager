'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import type { Contract } from '@cg/shared';

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  generated: 'bg-blue-100 text-blue-700',
  sent: 'bg-amber-100 text-amber-700',
  signed: 'bg-emerald-100 text-emerald-700',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  generated: 'In Review',
  sent: 'Sent',
  signed: 'Signed',
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  'msa': 'Master Services Agreement',
  'msa-sow': 'MSA + SOW',
  'sow-standalone': 'Standalone SOW',
  'change-order': 'Change Order',
  'nda': 'Non-Disclosure Agreement',
};

export default function VaultPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listContracts()
      .then(({ contracts }) => setContracts(contracts))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="px-8 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Contract Vault</h1>
            <p className="text-sm text-slate-500 mt-0.5">All contracts, searchable and archived.</p>
          </div>
          <Link
            href="/contracts/generate"
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            + New Contract
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white">
            <p className="text-sm font-medium">No contracts yet</p>
            <p className="text-xs mt-1">Generate your first contract to see it here.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contract</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {contracts.map((c, i) => (
                  <tr key={c.id} className={`${i > 0 ? 'border-t border-slate-100' : ''} hover:bg-slate-50 transition-colors`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{c.title}</p>
                      <p className="text-xs text-slate-400">{CONTRACT_TYPE_LABELS[c.contractType] ?? c.contractType?.replace(/-/g, ' ')}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColors[c.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {statusLabels[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/contracts/${c.id}/review`}
                        className="text-xs font-semibold text-teal-600 hover:text-teal-700"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
