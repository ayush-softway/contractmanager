'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { StarterTemplate, Template } from '@cg/shared';

const ACCEPTED_TYPES = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Pull the Drive file ID out of a Google Docs URL. Accepts:
 *   - https://docs.google.com/document/d/<ID>/edit
 *   - https://drive.google.com/file/d/<ID>/view
 *   - a bare ID
 */
function parseGoogleDocId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch?.[1]) return urlMatch[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Upload-from-file state
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import-from-Google-Doc state
  const [docUrl, setDocUrl] = useState('');

  // Starter templates (MSA, SOW)
  const [starters, setStarters] = useState<StarterTemplate[]>([]);
  const [importingStarter, setImportingStarter] = useState<string | null>(null);

  async function refresh() {
    try {
      const { templates } = await api.listTemplates();
      setTemplates(templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }

  useEffect(() => {
    refresh();
    api.listStarters()
      .then(({ starters }) => setStarters(starters))
      .catch(() => { /* non-blocking */ });
  }, []);

  // Slug -> already-imported flag (cheap heuristic by name match).
  const importedSlugs = new Set(
    (templates ?? [])
      .map((t) => starters.find((s) => s.name === t.name)?.slug)
      .filter((s): s is string => !!s),
  );

  async function onImportStarter(slug: string) {
    setError(null);
    setImportingStarter(slug);
    try {
      const { template } = await api.importStarter(slug);
      router.push(`/templates/${template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportingStarter(null);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const { template } = await api.createTemplate({ name: newName.trim() });
      router.push(`/templates/${template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    await api.deleteTemplate(id);
    await refresh();
  }

  async function importFile(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`File is too large (${Math.round(file.size / 1024 / 1024)}MB). Limit is 20MB.`);
      return;
    }
    setImporting(true);
    setImportStatus(`Reading ${file.name}…`);
    try {
      setImportStatus('Generalizing with AI…');
      const { template, detectedVariables } = await api.createTemplateFromFile(file);
      setImportStatus(
        `Created template with ${detectedVariables.length} variable${
          detectedVariables.length === 1 ? '' : 's'
        }. Opening…`,
      );
      router.push(`/templates/${template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setImportStatus(null);
    } finally {
      setImporting(false);
    }
  }

  async function importGoogleDoc(e: React.FormEvent) {
    e.preventDefault();
    const fileId = parseGoogleDocId(docUrl);
    if (!fileId) {
      setError('That doesn\'t look like a Google Doc URL or ID.');
      return;
    }
    setError(null);
    setImporting(true);
    setImportStatus('Fetching the Doc and generalizing…');
    try {
      const { template } = await api.createTemplateFromGoogleDoc({
        sourceType: 'google-doc',
        fileId,
      });
      router.push(`/templates/${template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setImportStatus(null);
    } finally {
      setImporting(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) importFile(file);
  }

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <p className="text-slate-600 mt-1">
          Build reusable contract templates with sections and variable fields.
        </p>
      </div>

      {/* ---- Starter templates ---- */}
      {starters.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-slate-800">
              Starter templates
            </h2>
            <span className="text-xs text-slate-500">
              One click · preserves formatting · already has{' '}
              <code className="rounded bg-slate-200 px-1 text-[0.7rem]">{`{{variables}}`}</code>
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {starters.map((s) => {
              const already = importedSlugs.has(s.slug);
              const busy = importingStarter === s.slug;
              return (
                <div
                  key={s.slug}
                  className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col justify-between"
                >
                  <div>
                    <h3 className="font-medium text-slate-800">{s.name}</h3>
                    <p className="text-sm text-slate-600 mt-1">{s.description}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {already && (
                      <span className="text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-0.5">
                        Already imported
                      </span>
                    )}
                    <button
                      onClick={() => onImportStarter(s.slug)}
                      disabled={busy}
                      className="ml-auto rounded-md bg-brand text-white px-3 py-1.5 text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
                    >
                      {busy
                        ? 'Importing…'
                        : already
                          ? 'Import another copy'
                          : 'Import to my workspace'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500">
            Starters are imported as Google Docs — formatting (headings, tables, bullets, bold) is preserved.
            Add your company logo or letterhead to the imported Doc once; every contract generated from that
            template will include it automatically.
          </p>
        </div>
      )}

      <form onSubmit={onCreate} className="flex gap-2">
        <input
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          placeholder="Template name (e.g. Statement of Work)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          disabled={creating || importing}
        />
        <button
          type="submit"
          disabled={creating || importing || !newName.trim()}
          className="rounded-md bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'New blank template'}
        </button>
      </form>

      {/* ---- Generate from existing contract ---- */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            Or generate from an existing contract
          </h2>
          <span className="text-xs text-slate-500">PDF · DOCX · Google Doc</span>
        </div>
        <p className="text-sm text-slate-600 mt-1">
          Upload a signed or sample contract and the AI will rewrite it as a reusable
          template, replacing names, dates, and dollar amounts with{' '}
          <code className="rounded bg-slate-200 px-1 text-[0.75rem]">{`{{variables}}`}</code>.
        </p>

        <div className="grid gap-4 mt-4 sm:grid-cols-2">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => !importing && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-6 text-center text-sm transition cursor-pointer ${
              dragActive
                ? 'border-brand bg-white'
                : 'border-slate-300 bg-white hover:border-brand-dark'
            } ${importing ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <span className="font-medium text-slate-700">
              Drop a PDF or DOCX here
            </span>
            <span className="text-xs text-slate-500 mt-1">
              or click to choose a file (max 20MB)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFile(f);
                e.target.value = ''; // allow re-selecting the same file
              }}
            />
          </div>

          {/* Google Doc URL */}
          <form onSubmit={importGoogleDoc} className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-4">
            <label className="text-sm font-medium text-slate-700">
              Import a Google Doc
            </label>
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="https://docs.google.com/document/d/…/edit"
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              disabled={importing}
            />
            <p className="text-xs text-slate-500">
              Paste a link to a Doc you've previously opened with this app.
            </p>
            <button
              type="submit"
              disabled={importing || !docUrl.trim()}
              className="self-start rounded-md border border-brand text-brand px-3 py-1.5 text-sm font-medium hover:bg-brand hover:text-white disabled:opacity-50"
            >
              Import Doc
            </button>
          </form>
        </div>

        {importStatus && (
          <p className="text-sm text-slate-600 mt-3 italic">{importStatus}</p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {templates === null ? (
        <p className="text-slate-500">Loading…</p>
      ) : templates.length === 0 ? (
        <p className="text-slate-500">No templates yet. Create one above to get started.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between p-4">
              <div>
                <Link href={`/templates/${t.id}`} className="font-medium hover:text-brand">
                  {t.name}
                </Link>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.sections.length} section{t.sections.length === 1 ? '' : 's'} ·{' '}
                  {t.variables.length} field{t.variables.length === 1 ? '' : 's'} · updated{' '}
                  {new Date(t.updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {t.driveFileId && (
                  <a
                    href={`https://docs.google.com/document/d/${t.driveFileId}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-slate-500 hover:text-slate-800"
                  >
                    Open in Docs ↗
                  </a>
                )}
                <button
                  onClick={() => onDelete(t.id)}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
