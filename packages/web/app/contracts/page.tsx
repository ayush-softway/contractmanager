'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Contract, ContractDraft } from '@cg/shared';

/**
 * Gallery-style Contracts landing page, modeled on the Google Docs home:
 *  - Top strip: a large "Create contract" card (the +) followed by recent
 *    contracts and in-progress drafts as thumbnail-style cards.
 *  - Below: a searchable list of all contracts and drafts ("Recent documents").
 *
 * Clicking the + navigates to /contracts/new (the wizard). Drafts resume via
 * /contracts/new?draftId=… ; finalized contracts open at /contracts/[id].
 */

type GalleryItem =
  | { kind: 'contract'; contract: Contract; updatedAt: string }
  | { kind: 'draft'; draft: ContractDraft; updatedAt: string };

function itemKey(item: GalleryItem): string {
  return item.kind === 'contract' ? `c:${item.contract.id}` : `d:${item.draft.id}`;
}

function itemTitle(item: GalleryItem): string {
  return item.kind === 'contract' ? item.contract.title : item.draft.title;
}

function itemHref(item: GalleryItem): string {
  return item.kind === 'contract'
    ? `/contracts/${item.contract.id}`
    : `/contracts/new?draftId=${item.draft.id}`;
}

function itemSubtitle(item: GalleryItem): string {
  const when = new Date(item.updatedAt).toLocaleString();
  if (item.kind === 'draft') return `Draft · updated ${when}`;
  return `${item.contract.status} · updated ${when}`;
}

export default function ContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [drafts, setDrafts] = useState<ContractDraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  async function refresh() {
    try {
      const [{ contracts }, { drafts }] = await Promise.all([
        api.listContracts(),
        api.listContractDrafts(),
      ]);
      setContracts(contracts);
      setDrafts(drafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  // Merge and sort by updatedAt desc. Drafts and contracts live together.
  const items: GalleryItem[] = useMemo(() => {
    const merged: GalleryItem[] = [];
    (contracts ?? []).forEach((c) =>
      merged.push({ kind: 'contract', contract: c, updatedAt: c.updatedAt }),
    );
    (drafts ?? []).forEach((d) =>
      merged.push({ kind: 'draft', draft: d, updatedAt: d.updatedAt }),
    );
    merged.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return merged;
  }, [contracts, drafts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => itemTitle(it).toLowerCase().includes(q));
  }, [items, search]);

  // Strip cards = create + up to 6 most-recent.
  const stripRecents = items.slice(0, 6);

  const loading = contracts === null || drafts === null;

  async function handleDeleteDraft(draftId: string) {
    if (!confirm('Delete this draft? This cannot be undone.')) return;
    try {
      await api.deleteContractDraft(draftId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete draft');
    }
  }

  return (
    <section className="space-y-8">
      {/* --------------------------- Top strip --------------------------- */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-700">Start a new document</h2>
          <Link
            href="/templates"
            className="text-xs text-slate-500 hover:text-slate-900"
          >
            Template gallery ↗
          </Link>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-1">
          {/* Create-contract tile — the equivalent of Docs' "Blank document" */}
          <button
            type="button"
            onClick={() => router.push('/contracts/new')}
            className="group flex w-44 flex-shrink-0 flex-col focus:outline-none"
          >
            <div className="flex h-56 w-44 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white transition hover:border-brand hover:bg-brand/5">
              <svg
                viewBox="0 0 24 24"
                className="h-12 w-12 text-slate-400 transition group-hover:text-brand"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </div>
            <div className="mt-2 text-sm font-medium text-slate-900">Create contract</div>
            <div className="text-xs text-slate-500">Start from a template</div>
          </button>

          {/* Recent-document thumbnails */}
          {stripRecents.map((item) => (
            <Link
              key={itemKey(item)}
              href={itemHref(item)}
              className="group flex w-44 flex-shrink-0 flex-col"
            >
              <div className="relative flex h-56 w-44 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-brand hover:shadow">
                {item.kind === 'draft' && (
                  <span className="absolute right-2 top-2 z-10 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                    Draft
                  </span>
                )}
                {item.kind === 'contract' ? (
                  <DocThumbnail driveFileId={item.contract.driveFileId} />
                ) : (
                  <div className="flex-1 overflow-hidden p-3 text-[10px] leading-snug text-slate-400">
                    <div className="h-2 w-3/4 rounded bg-slate-100" />
                    <div className="mt-2 h-2 w-full rounded bg-slate-100" />
                    <div className="mt-1.5 h-2 w-5/6 rounded bg-slate-100" />
                    <div className="mt-1.5 h-2 w-full rounded bg-slate-100" />
                    <div className="mt-1.5 h-2 w-2/3 rounded bg-slate-100" />
                    <div className="mt-4 h-2 w-1/2 rounded bg-slate-100" />
                    <div className="mt-2 h-2 w-full rounded bg-slate-100" />
                    <div className="mt-1.5 h-2 w-4/5 rounded bg-slate-100" />
                  </div>
                )}
              </div>
              <div className="mt-2 truncate text-sm font-medium text-slate-900 group-hover:text-brand">
                {itemTitle(item)}
              </div>
              <div className="truncate text-xs text-slate-500">{itemSubtitle(item)}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* -------------------------- Error / loading -------------------------- */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* -------------------------- Recent documents ------------------------- */}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-slate-700">Recent documents</h2>
          <input
            type="search"
            placeholder="Search by title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-60 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
          />
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500">
            {items.length === 0
              ? 'No contracts yet. Click “Create contract” above to generate your first one.'
              : 'No contracts match your search.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {filtered.map((item) => (
              <li
                key={itemKey(item)}
                className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50"
              >
                <Link href={itemHref(item)} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-900 hover:text-brand">
                      {itemTitle(item)}
                    </span>
                    {item.kind === 'draft' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                        Draft
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-500">
                    {itemSubtitle(item)}
                  </div>
                </Link>
                {item.kind === 'draft' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteDraft(item.draft.id)}
                    className="text-xs text-slate-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Drive document thumbnail — shows a real preview for finalized contracts.
// Falls back to the skeleton if the image fails to load (e.g. cookie blocked).
// ---------------------------------------------------------------------------
function DocThumbnail({ driveFileId }: { driveFileId: string }) {
  const [failed, setFailed] = useState(false);
  const src = `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w176-h224`;

  if (failed) {
    return (
      <div className="flex-1 overflow-hidden p-3 text-[10px] leading-snug text-slate-400">
        <div className="h-2 w-3/4 rounded bg-slate-100" />
        <div className="mt-2 h-2 w-full rounded bg-slate-100" />
        <div className="mt-1.5 h-2 w-5/6 rounded bg-slate-100" />
        <div className="mt-1.5 h-2 w-full rounded bg-slate-100" />
        <div className="mt-1.5 h-2 w-2/3 rounded bg-slate-100" />
        <div className="mt-4 h-2 w-1/2 rounded bg-slate-100" />
        <div className="mt-2 h-2 w-full rounded bg-slate-100" />
        <div className="mt-1.5 h-2 w-4/5 rounded bg-slate-100" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-full w-full object-cover object-top"
      onError={() => setFailed(true)}
    />
  );
}
