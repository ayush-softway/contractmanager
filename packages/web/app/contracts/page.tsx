'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function ContractsListPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listContracts()
      .then(({ contracts }) => setContracts(contracts))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    generated: 'bg-blue-100 text-blue-800',
    sent: 'bg-amber-100 text-amber-800',
    signed: 'bg-emerald-100 text-emerald-800',
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Contract History</h1>
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
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg font-medium">No contracts yet</p>
          <p className="text-sm mt-1">Generate your first contract to see it here.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {contracts.map((c, i) => (
            <Link
              key={c.id}
              href={`/contracts/${c.id}/review`}
              className={`flex items-center justify-between p-4 hover:bg-slate-50 transition-colors ${
                i > 0 ? 'border-t border-slate-100' : ''
              }`}
            >
              <div>
                <p className="font-medium text-slate-900">{c.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(c.created_at).toLocaleString()}
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColors[c.status] || 'bg-slate-100 text-slate-600'}`}>
                {c.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
