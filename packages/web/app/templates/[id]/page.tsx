'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '@/lib/api';
import type { Template, TemplateSection, TemplateVariable } from '@cg/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function labelToName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function withIds(fields: TemplateVariable[]): TemplateVariable[] {
  return fields.map((f) => ({ ...f, id: f.id ?? uid() }));
}

const PencilIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Default sections loaded for every new template
// ---------------------------------------------------------------------------
type Preset = { title: string; required: boolean; fields: TemplateVariable[] };

const PRESETS: Preset[] = [
  {
    title: 'Document Header',
    required: true,
    fields: [
      { name: 'document_title', label: 'Document Title', type: 'text', required: true },
      { name: 'document_date', label: 'Document Date', type: 'date', required: true },
    ],
  },
  {
    title: 'Client Information',
    required: true,
    fields: [
      { name: 'client_name', label: 'Client Name', type: 'text', required: true },
      { name: 'client_address_street', label: 'Street Address', type: 'text' },
      { name: 'client_address_city_state_zip', label: 'City, State, ZIP', type: 'text' },
      { name: 'client_contact_1_name', label: 'Primary Contact Name', type: 'text' },
      { name: 'client_contact_1_title', label: 'Primary Contact Title', type: 'text' },
      { name: 'client_contact_2_name', label: 'Secondary Contact Name', type: 'text' },
      { name: 'client_contact_2_title', label: 'Secondary Contact Title', type: 'text' },
    ],
  },
  {
    title: 'Provider Information',
    required: true,
    fields: [
      { name: 'provider_contact_name', label: 'Contact Name', type: 'text', required: true },
      { name: 'provider_contact_title', label: 'Title', type: 'text' },
      { name: 'provider_contact_phone', label: 'Phone', type: 'text' },
      { name: 'provider_contact_email', label: 'Email', type: 'email' },
    ],
  },
  {
    title: 'Services',
    required: true,
    fields: [
      { name: 'service_name', label: 'Service Name', type: 'text', required: true },
      { name: 'agreement_date', label: 'Agreement Date', type: 'date', required: true },
      { name: 'service_date', label: 'Service Date', type: 'date' },
      { name: 'service_start_time', label: 'Start Time', type: 'text' },
      { name: 'service_end_time', label: 'End Time', type: 'text' },
      { name: 'num_facilitators', label: 'Number of Facilitators', type: 'number' },
      { name: 'service_duration_hours', label: 'Duration (hours)', type: 'number' },
    ],
  },
  {
    title: 'Location & Schedule',
    required: false,
    fields: [
      { name: 'service_location_city', label: 'City', type: 'text', required: true },
      { name: 'venue_description', label: 'Venue Description', type: 'text' },
      { name: 'venue_seating_capacity', label: 'Venue Seating Capacity', type: 'number' },
      { name: 'num_breakout_spaces', label: 'Breakout Spaces', type: 'number' },
    ],
  },
  {
    title: 'Fees & Payment',
    required: true,
    fields: [
      { name: 'list_price', label: 'List Price', type: 'number', required: true },
      { name: 'discount_label', label: 'Discount Description', type: 'text' },
      { name: 'discount_amount', label: 'Discount Amount', type: 'number' },
      { name: 'total_fee', label: 'Total Fee', type: 'number', required: true },
      { name: 'deposit_percentage', label: 'Deposit Percentage (%)', type: 'number' },
      { name: 'payment_terms_days', label: 'Payment Terms (days)', type: 'number' },
    ],
  },
  {
    title: 'Assumptions',
    required: false,
    fields: [
      { name: 'change_fee_percentage', label: 'Change Fee (%)', type: 'number' },
      { name: 'change_notice_days', label: 'Change Notice Period (days)', type: 'number' },
      { name: 'completion_date', label: 'Completion Date', type: 'date' },
    ],
  },
  {
    title: 'Signatory',
    required: true,
    fields: [
      { name: 'provider_signatory_name', label: 'Provider Signatory Name', type: 'text', required: true },
      { name: 'provider_signatory_title', label: 'Provider Signatory Title', type: 'text' },
      { name: 'client_signatory_name', label: 'Client Signatory Name', type: 'text', required: true },
      { name: 'client_signatory_title', label: 'Client Signatory Title', type: 'text' },
    ],
  },
];

function buildDefaultSections(): TemplateSection[] {
  return PRESETS.map((p) => ({
    id: uid(),
    title: p.title,
    required: p.required,
    fields: withIds(p.fields),
  }));
}

