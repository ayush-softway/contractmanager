'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Template {
  slug: string;
  label: string;
  description: string;
  industry?: string;
}

const TEMPLATES: Template[] = [
  {
    slug: 'nda',
    label: 'NDA',
    description: 'Mutual non-disclosure agreement for new client conversations.',
    industry: 'All',
  },
  {
    slug: 'msa-sow',
    label: 'MSA + SOW',
    description: 'Full master services agreement with statement of work for new clients.',
    industry: 'All',
  },
  {
    slug: 'sow-standalone',
    label: 'Standalone SOW',
    description: 'Statement of work for repeat clients with an MSA on file.',
    industry: 'All',
  },
  {
    slug: 'change-order',
    label: 'Change Order',
    description: 'Scope or pricing update to an existing SOW.',
    industry: 'All',
  },
  {
    slug: 'employment-contract',
    label: 'Employment Contract',
    description: 'Standard employment agreement for new hires.',
    industry: 'All',
  },
];

const CONTRACT_TYPES = ['All Contract Types', 'Services', 'HR', 'NDAs'];

interface Props {
  onClose: () => void;
}

export default function TemplateGallery({ onClose }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All Contract Types');

  const filtered = TEMPLATES.filter((t) =>
    t.label.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase()),
  );

  function selectTemplate(slug: string) {
    onClose();
    router.push(`/contracts/generate?template=${slug}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Template Gallery</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-3">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-700"
          >
            {CONTRACT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="p-6 grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
          {filtered.map((template) => (
            <button
              key={template.slug}
              onClick={() => selectTemplate(template.slug)}
              className="text-left p-4 border border-slate-200 rounded-xl hover:border-teal-400 hover:bg-teal-50 transition-colors group"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-semibold text-slate-900 group-hover:text-teal-700">
                  {template.label}
                </span>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-teal-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <p className="text-xs text-slate-500 group-hover:text-slate-600 leading-relaxed">
                {template.description}
              </p>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-2 text-center text-sm text-slate-400 py-8">No templates match your search.</p>
          )}
        </div>
      </div>
    </div>
  );
}
