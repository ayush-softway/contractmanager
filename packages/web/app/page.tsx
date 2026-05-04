'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { User, Contract } from '@cg/shared';
import AppShell from '@/components/AppShell';
import TemplateGallery from '@/components/TemplateGallery';

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  generated: 'bg-blue-100 text-blue-700',
  'in-review': 'bg-amber-100 text-amber-700',
  sent: 'bg-amber-100 text-amber-700',
  signed: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-emerald-100 text-emerald-700',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  generated: 'In Review',
  sent: 'Sent',
  signed: 'Signed',
  completed: 'Completed',
};

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGallery, setShowGallery] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(({ user }) => {
        setUser(user);
        return api.listContracts();
      })
      .then(({ contracts }) => setContracts(contracts))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <AppShell>
      {showGallery && <TemplateGallery onClose={() => setShowGallery(false)} />}
      <div className="px-8 py-8 max-w-5xl">
        {/* Start Something New */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Start Something New
          </h2>
          <div className="flex items-start gap-4 flex-wrap">
            {/* New Contract card */}
            <Link
              href="/contracts/generate"
              className="flex flex-col items-center justify-center w-36 h-44 border-2 border-dashed border-slate-300 rounded-xl bg-white hover:border-teal-400 hover:bg-teal-50 transition-colors group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-teal-100 group-hover:bg-teal-200 flex items-center justify-center mb-3 transition-colors">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-teal-700 text-center leading-tight px-2">
                New Contract
              </span>
              <span className="text-[10px] text-slate-400 mt-1 text-center px-2">
                Create from scratch
              </span>
            </Link>

            {/* Template Gallery panel */}
            <div className="flex-1 min-w-72 bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900">Template Gallery</h3>
                <button
                  onClick={() => setShowGallery(true)}
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                >
                  View all →
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {['NDA', 'MSA + SOW', 'Standalone SOW', 'Change Order', 'Employment'].map((label) => (
                  <button
                    key={label}
                    onClick={() => {
                      const slug = label.toLowerCase().replace(/\s+\+\s+/g, '-').replace(/\s+/g, '-');
                      router.push(`/contracts/generate?template=${slug}`);
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Client Document */}
            <Link
              href="/upload"
              className="flex flex-col items-center justify-center w-36 h-44 border border-slate-200 rounded-xl bg-white hover:border-teal-400 hover:bg-slate-50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-teal-100 flex items-center justify-center mb-3 transition-colors">
                <svg className="w-5 h-5 text-slate-500 group-hover:text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-teal-700 text-center leading-tight px-2">
                Upload Client Document
              </span>
              <span className="text-[10px] text-slate-400 mt-1 text-center px-2">
                Redlines or client MSA
              </span>
            </Link>
          </div>
        </section>

        {/* Recent Contracts */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Recent Contracts
            </h2>
            <Link href="/vault" className="text-xs text-teal-600 hover:text-teal-700 font-medium">
              View all →
            </Link>
          </div>

          {contracts.length === 0 ? (
            <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white">
              <p className="text-sm font-medium">No contracts yet</p>
              <p className="text-xs mt-1">Generate your first contract above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {contracts.slice(0, 8).map((c) => (
                <Link
                  key={c.id}
                  href={`/contracts/${c.id}/review`}
                  className="bg-white border border-slate-200 rounded-xl p-4 hover:border-teal-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-8 h-10 bg-slate-100 rounded flex items-center justify-center group-hover:bg-teal-50">
                      <svg className="w-4 h-5 text-slate-400 group-hover:text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${statusColors[c.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {statusLabels[c.status] ?? c.status}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2 mb-1">
                    {c.title}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(c.updatedAt ?? c.createdAt).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <section className="mx-auto max-w-sm text-center space-y-8 py-20 px-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Softway <span className="text-teal-600">ContractGen</span>
          </h1>
          <p className="text-slate-500 text-sm">
            AI-powered contracts. Minutes, not hours.
          </p>
        </div>
        <a
          href="/api/backend/auth/google/login"
          className="inline-flex items-center gap-3 rounded-lg bg-teal-600 px-6 py-3 text-white font-semibold hover:bg-teal-700 transition-colors shadow-sm w-full justify-center"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </a>
        <p className="text-xs text-slate-400">Softway Solutions internal tool</p>
      </section>
    </div>
  );
}
