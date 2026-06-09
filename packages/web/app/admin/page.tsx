'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import type { Clause, ClauseType, Contract } from '@cg/shared';

type Tab = 'clauses' | 'vault' | 'integrations';

const typeConfig: Record<ClauseType, { label: string; color: string }> = {
  'non-negotiable': { label: 'Non-Negotiable', color: 'bg-red-100 text-red-700' },
  flexible: { label: 'Flexible', color: 'bg-amber-100 text-amber-700' },
  optional: { label: 'Optional', color: 'bg-emerald-100 text-emerald-700' },
};

const integrations = [
  { name: 'HubSpot', desc: 'Client data auto-extraction. Webhook: Closed Won on signing.', status: 'simulated', icon: '🔶' },
  { name: 'Google Drive', desc: 'Storage layer for all generated contracts as live Google Docs.', status: 'connected', icon: '📁' },
  { name: 'DocuSign', desc: 'Signature dispatch, tracking, recall/void.', status: 'simulated', icon: '✍️' },
];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('clauses');
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClause, setEditingClause] = useState<Clause | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editType, setEditType] = useState<ClauseType>('non-negotiable');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [addingClause, setAddingClause] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ClauseType>('flexible');
  const [newBody, setNewBody] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([api.listClauses(), api.listContracts()])
      .then(([clauseRes, contractRes]) => {
        setClauses(clauseRes.clauses);
        setContracts(contractRes.contracts);
      })
      .finally(() => setLoading(false));
  }, []);

  function openEdit(clause: Clause) {
    setEditingClause(clause);
    setEditBody(clause.body);
    setEditType(clause.type);
    setSaveSuccess(false);
  }

  async function createClause() {
    if (!newName.trim() || !newBody.trim()) return;
    setCreating(true);
    try {
      const result = await api.createClause({ name: newName.trim(), type: newType, body: newBody.trim(), updatedBy: 'Admin' });
      setClauses((prev) => [result.clause, ...prev]);
      setAddingClause(false);
      setNewName('');
      setNewType('flexible');
      setNewBody('');
    } finally {
      setCreating(false);
    }
  }

  async function saveClause() {
    if (!editingClause) return;
    setSaving(true);
    try {
      const updated = await api.updateClause(editingClause.id, { body: editBody, type: editType, updatedBy: 'Admin' });
      setClauses((prev) => prev.map((c) => (c.id === updated.clause.id ? updated.clause : c)));
      setEditingClause(updated.clause);
      setSaveSuccess(true);
    } finally {
      setSaving(false);
    }
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    generated: 'bg-blue-100 text-blue-700',
    sent: 'bg-amber-100 text-amber-700',
    signed: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-3rem)]">
        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="px-8 py-4 border-b border-slate-200 bg-white">
            <h1 className="text-xl font-bold text-slate-900">Settings & Standards</h1>
            <div className="flex gap-1 mt-3">
              {(['clauses', 'vault', 'integrations'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    tab === t ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t === 'clauses' ? 'Clause Library' : t === 'vault' ? 'Contract Vault' : 'Integrations'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* Table / content area */}
            <div className={`flex-1 overflow-y-auto p-6 ${editingClause ? 'pr-0' : ''}`}>
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : tab === 'clauses' ? (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Clause Name</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Updated</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Updated By</th>
                        <th className="px-5 py-3 text-right">
                          <button
                            onClick={() => setAddingClause(true)}
                            className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1 ml-auto"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Clause
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {clauses.map((clause, i) => (
                        <tr key={clause.id} className={`${i > 0 ? 'border-t border-slate-100' : ''} hover:bg-slate-50 transition-colors ${editingClause?.id === clause.id ? 'bg-teal-50' : ''}`}>
                          <td className="px-5 py-3 font-medium text-slate-900">{clause.name}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${typeConfig[clause.type]?.color ?? 'bg-slate-100 text-slate-600'}`}>
                              {typeConfig[clause.type]?.label ?? clause.type}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-500">
                            {new Date(clause.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-500">{clause.updatedBy ?? '—'}</td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => openEdit(clause)} className="text-xs font-semibold text-teal-600 hover:text-teal-700">Edit</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : tab === 'vault' ? (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contract</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.length === 0 ? (
                        <tr><td colSpan={4} className="text-center py-8 text-slate-400 text-sm">No contracts yet</td></tr>
                      ) : contracts.map((c, i) => (
                        <tr key={c.id} className={`${i > 0 ? 'border-t border-slate-100' : ''} hover:bg-slate-50`}>
                          <td className="px-5 py-3 font-medium text-slate-900">{c.title}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusColors[c.status] ?? 'bg-slate-100 text-slate-600'}`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                          <td className="px-5 py-3 text-right">
                            <Link href={`/contracts/${c.id}/review`} className="text-xs font-semibold text-teal-600 hover:text-teal-700">Open →</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-4">
                  {integrations.map((intg) => (
                    <div key={intg.name} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
                      <span className="text-2xl">{intg.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-slate-900 text-sm">{intg.name}</p>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${intg.status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {intg.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{intg.desc}</p>
                      </div>
                      <button className="text-xs font-medium text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                        Configure
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Clause editor slide-out */}
            {editingClause && (
              <div className="w-96 border-l border-slate-200 bg-white flex flex-col overflow-hidden shrink-0">
                <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{editingClause.name}</h3>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${typeConfig[editingClause.type]?.color ?? ''}`}>
                      {typeConfig[editingClause.type]?.label}
                    </span>
                  </div>
                  <button onClick={() => setEditingClause(null)} className="text-slate-400 hover:text-slate-600 mt-0.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Type</label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as ClauseType)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="non-negotiable">Non-Negotiable</option>
                      <option value="flexible">Flexible</option>
                      <option value="optional">Optional</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Clause Text</label>
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={12}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                    />
                  </div>
                </div>

                <div className="p-5 border-t border-slate-100">
                  {saveSuccess && (
                    <p className="text-xs text-emerald-600 font-medium mb-2">✓ Changes saved</p>
                  )}
                  <button
                    onClick={saveClause}
                    disabled={saving}
                    className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 text-white py-2.5 rounded-lg font-bold text-sm transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
                    <span>🕐</span>
                    Last edited by {editingClause.updatedBy ?? 'Unknown'},{' '}
                    {new Date(editingClause.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Add Clause Modal */}
      {addingClause && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Add Clause</h2>
              <button onClick={() => setAddingClause(false)} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Clause Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Data Processing Addendum"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as ClauseType)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="non-negotiable">Non-Negotiable</option>
                  <option value="flexible">Flexible</option>
                  <option value="optional">Optional</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Clause Text</label>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  rows={7}
                  placeholder="Enter the full clause language..."
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setAddingClause(false)}
                className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createClause}
                disabled={!newName.trim() || !newBody.trim() || creating}
                className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-sm font-bold transition-colors"
              >
                {creating ? 'Adding...' : 'Add Clause'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
