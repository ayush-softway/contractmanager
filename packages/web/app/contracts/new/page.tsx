'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { ContractDraft, Template, TemplateVariable } from '@cg/shared';

/**
 * New-contract wizard.
 *
 * Two main steps:
 *   1. "pick"  → choose a category filter (MSA / SOW / Other) and a template,
 *                plus name the contract. Clicking Continue saves a draft row.
 *   2. "fill"  → fill in all variables (grouped by section). The user can
 *                Save draft at any time (navigates back to /contracts with
 *                the draft persisted) or Generate contract to finalize —
 *                which creates the real Drive doc and navigates to
 *                /contracts/[id].
 *
 * Supports ?draftId=<id> to resume directly into step 2.
 */

type Category = 'all' | 'MSA' | 'SOW' | 'Other';

const CATEGORIES: { key: Category; label: string; description: string }[] = [
  { key: 'all', label: 'All', description: 'Every template in your workspace' },
  { key: 'MSA', label: 'MSA', description: 'Master Services Agreement' },
  { key: 'SOW', label: 'SOW', description: 'Statement of Work' },
  { key: 'Other', label: 'Other', description: 'Custom or uploaded templates' },
];

/** Classify a template from its name so we can offer category filters without
 *  adding a DB column. */
function categorize(tmpl: Template): Exclude<Category, 'all'> {
  const n = tmpl.name.toLowerCase();
  if (n.includes('msa') || n.includes('master services')) return 'MSA';
  if (n.includes('sow') || n.includes('statement of work')) return 'SOW';
  return 'Other';
}

function flattenVariables(tmpl: Template): TemplateVariable[] {
  if (tmpl.sections?.length) {
    const seen = new Set<string>();
    const out: TemplateVariable[] = [];
    for (const s of tmpl.sections) {
      for (const f of s.fields) {
        if (seen.has(f.name)) continue;
        seen.add(f.name);
        out.push(f);
      }
    }
    return out;
  }
  return tmpl.variables ?? [];
}

export default function NewContractPage() {
  // `useSearchParams` (used inside the wizard to resume a ?draftId=…) requires a
  // Suspense boundary during static prerender in Next.js 14, otherwise the
  // production build fails. Wrap the wizard so the page can be statically shelled.
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
      <NewContractWizard />
    </Suspense>
  );
}

