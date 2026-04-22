'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface AISidebarProps {
  driveFileId: string;
  contractId?: string;
  onAfterEdit?: () => void;
}

/**
 * Sidebar that runs whole-document AI edits. The web app can't read the user's
 * current Docs selection (that's why the add-on exists), so the web-app version
 * operates on the whole doc or on named anchors the user inserts.
 *
 * A better v2 would: (a) let the user paste a snippet they want edited,
 * (b) show a side-by-side diff before applying, (c) stream the completion.
 */
export function AISidebar({ driveFileId, contractId, onAfterEdit }: AISidebarProps) {
  const [instruction, setInstruction] = useState('');
  const [working, setWorking] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!instruction.trim()) return;
    setWorking(true);
    setError(null);
    try {
      const result = await api.aiEdit({
        driveFileId,
        contractId,
        instruction: instruction.trim(),
      });
      setLastResult(result.editedText.slice(0, 400));
      setInstruction('');
      onAfterEdit?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI edit failed');
    } finally {
      setWorking(false);
    }
  }

  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-4 space-y-4 h-fit sticky top-4">
      <div>
        <h2 className="font-medium text-sm">AI assistant</h2>
        <p className="text-xs text-slate-500 mt-1">
          Ask Claude to rewrite the whole contract. For clause-level edits, use the
          Workspace add-on inside Docs.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-2">
        <textarea
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm h-28 resize-none"
          placeholder="e.g. Make the indemnification clause mutual and cap liability at fees paid in the last 12 months."
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={working}
        />
        <button
          type="submit"
          disabled={working || !instruction.trim()}
          className="w-full rounded-md bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
        >
          {working ? 'Editing…' : 'Apply AI edit'}
        </button>
      </form>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {lastResult && (
        <div className="text-xs text-slate-600">
          <p className="font-medium text-slate-700 mb-1">Last edit preview</p>
          <p className="whitespace-pre-wrap line-clamp-6">{lastResult}…</p>
        </div>
      )}
    </aside>
  );
}
