'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

type Tab = 'hubspot' | 'drive' | 'text' | 'file';

interface Props {
  onImported: (result: { fields: Record<string, string>; source: string; label: string }) => void;
  onClose: () => void;
  onError: (message: string) => void;
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function AddSourceModal({ onImported, onClose, onError }: Props) {
  const [tab, setTab] = useState<Tab>('hubspot');

  // HubSpot state
  const [hsQuery, setHsQuery] = useState('');
  const debouncedQuery = useDebounce(hsQuery, 300);
  const [hsResults, setHsResults] = useState<{ dealId: string; dealName: string; amount: string; stage: string }[]>([]);
  const [hsLoading, setHsLoading] = useState(false);
  const [hsImporting, setHsImporting] = useState<string | null>(null);

  // Drive state
  const [driveFiles, setDriveFiles] = useState<{ id: string; name: string; modifiedTime: string }[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveImporting, setDriveImporting] = useState<string | null>(null);
  const [driveError, setDriveError] = useState('');

  // Text state
  const [textInput, setTextInput] = useState('');
  const [textImporting, setTextImporting] = useState(false);

  // File upload state
  const [fileDragging, setFileDragging] = useState(false);
  const [fileImporting, setFileImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search HubSpot deals
  useEffect(() => {
    if (tab !== 'hubspot' || !debouncedQuery.trim()) {
      setHsResults([]);
      return;
    }
    setHsLoading(true);
    api.searchHubSpotDeals(debouncedQuery)
      .then((r) => setHsResults(r.deals))
      .catch(() => setHsResults([]))
      .finally(() => setHsLoading(false));
  }, [debouncedQuery, tab]);

  // Load Drive files when Drive tab opens
  useEffect(() => {
    if (tab !== 'drive') return;
    setDriveLoading(true);
    setDriveError('');
    api.listDriveFiles()
      .then((r) => setDriveFiles(r.files))
      .catch((err: any) => {
        if (err.message?.includes('401') || err.message?.includes('403')) {
          setDriveError('Sign in with Google to browse your Drive files.');
        } else {
          setDriveError('Could not load Drive files.');
        }
      })
      .finally(() => setDriveLoading(false));
  }, [tab]);

  async function importHubSpotDeal(dealId: string, dealName: string) {
    setHsImporting(dealId);
    try {
      const result = await api.importDetect(`https://app.hubspot.com/contacts/0/deal/${dealId}`);
      onImported({ fields: result.fields as Record<string, string>, source: result.source, label: result.label || dealName });
      onClose();
    } catch (err: any) {
      onError('HubSpot import failed: ' + (err.message || 'Unknown error'));
    } finally {
      setHsImporting(null);
    }
  }

  async function importDriveFile(fileId: string, fileName: string) {
    setDriveImporting(fileId);
    try {
      const result = await api.importFromDriveFile(fileId);
      const hasFields = Object.keys(result.fields).length > 0;
      if (!hasFields) {
        onError("Couldn't extract fields from this doc — try pasting the text instead.");
        return;
      }
      onImported({ fields: result.fields as Record<string, string>, source: result.source, label: fileName });
      onClose();
    } catch (err: any) {
      onError('Drive import failed: ' + (err.message || 'Unknown error'));
    } finally {
      setDriveImporting(null);
    }
  }

  async function importFile(file: File) {
    if (!file) return;
    setFileImporting(true);
    try {
      const result = await api.importFile(file);
      const hasFields = Object.keys(result.fields).length > 0;
      if (!hasFields) {
        onError("Couldn't extract fields from this file — try pasting the text instead.");
        return;
      }
      onImported({ fields: result.fields as Record<string, string>, source: result.source, label: result.label });
      onClose();
    } catch (err: any) {
      onError('File import failed: ' + (err.message || 'Unknown error'));
    } finally {
      setFileImporting(false);
    }
  }

  async function importText() {
    if (!textInput.trim()) return;
    setTextImporting(true);
    try {
      const result = await api.importDetect(textInput);
      const hasFields = Object.keys(result.fields).length > 0;
      if (!hasFields) {
        onError("Couldn't detect any fields — try adding more context.");
        return;
      }
      onImported({ fields: result.fields as Record<string, string>, source: result.source, label: result.label });
      onClose();
    } catch (err: any) {
      onError('Import failed: ' + (err.message || 'Unknown error'));
    } finally {
      setTextImporting(false);
    }
  }

  function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'hubspot', label: 'HubSpot', icon: '🔗' },
    { id: 'drive', label: 'Google Drive', icon: '📄' },
    { id: 'file', label: 'Upload File', icon: '⬆️' },
    { id: 'text', label: 'Paste Text', icon: '✏️' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Add Source</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6 min-h-[280px] flex flex-col">
          {/* HubSpot Tab */}
          {tab === 'hubspot' && (
            <div className="flex flex-col gap-3 flex-1">
              <p className="text-xs text-slate-500">Search for a deal to auto-fill client and project details.</p>
              <input
                type="text"
                placeholder="Search deals by name..."
                value={hsQuery}
                onChange={(e) => setHsQuery(e.target.value)}
                autoFocus
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none transition-all"
              />
              <div className="flex-1 overflow-y-auto space-y-1.5 max-h-44">
                {hsLoading && (
                  <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
                    <span className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mr-2" />
                    Searching...
                  </div>
                )}
                {!hsLoading && hsQuery.trim() && hsResults.length === 0 && (
                  <p className="text-center py-8 text-slate-400 text-sm">No deals found for "{hsQuery}"</p>
                )}
                {!hsLoading && !hsQuery.trim() && (
                  <p className="text-center py-8 text-slate-400 text-sm">Start typing to search HubSpot deals</p>
                )}
                {hsResults.map((deal) => (
                  <button
                    key={deal.dealId}
                    onClick={() => importHubSpotDeal(deal.dealId, deal.dealName)}
                    disabled={hsImporting === deal.dealId}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-teal-50 transition-colors text-left disabled:opacity-60"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{deal.dealName}</p>
                      <p className="text-[11px] text-slate-400 capitalize">{deal.stage?.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {deal.amount && (
                        <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                          ${Number(deal.amount).toLocaleString()}
                        </span>
                      )}
                      {hsImporting === deal.dealId ? (
                        <span className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Drive Tab */}
          {tab === 'drive' && (
            <div className="flex flex-col gap-3 flex-1">
              <p className="text-xs text-slate-500">Select a recent Google Doc to extract contract details.</p>
              {driveLoading && (
                <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                  <span className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mr-2" />
                  Loading your Drive files...
                </div>
              )}
              {driveError && (
                <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm">
                  <span>⚠️</span> {driveError}
                </div>
              )}
              {!driveLoading && !driveError && driveFiles.length === 0 && (
                <p className="text-center py-12 text-slate-400 text-sm">No Google Docs found in your Drive</p>
              )}
              <div className="flex-1 overflow-y-auto space-y-1.5 max-h-44">
                {driveFiles.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => importDriveFile(file.id, file.name)}
                    disabled={driveImporting === file.id}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-teal-50 transition-colors text-left disabled:opacity-60"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base shrink-0">📄</span>
                      <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[11px] text-slate-400 whitespace-nowrap">
                        {file.modifiedTime ? relativeTime(file.modifiedTime) : ''}
                      </span>
                      {driveImporting === file.id ? (
                        <span className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Upload File Tab */}
          {tab === 'file' && (
            <div className="flex flex-col gap-3 flex-1">
              <p className="text-xs text-slate-500">Upload a PDF or Word document to auto-fill contract fields.</p>
              <div
                className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 py-10 cursor-pointer transition-colors ${
                  fileDragging
                    ? 'border-teal-400 bg-teal-50'
                    : 'border-slate-300 hover:border-teal-300 hover:bg-slate-50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setFileDragging(true); }}
                onDragLeave={() => setFileDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setFileDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) importFile(file);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.html"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); }}
                />
                {fileImporting ? (
                  <>
                    <span className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-500">Extracting fields…</p>
                  </>
                ) : (
                  <>
                    <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-700">Drop a file here or click to browse</p>
                      <p className="text-xs text-slate-400 mt-0.5">PDF, Word (.docx), or HTML redline</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Text Tab */}
          {tab === 'text' && (
            <div className="flex flex-col gap-3 flex-1">
              <p className="text-xs text-slate-500">Paste meeting notes, emails, or any text with contract details.</p>
              <textarea
                placeholder="Paste anything — meeting notes, email threads, project briefs..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); importText(); }
                }}
                autoFocus
                className="flex-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none transition-all min-h-[140px]"
              />
              <button
                onClick={importText}
                disabled={textImporting || !textInput.trim()}
                className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-semibold px-5 py-2.5 rounded-lg self-end transition-colors text-sm"
              >
                {textImporting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Extracting...
                  </span>
                ) : 'Extract Fields ↵'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
