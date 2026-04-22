'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { Contract } from '@cg/shared';
import { AISidebar } from '@/components/AISidebar';

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Sidebar is collapsible so the editor can use the full viewport width.
  const [showSidebar, setShowSidebar] = useState(true);

  async function refresh() {
    try {
      const { contract } = await api.getContract(id);
      setContract(contract);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!contract) return <p className="text-slate-500">Loading contract…</p>;

  const embedUrl = `https://docs.google.com/document/d/${contract.driveFileId}/edit?rm=embedded`;
  const openUrl = `https://docs.google.com/document/d/${contract.driveFileId}/edit`;

  return (
    // Escape the parent `max-w-6xl` container so the editor can span the
    // full viewport width. `mx-[calc(50%-50vw)]` pulls both margins out to the
    // viewport edges; we then re-pad inside.
    <section className="space-y-4 mx-[calc(50%-50vw)] px-4 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link href="/contracts" className="hover:text-slate-900">
              ← Contracts
            </Link>
          </div>
          <h1 className="mt-1 truncate text-xl font-semibold tracking-tight">
            {contract.title}
          </h1>
          <p className="text-sm text-slate-500">
            Status: <span className="font-medium">{contract.status}</span> · created{' '}
            {new Date(contract.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowSidebar((s) => !s)}
            className="text-sm text-slate-600 hover:text-slate-900"
            title={showSidebar ? 'Hide AI sidebar' : 'Show AI sidebar'}
          >
            {showSidebar ? 'Hide AI ›' : '‹ Show AI'}
          </button>
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Open in Docs ↗
          </a>
        </div>
      </div>

      <div
        className={`grid gap-4 ${
          showSidebar ? 'lg:grid-cols-[1fr_320px]' : 'lg:grid-cols-1'
        }`}
      >
        {/* Use viewport-relative height so the editor gets as much vertical
            space as possible — header + small margin accounts for layout padding. */}
        <div className="h-[calc(100vh-180px)] min-h-[600px] overflow-hidden rounded-lg border border-slate-200 bg-white">
          <iframe
            src={embedUrl}
            className="h-full w-full border-0"
            title={contract.title}
          />
        </div>
        {showSidebar && (
          <AISidebar
            driveFileId={contract.driveFileId}
            contractId={contract.id}
            onAfterEdit={refresh}
          />
        )}
      </div>
    </section>
  );
}
