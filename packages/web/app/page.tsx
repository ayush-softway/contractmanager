'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { User, Contract } from '@cg/shared';
import AppShell from '@/components/AppShell';
import TemplateGallery from '@/components/TemplateGallery';
import ClientDocUploadModal from '@/components/ClientDocUploadModal';

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
  const [uploadOpen, setUploadOpen] = useState(false);

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
      <ClientDocUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />

      {/* Top Gray Band - Start a new document */}
      <div className="bg-[#f1f3f4] pt-8 pb-10">
        <div className="max-w-[1000px] mx-auto px-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base text-slate-800">Start a new document</h2>
            <div className="flex items-center gap-3 text-sm text-slate-600">
               <button
                 onClick={() => setUploadOpen(true)}
                 className="flex items-center gap-1.5 border border-slate-300 hover:border-slate-400 hover:bg-white px-3 py-1.5 rounded text-slate-600 hover:text-slate-800 transition-all text-sm font-medium"
               >
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                 </svg>
                 Upload Client Document
               </button>
               <button
                 onClick={() => setShowGallery(true)}
                 className="hover:bg-slate-200 px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
               >
                  Template gallery
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
               </button>
               <button className="p-1.5 hover:bg-slate-200 rounded-full"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg></button>
            </div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
            {/* Blank Document */}
            <div className="shrink-0 group cursor-pointer w-[140px]" onClick={() => router.push('/contracts/generate')}>
              <div className="h-[180px] bg-white border border-slate-200 rounded-sm hover:border-blue-500 transition-colors flex items-center justify-center mb-2">
                <svg className="w-12 h-12" viewBox="0 0 36 36">
                  <path fill="#34A853" d="M16 16v14h4V20z" />
                  <path fill="#4285F4" d="M30 16H20l-4 4h14z" />
                  <path fill="#FBBC05" d="M6 16v4h10l4-4z" />
                  <path fill="#EA4335" d="M20 16V6h-4v14z" />
                  <path fill="none" d="M0 0h36v36H0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-800">Blank Contract</p>
            </div>

            {/* Templates */}
            {[
                { label: 'MSA', slug: 'msa', color: 'bg-blue-100' },
                { label: 'MSA + SOW', slug: 'msa-sow', color: 'bg-indigo-100' },
                { label: 'Standalone SOW', slug: 'sow-standalone', color: 'bg-teal-100' },
                { label: 'Change Order', slug: 'change-order', color: 'bg-amber-100' },
            ].map((tpl) => (
              <div key={tpl.slug} className="shrink-0 group cursor-pointer w-[140px]" onClick={() => router.push(`/contracts/generate?template=${tpl.slug}`)}>
                <div className="h-[180px] bg-white border border-slate-200 rounded-sm hover:border-blue-500 transition-colors mb-2 overflow-hidden flex flex-col relative">
                  <div className={`h-[70px] ${tpl.color} flex shrink-0 border-b border-slate-100`} />
                  <div className="flex-1 p-3">
                     <div className="h-1.5 bg-slate-100 rounded mb-2 w-3/4" />
                     <div className="h-1.5 bg-slate-100 rounded mb-2 w-full" />
                     <div className="h-1.5 bg-slate-100 rounded mb-2 w-5/6" />
                     <div className="h-1.5 bg-slate-100 rounded mb-2 w-full" />
                     <div className="h-1.5 bg-slate-100 rounded mb-2 w-4/5" />
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-800">{tpl.label}</p>
                <p className="text-xs text-slate-500">Softway Template</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom White Band - Recent documents */}
      <div className="bg-white py-8 min-h-screen">
        <div className="max-w-[1000px] mx-auto px-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-medium text-slate-800">Recent documents</h2>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 text-sm text-slate-700 hover:bg-slate-100 px-3 py-1.5 rounded transition-colors">
                Owned by anyone
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className="flex items-center gap-1">
                <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg></button>
                <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg></button>
                <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg></button>
              </div>
            </div>
          </div>

          {contracts.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-sm">No contracts yet. Start a new document above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {contracts.slice(0, 10).map((c) => (
                <div key={c.id} className="group flex flex-col w-full h-64 border border-slate-200 rounded-sm bg-white hover:border-blue-500 hover:shadow-sm transition-all cursor-pointer overflow-hidden relative" onClick={() => router.push(`/contracts/${c.id}/review`)}>
                  <div className="h-[180px] bg-slate-50 border-b border-slate-200 flex flex-col p-4 overflow-hidden shrink-0">
                     <div className="text-[6px] text-slate-300 space-y-1.5">
                        <div className="h-1.5 bg-slate-200 w-full mb-2"></div>
                        <div className="h-1.5 bg-slate-200 w-5/6 mb-2"></div>
                        <div className="h-1.5 bg-slate-200 w-full mb-2"></div>
                        <div className="h-1.5 bg-slate-200 w-3/4 mb-2"></div>
                        <div className="h-1.5 bg-slate-200 w-full mb-2"></div>
                        <div className="h-1.5 bg-slate-200 w-full mb-2"></div>
                     </div>
                  </div>
                  <div className="flex-1 p-3 flex flex-col justify-center">
                    <p className="text-[13px] font-medium text-slate-800 leading-snug line-clamp-1 mb-1" title={c.title}>
                      {c.title}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-teal-600 rounded-[3px] text-white flex items-center justify-center font-bold text-[10px]">C</div>
                        <span>Opened {new Date(c.updatedAt ?? c.createdAt).toLocaleDateString()}</span>
                      </div>
                      <button className="p-1 hover:bg-slate-100 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                         <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function LoginPage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

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
          href={`${backendUrl}/auth/google/login`}
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
