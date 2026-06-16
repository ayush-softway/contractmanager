'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { Contract } from '@cg/shared';
import { AISidebar } from '@/components/AISidebar';

const CONTRACT_STATUSES = [
  'draft',
  'reviewing',
  'sent_for_signature',
  'signed',
  'executed',
  'archived',
] as const;

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

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

  async function handleStatusChange(newStatus: string) {
    if (!contract || newStatus === contract.status) return;
    setStatusSaving(true);
    try {
      const { contract: updated } = await api.updateContractStatus(id, newStatus);
      setContract(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setStatusSaving(false);
    }
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!contract) return <p className="text-slate-500">Loading contract…</p>;

  const embedUrl = `https://docs.google.com/document/d/${contract.driveFileId}/edit?rm=embedded`;
  const openUrl = `https://docs.google.com/document/d/${contract.driveFileId}/edit`;

  return (
    // Escape the parent `max-w-6xl` container so the editor can span the
    // full viewport width. `mx-[calc(50%-50vw)]` pulls both margins out to the
    // viewport edges; we then re-pad inside.
    <section className="space-y-4 mx-[calc(50%-50vw)] min-w-0 overflow-x-hidden px-4 lg:px-8">
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
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>Status:</span>
            <select
              value={contract.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={statusSaving}
              className="rounded border border-slate-200 bg-white px-2 py-0.5 text-sm text-slate-700 focus:border-brand focus:outline-none disabled:opacity-60"
            >
              {CONTRACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {formatStatus(s)}
                </option>
              ))}
            </select>
            {statusSaving && <span className="text-xs text-slate-400">Saving…</span>}
            <span className="text-slate-300">·</span>
            <span>created {new Date(contract.createdAt).toLocaleString()}</span>
          </div>
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
        <div className="relative h-[calc(100vh-180px)] min-h-[600px] overflow-hidden rounded-lg border border-slate-200 bg-white">
          {iframeLoading && !iframeError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white">
              <svg
                className="h-8 w-8 animate-spin text-slate-300"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-sm text-slate-400">Loading document…</p>
            </div>
          )}
          {iframeError ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <svg viewBox="0 0 24 24" className="h-10 w-10 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <p className="font-medium text-slate-700">Google Docs couldn't load in this frame</p>
                <p className="mt-1 text-sm text-slate-500">
                  This can happen when third-party cookies are blocked.
                </p>
              </div>
              <a
                href={openUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
              >
                Open in Google Docs ↗
              </a>
            </div>
          ) : (
            <iframe
              src={embedUrl}
              className="h-full w-full border-0"
              title={contract.title}
              loading="lazy"
              allow="clipboard-read; clipboard-write"
              onLoad={() => setIframeLoading(false)}
              onError={() => { setIframeLoading(false); setIframeError(true); }}
            />
          )}
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