// ---------------------------------------------------------------------------
// InlineEdit — shows text with a pencil icon; clicking enters edit mode
// ---------------------------------------------------------------------------
function InlineEdit({
  value,
  onChange,
  className = '',
  inputClassName = '',
  placeholder = 'Untitled',
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function activate() {
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commit() {
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        className={`border-b border-brand bg-transparent focus:outline-none ${inputClassName}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') commit(); }}
      />
    );
  }

  return (
    <span className={`group inline-flex items-center gap-1.5 ${className}`}>
      <span className={value ? '' : 'text-slate-400 italic'}>{value || placeholder}</span>
      <button
        onClick={activate}
        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-brand transition-opacity"
        title="Edit"
        tabIndex={-1}
      >
        <PencilIcon />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// SortableFieldRow
// ---------------------------------------------------------------------------
function SortableFieldRow({
  field,
  onChange,
  onDelete,
}: {
  field: TemplateVariable;
  onChange: (updated: TemplateVariable) => void;
  onDelete: () => void;
}) {
  const fieldId = field.id!;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: fieldId });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const [expanded, setExpanded] = useState(false);

  return (
    <div ref={setNodeRef} style={style} className="rounded border border-slate-200 bg-white">
      {/* Collapsed row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-slate-300 hover:text-slate-500 select-none"
          title="Drag to reorder"
        >
          ⠿
        </span>

        {/* Label with inline edit */}
        <span className="flex-1 text-sm font-medium text-slate-800 truncate">
          <InlineEdit
            value={field.label ?? ''}
            placeholder="Untitled field"
            onChange={(label) =>
              onChange({ ...field, label, name: labelToName(label) || field.name })
            }
          />
        </span>

        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 shrink-0">
          {field.type ?? 'text'}
        </span>
        {field.required && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600 shrink-0">
            required
          </span>
        )}

        {/* Expand for more options */}
        <button
          onClick={() => setExpanded((x) => !x)}
          className="shrink-0 text-slate-400 hover:text-slate-700 text-xs px-1"
          title={expanded ? 'Collapse' : 'More options'}
        >
          {expanded ? '▴' : '▾'}
        </button>

        <button
          onClick={onDelete}
          className="shrink-0 text-slate-300 hover:text-red-500 text-xl leading-none"
          title="Remove field"
        >
          ×
        </button>
      </div>

      {/* Expanded: type, name, default, required */}
      {expanded && (
        <div className="border-t border-slate-100 px-3 py-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Field name <span className="font-normal text-slate-400">(used in template)</span>
            </label>
            <input
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-mono text-slate-600 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-brand"
              value={field.name}
              onChange={(e) => onChange({ ...field, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
            <select
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              value={field.type ?? 'text'}
              onChange={(e) => onChange({ ...field, type: e.target.value as TemplateVariable['type'] })}
            >
              <option value="text">Text</option>
              <option value="date">Date</option>
              <option value="number">Number</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Default value</label>
            <input
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              value={field.defaultValue ?? ''}
              placeholder="Optional"
              onChange={(e) => onChange({ ...field, defaultValue: e.target.value })}
            />
          </div>
          <div className="flex items-end pb-1.5">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-brand focus:ring-brand"
                checked={field.required ?? false}
                onChange={(e) => onChange({ ...field, required: e.target.checked })}
              />
              Required field
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionCard — owns its own DnD context for fields
// ---------------------------------------------------------------------------
function SectionCard({
  section,
  dragHandleProps,
  onChange,
  onDelete,
}: {
  section: TemplateSection;
  dragHandleProps: Record<string, unknown>;
  onChange: (updated: TemplateSection) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(true);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleFieldDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = section.fields.findIndex((f) => f.id === active.id);
    const newIdx = section.fields.findIndex((f) => f.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    onChange({ ...section, fields: arrayMove(section.fields, oldIdx, newIdx) });
  }

  function updateField(index: number, updated: TemplateVariable) {
    onChange({ ...section, fields: section.fields.map((f, i) => (i === index ? updated : f)) });
  }

  function deleteField(index: number) {
    onChange({ ...section, fields: section.fields.filter((_, i) => i !== index) });
  }

  function addField() {
    const blank: TemplateVariable = {
      id: uid(),
      name: `field_${uid()}`,
      label: 'New field',
      type: 'text',
      required: false,
    };
    onChange({ ...section, fields: [...section.fields, blank] });
  }

  const fieldIds = section.fields.map((f) => f.id!);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 py-3 bg-white border-b border-slate-200">
        <span
          {...dragHandleProps}
          className="cursor-grab touch-none text-slate-300 hover:text-slate-500 select-none shrink-0"
          title="Drag to reorder section"
        >
          ⠿
        </span>

        <button
          onClick={() => setOpen((x) => !x)}
          className="text-slate-400 hover:text-slate-600 shrink-0 text-xs w-3"
        >
          {open ? '▾' : '▸'}
        </button>

        {/* Editable section title */}
        <span className="flex-1 min-w-0">
          <InlineEdit
            value={section.title}
            placeholder="Section title"
            className="text-sm font-semibold text-slate-800"
            inputClassName="text-sm font-semibold text-slate-800 w-full"
            onChange={(title) => onChange({ ...section, title })}
          />
        </span>

        <span className="text-xs text-slate-400 shrink-0">
          {section.fields.length} field{section.fields.length !== 1 ? 's' : ''}
        </span>

        <button
          onClick={() => onChange({ ...section, required: !section.required })}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors shrink-0 ${
            section.required
              ? 'bg-brand/10 text-brand border-brand/20'
              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
          }`}
        >
          {section.required ? 'Required' : 'Optional'}
        </button>

        <button
          onClick={onDelete}
          className="shrink-0 text-slate-300 hover:text-red-500 text-xl leading-none ml-1"
          title="Delete section"
        >
          ×
        </button>
      </div>

      {/* Fields */}
      {open && (
        <div className="p-3 space-y-2">
          {section.fields.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-3">
              No fields yet — add one below.
            </p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFieldDragEnd}>
            <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
              {section.fields.map((field, i) => (
                <SortableFieldRow
                  key={field.id}
                  field={field}
                  onChange={(updated) => updateField(i, updated)}
                  onDelete={() => deleteField(i)}
                />
              ))}
            </SortableContext>
          </DndContext>
          <button
            onClick={addField}
            className="w-full rounded border border-dashed border-slate-300 py-1.5 text-xs text-slate-500 hover:border-brand hover:text-brand transition-colors"
          >
            + Add field
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableSectionWrapper
// ---------------------------------------------------------------------------
function SortableSectionWrapper({
  section,
  onChange,
  onDelete,
}: {
  section: TemplateSection;
  onChange: (updated: TemplateSection) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SectionCard
        section={section}
        dragHandleProps={{ ...attributes, ...listeners }}
        onChange={onChange}
        onDelete={onDelete}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function TemplateBuilderPage() {
  const { id } = useParams<{ id: string }>();

  const [template, setTemplate] = useState<Template | null>(null);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    api
      .getTemplate(id)
      .then(({ template }) => {
        setTemplate(template);
        const initial =
          template.sections.length > 0
            ? template.sections.map((s) => ({ ...s, fields: withIds(s.fields) }))
            : buildDefaultSections();
        setSections(initial);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [id]);

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections((prev) => {
      const oldIdx = prev.findIndex((s) => s.id === active.id);
      const newIdx = prev.findIndex((s) => s.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setSaveStatus('idle');
    setError(null);
    try {
      const { template: updated } = await api.updateTemplateSections(id, sections);
      setTemplate(updated);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setSaveStatus('error');
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function updateSection(index: number, updated: TemplateSection) {
    setSections((prev) => prev.map((s, i) => (i === index ? updated : s)));
  }

  function deleteSection(index: number) {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }

  function addBlankSection() {
    setSections((prev) => [
      ...prev,
      { id: uid(), title: 'New section', required: false, fields: [] },
    ]);
  }

  const totalFields = sections.reduce((n, s) => n + s.fields.length, 0);

  if (!template) {
    return (
      <p className={error ? 'text-red-600' : 'text-slate-500'}>
        {error ?? 'Loading…'}
      </p>
    );
  }

  const sectionIds = sections.map((s) => s.id);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/templates" className="text-slate-400 hover:text-slate-600 shrink-0 text-sm">
            ← Templates
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-xl font-semibold tracking-tight truncate">{template.name}</h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {saveStatus === 'saved' && (
            <span className="text-xs text-green-600 font-medium">✓ Saved</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-red-600 font-medium">Save failed</span>
          )}
          {template.driveFileId && (
            <a
              href={`https://docs.google.com/document/d/${template.driveFileId}/edit`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              Open in Docs ↗
            </a>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 shadow-sm"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm">
        <span className="text-slate-600">
          <strong className="text-slate-900">{sections.length}</strong> section{sections.length !== 1 ? 's' : ''}
        </span>
        <span className="text-slate-600">
          <strong className="text-slate-900">{totalFields}</strong> field{totalFields !== 1 ? 's' : ''}
        </span>
        <span className="text-slate-600">
          <strong className="text-slate-900">{sections.filter((s) => s.required).length}</strong> required
        </span>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Section list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
        <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {sections.map((section, i) => (
              <SortableSectionWrapper
                key={section.id}
                section={section}
                onChange={(updated) => updateSection(i, updated)}
                onDelete={() => deleteSection(i)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Footer toolbar — single action */}
      <div className="pt-1">
        <button
          onClick={addBlankSection}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 shadow-sm"
        >
          + Add section
        </button>
      </div>
    </div>
  );
}
