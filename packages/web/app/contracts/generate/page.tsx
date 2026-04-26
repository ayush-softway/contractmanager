'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function GenerateContractPage() {
  const router = useRouter();
  const [contractType, setContractType] = useState('msa-sow');
  
  const [importInput, setImportInput] = useState('');
  const [sourceChips, setSourceChips] = useState<{ id: string, label: string, type: string }[]>([]);
  
  const [fields, setFields] = useState<Record<string, string>>({});
  const [source, setSource] = useState<Record<string, 'hubspot' | 'drive' | 'text' | 'manual'>>({});
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  
  const [starters, setStarters] = useState<any[]>([]);

  useEffect(() => {
    api.listStarters().then(res => setStarters(res.starters));
  }, []);

  const handleImportDetect = async () => {
    if (!importInput.trim()) return;
    setImporting(true);
    setError('');
    try {
      const res = await api.importDetect(importInput);
      
      const newSources: any = {};
      Object.keys(res.fields).forEach(k => {
        if (res.fields[k]) newSources[k] = res.source;
      });
      
      setFields(prev => ({ ...prev, ...res.fields }));
      setSource(prev => ({ ...prev, ...newSources }));
      
      setSourceChips(prev => [
        ...prev, 
        { id: Date.now().toString(), label: res.label, type: res.source }
      ]);
      setImportInput('');
    } catch (err: any) {
      setError('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const removeChip = (id: string) => {
    setSourceChips(prev => prev.filter(c => c.id !== id));
  };

  const handleGenerate = async () => {
    setShowErrors(true);
    
    // 1. check for empty fields
    const required = ['client_legal_name', 'client_address', 'project_fee_usd', 'project_short_description'];
    const missing = required.filter(k => !fields[k]);
    if (missing.length > 0) {
      setError(`Missing required fields: ${missing.join(', ')}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setLoading(true);
    try {
      const imported = await api.importStarter(contractType);
      const contract = await api.generateContract({
        templateId: imported.template.id,
        title: `Contract for ${fields.client_legal_name || 'Client'}`,
        variableValues: fields,
      });
      router.push(`/contracts/${contract.contract.id}/review`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTypeDescription = (slug: string) => {
    if (slug === 'msa-sow') return 'New client — full legal package attached';
    if (slug === 'sow-standalone') return 'Repeat client with existing MSA on file';
    if (slug === 'change-order') return 'Scope or pricing update to an existing SOW';
    return '';
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* 3-Step Progress Indicator */}
      <div className="flex items-center justify-center gap-4 text-sm font-semibold text-gray-500 mb-12">
        <div className="flex items-center gap-2">
          <span className="bg-teal-600 text-white w-6 h-6 rounded-full flex items-center justify-center">1</span>
          <span className="text-teal-800">Contract Type</span>
        </div>
        <span>→</span>
        <div className="flex items-center gap-2">
          <span className="bg-teal-600 text-white w-6 h-6 rounded-full flex items-center justify-center">2</span>
          <span className="text-teal-800">Fill Details</span>
        </div>
        <span>→</span>
        <div className="flex items-center gap-2">
          <span className="bg-gray-200 text-gray-600 w-6 h-6 rounded-full flex items-center justify-center">3</span>
          <span>Review & Send</span>
        </div>
      </div>

      <h1 className="text-3xl font-bold mb-8">Generate Contract</h1>
      
      {error && <div className="bg-red-100 text-red-700 p-4 mb-4 rounded">{error}</div>}

      {/* Contract Type Selector (Moved to Top) */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Contract Type</h2>
        <div className="grid gap-4">
          {starters.map(s => (
            <div 
              key={s.slug}
              onClick={() => setContractType(s.slug)}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${contractType === s.slug ? 'border-teal-600 bg-teal-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900">{s.name}</h3>
                  <p className="text-sm text-gray-600">{getTypeDescription(s.slug) || s.description}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${contractType === s.slug ? 'border-teal-600' : 'border-gray-300'}`}>
                  {contractType === s.slug && <div className="w-2.5 h-2.5 bg-teal-600 rounded-full" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Unified Import Bar */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-8">
        <h2 className="text-xl font-semibold mb-2">Add Source</h2>
        <p className="text-sm text-gray-500 mb-4">Paste a HubSpot deal URL, Google Drive doc link, or raw meeting notes</p>
        <div className="flex flex-col gap-2">
          <textarea 
            placeholder="Paste anything — HubSpot URL, Drive link, or text..." 
            className="w-full p-3 border rounded-md min-h-[80px]"
            value={importInput} 
            onChange={e => setImportInput(e.target.value)} 
          />
          <button 
            onClick={handleImportDetect} 
            disabled={importing || !importInput.trim()}
            className="bg-teal-600 text-white font-semibold px-4 py-2 rounded-md self-end disabled:bg-gray-300 transition-colors"
          >
            {importing ? 'Importing...' : 'Add Source'}
          </button>
        </div>
        
        {/* Source Chips */}
        {sourceChips.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {sourceChips.map(chip => (
              <div key={chip.id} className="flex items-center gap-2 px-3 py-1 bg-gray-100 border border-gray-200 rounded-full text-sm">
                <span>✅ {chip.type === 'hubspot' ? 'HubSpot' : chip.type === 'drive' ? 'Drive' : 'Text'} — {chip.label}</span>
                <button onClick={() => removeChip(chip.id)} className="text-gray-400 hover:text-gray-600 font-bold">&times;</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white shadow-sm p-6 rounded-lg border border-gray-200 mb-8">
        <h2 className="text-xl font-semibold mb-6">Contract Details</h2>
        <div className="grid grid-cols-2 gap-6">
          {[
            { id: 'client_legal_name', label: 'Client Legal Name' },
            { id: 'client_address', label: 'Client Address' },
            { id: 'client_contact_name', label: 'Client Contact Name' },
            { id: 'client_contact_email', label: 'Client Contact Email' },
            { id: 'softway_contact_name', label: 'Softway Rep' },
            { id: 'sow_number', label: 'SOW Number' },
            { id: 'msa_effective_date', label: 'MSA Date' },
            { id: 'effective_date', label: 'Contract Date' },
            { id: 'project_end_date', label: 'Completion Date' },
            { id: 'project_short_description', label: 'Service Type / Scope' },
            { id: 'project_fee_usd', label: 'Total Value (USD)' },
          ].map(field => {
            const isUnfilled = !fields[field.id];
            const badgeVisible = showErrors && isUnfilled;
            return (
              <div key={field.id} className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  {field.label}
                  {source[field.id] && !isUnfilled && (
                    <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${
                      source[field.id] === 'hubspot' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {source[field.id]} ✓
                    </span>
                  )}
                  {badgeVisible && (
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-800 uppercase tracking-wider font-bold">
                      UNFILLED
                    </span>
                  )}
                </label>
                <input 
                  type="text" 
                  className={`p-2 border rounded-md transition-colors ${isUnfilled ? 'bg-yellow-50/50 border-yellow-200 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400' : 'border-gray-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500'}`}
                  value={fields[field.id] || ''}
                  onChange={e => {
                    setFields(prev => ({ ...prev, [field.id]: e.target.value }));
                    setSource(prev => ({ ...prev, [field.id]: 'manual' }));
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <button 
        onClick={handleGenerate}
        disabled={loading}
        className="w-full bg-teal-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-teal-700 disabled:bg-gray-400 transition-colors"
      >
        {loading ? 'Generating...' : 'Generate Contract'}
      </button>
    </div>
  );
}