function NewContractWizard() {
  const router = useRouter();
  const search = useSearchParams();
  const draftIdParam = search.get('draftId');

  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'pick' | 'fill'>('pick');

  // Step 1 state
  const [category, setCategory] = useState<Category>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [title, setTitle] = useState<string>('');

  // Step 2 / shared state
  const [draftId, setDraftId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [generating, setGenerating] = useState(false);

  // Debounce handle for auto-save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load templates once.
  useEffect(() => {
    api
      .listTemplates()
      .then(({ templates }) => setTemplates(templates))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load templates'),
      );
  }, []);

  // If ?draftId was provided, hydrate and jump to step 2.
  useEffect(() => {
    if (!draftIdParam) return;
    (async () => {
      try {
        const { draft } = await api.getContractDraft(draftIdParam);
        setDraftId(draft.id);
        setSelectedTemplateId(draft.templateId);
        setTitle(draft.title);
        setValues(draft.variableValues ?? {});
        setStep('fill');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load draft');
      }
    })();
  }, [draftIdParam]);

  const selectedTemplate = useMemo(
    () => templates?.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    if (category === 'all') return templates;
    return templates.filter((t) => categorize(t) === category);
  }, [templates, category]);

  // When a template is first picked, seed empty values for its fields so the
  // form renders even if the user hasn't typed anything yet.
  useEffect(() => {
    if (!selectedTemplate) return;
    const fields = flattenVariables(selectedTemplate);
    setValues((prev) => {
      const next = { ...prev };
      for (const f of fields) if (!(f.name in next)) next[f.name] = f.defaultValue ?? '';
      return next;
    });
  }, [selectedTemplate]);

  // -----------------------------------------------------------------------
  // Draft persistence
  // -----------------------------------------------------------------------

  /** Persist the current step-1 picks as a draft row. Returns its id. */
  const createDraft = useCallback(async (): Promise<string> => {
    if (!selectedTemplateId || !title.trim()) {
      throw new Error('Pick a template and name your contract first');
    }
    const { draft } = await api.createContractDraft({
      templateId: selectedTemplateId,
      title: title.trim(),
      variableValues: values,
    });
    setDraftId(draft.id);
    setSavedAt(new Date());
    return draft.id;
  }, [selectedTemplateId, title, values]);

  const patchDraft = useCallback(
    async (patch: { title?: string; variableValues?: Record<string, string> }) => {
      if (!draftId) return;
      setSaving(true);
      try {
        const { draft } = await api.updateContractDraft(draftId, patch);
        setSavedAt(new Date(draft.updatedAt));
      } finally {
        setSaving(false);
      }
    },
    [draftId],
  );

  /** Debounced auto-save on any field change in step 2. */
  const scheduleSave = useCallback(
    (next: Record<string, string>, nextTitle?: string) => {
      if (!draftId) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void patchDraft({ variableValues: next, title: nextTitle });
      }, 600);
    },
    [draftId, patchDraft],
  );

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  async function handleContinue() {
    try {
      if (!draftId) await createDraft();
      else await patchDraft({ title: title.trim(), variableValues: values });
      setStep('fill');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft');
    }
  }

  async function handleSaveAndExit() {
    try {
      if (!draftId) await createDraft();
      else await patchDraft({ title: title.trim(), variableValues: values });
      router.push('/contracts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft');
    }
  }

  async function handleGenerate() {
    if (!draftId) return;
    setGenerating(true);
    setError(null);
    try {
      // Flush any pending edits first so the finalize uses the latest values.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      await patchDraft({ title: title.trim(), variableValues: values });
      const { contract } = await api.finalizeContractDraft(draftId);
      router.push(`/contracts/${contract.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate contract');
      setGenerating(false);
    }
  }

  function setValue(name: string, v: string) {
    const next = { ...values, [name]: v };
    setValues(next);
    scheduleSave(next, title);
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const fields = selectedTemplate ? flattenVariables(selectedTemplate) : [];
  const requiredMissing = fields
    .filter((f) => f.required)
    .filter((f) => !(values[f.name] ?? '').trim()).length;

  return (
    <section className="space-y-6">
      {/* ---------------------------- Header ---------------------------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New contract</h1>
          <p className="mt-1 text-sm text-slate-600">
            {step === 'pick'
              ? 'Pick a template and name your document.'
              : `Fill in the details for “${title}”. Your progress saves automatically.`}
          </p>
        </div>
        <Link
          href="/contracts"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          Cancel
        </Link>
      </div>

      {/* Stepper */}
      <ol className="flex items-center gap-3 text-sm">
        <li
          className={`flex items-center gap-2 ${
            step === 'pick' ? 'text-slate-900' : 'text-slate-500'
          }`}
        >
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
              step === 'pick'
                ? 'bg-brand text-white'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            1
          </span>
          Template &amp; name
        </li>
        <span className="h-px w-8 bg-slate-300" />
        <li
          className={`flex items-center gap-2 ${
            step === 'fill' ? 'text-slate-900' : 'text-slate-500'
          }`}
        >
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
              step === 'fill'
                ? 'bg-brand text-white'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            2
          </span>
          Fill in details
        </li>
      </ol>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ---------------------------- Step 1 ---------------------------- */}
      {step === 'pick' && (
        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Document type
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCategory(c.key)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    category === c.key
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                  title={c.description}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Template
            </label>
            {templates === null ? (
              <p className="text-sm text-slate-500">Loading templates…</p>
            ) : filteredTemplates.length === 0 ? (
              <p className="text-sm text-slate-500">
                No templates in this category.{' '}
                <Link href="/templates" className="text-brand hover:underline">
                  Import or create one
                </Link>
                .
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTemplates.map((t) => {
                  const selected = t.id === selectedTemplateId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={`rounded-lg border p-4 text-left transition ${
                        selected
                          ? 'border-brand bg-brand/5 ring-1 ring-brand'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900">{t.name}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                          {categorize(t)}
                        </span>
                      </div>
                      {t.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                          {t.description}
                        </p>
                      )}
                      <p className="mt-2 text-[11px] text-slate-400">
                        {flattenVariables(t).length} fields
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="title"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Document name
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Acme Co. — MSA 2026"
              className="w-full max-w-lg rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleContinue}
              disabled={!selectedTemplateId || !title.trim()}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
            <span className="text-xs text-slate-400">
              Your draft is saved when you continue — you can return any time.
            </span>
          </div>
        </div>
      )}

      {/* ---------------------------- Step 2 ---------------------------- */}
      {step === 'fill' && selectedTemplate && (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Template
                </div>
                <div className="font-medium">{selectedTemplate.name}</div>
              </div>
              <button
                type="button"
                onClick={() => setStep('pick')}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                Change template
              </button>
            </div>
            <div className="mt-3">
              <label
                htmlFor="title-fill"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                Document name
              </label>
              <input
                id="title-fill"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (draftId)
                    scheduleSave(values, e.target.value);
                }}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          {/* Section-grouped fields */}
          {selectedTemplate.sections && selectedTemplate.sections.length > 0 ? (
            selectedTemplate.sections.map((section) => (
              <div
                key={section.id}
                className="rounded-lg border border-slate-200 bg-white p-5"
              >
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="font-medium text-slate-900">{section.title}</h3>
                  {section.required && (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-red-600">
                      Required
                    </span>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {section.fields.map((f) => (
                    <FieldInput
                      key={`${section.id}-${f.name}`}
                      field={f}
                      value={values[f.name] ?? ''}
                      onChange={(v) => setValue(f.name, v)}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="mb-3 font-medium">Fields</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map((f) => (
                  <FieldInput
                    key={f.name}
                    field={f}
                    value={values[f.name] ?? ''}
                    onChange={(v) => setValue(f.name, v)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
            <div className="text-xs text-slate-500">
              {saving
                ? 'Saving…'
                : savedAt
                  ? `Saved ${savedAt.toLocaleTimeString()}`
                  : 'Changes auto-save as you type'}
              {requiredMissing > 0 && (
                <span className="ml-3 text-amber-600">
                  {requiredMissing} required field{requiredMissing === 1 ? '' : 's'} still empty
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveAndExit}
                disabled={saving || generating}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Save &amp; exit
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || saving}
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
              >
                {generating ? 'Generating…' : 'Generate contract'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// --------------------------------------------------------------------------
// Single field input — picks an appropriate <input type> per variable type.
// --------------------------------------------------------------------------
function FieldInput({
  field,
  value,
  onChange,
}: {
  field: TemplateVariable;
  value: string;
  onChange: (v: string) => void;
}) {
  const htmlType =
    field.type === 'date'
      ? 'date'
      : field.type === 'number'
        ? 'number'
        : field.type === 'email'
          ? 'email'
          : 'text';
  const label = field.label ?? field.name;
  return (
    <label className="block text-sm">
      <span className="mb-1 flex items-center gap-1 text-slate-700">
        {label}
        {field.required && <span className="text-red-500">*</span>}
      </span>
      <input
        type={htmlType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.defaultValue ?? ''}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />
      <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
        {`{{${field.name}}}`}
      </span>
    </label>
  );
}
