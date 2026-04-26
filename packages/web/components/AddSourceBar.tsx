'use client';

// AddSourceBar — unified import input with source chips

import { useState } from 'react';
import { api } from '@/lib/api';
import SourceChip from './SourceChip';

interface AddSourceBarProps {
  chips: { id: string; label: string; type: string }[];
  onImported: (result: { fields: Record<string, string>; source: string; label: string }) => void;
  onRemoveChip: (id: string) => void;
  onError: (message: string) => void;
}

export default function AddSourceBar({ chips, onImported, onRemoveChip, onError }: AddSourceBarProps) {
  const [input, setInput] = useState('');
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!input.trim()) return;
    setImporting(true);
    try {
      const result = await api.importDetect(input);
      const hasFields = Object.keys(result.fields).length > 0;
      if (!hasFields) {
        onError("Couldn't detect source — fields not filled. Fill manually.");
      }
      onImported({ fields: result.fields as Record<string, string>, source: result.source, label: result.label });
      setInput('');
    } catch (err: any) {
      onError('Import failed: ' + (err.message || 'Unknown error'));
    } finally {
      setImporting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleImport();
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-8">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Add Source</h2>
      <p className="text-sm text-slate-500 mb-4">
        Paste a HubSpot deal URL, Google Drive doc link, or raw meeting notes
      </p>
      <div className="flex flex-col gap-3">
        <textarea
          placeholder="Paste anything — HubSpot URL, Drive link, or text..."
          className="w-full p-3 border border-slate-200 rounded-lg min-h-[80px] text-sm resize-y focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          onClick={handleImport}
          disabled={importing || !input.trim()}
          className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-semibold px-5 py-2.5 rounded-lg self-end transition-colors text-sm"
        >
          {importing ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Importing...
            </span>
          ) : (
            'Add Source ↵'
          )}
        </button>
      </div>

      {/* Source Chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {chips.map(chip => (
            <SourceChip key={chip.id} chip={chip} onRemove={() => onRemoveChip(chip.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
