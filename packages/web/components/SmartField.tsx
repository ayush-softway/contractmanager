'use client';

// SmartField — form field with source badge and validation state

interface SmartFieldProps {
  id: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'date' | 'select' | 'toggle';
  value: string;
  source?: string;
  required?: boolean;
  unfilled?: boolean;
  onChange: (value: string) => void;
}

const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  hubspot: { label: 'HubSpot ✓', className: 'bg-orange-100 text-orange-800' },
  drive: { label: 'Drive ✓', className: 'bg-blue-100 text-blue-800' },
  text: { label: 'Text ✓', className: 'bg-purple-100 text-purple-800' },
  auto: { label: 'Auto ✓', className: 'bg-slate-100 text-slate-700' },
  manual: { label: 'Manual', className: 'bg-slate-100 text-slate-600' },
};

export default function SmartField({ id, label, type, value, source, required, unfilled, onChange }: SmartFieldProps) {
  const badge = source && value ? SOURCE_BADGES[source] : null;

  if (type === 'toggle') {
    return (
      <div className="flex flex-col">
        <label className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
          {label}
          {required && <span className="text-red-400 text-xs">*</span>}
        </label>
        <button
          type="button"
          onClick={() => onChange(value === 'yes' ? 'no' : 'yes')}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            value === 'yes' ? 'bg-teal-600' : 'bg-slate-300'
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              value === 'yes' ? 'translate-x-6' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    );
  }

  if (type === 'select') {
    const options = id === 'payment_structure'
      ? ['', 'Net 30', 'Net 45', 'Net 60', '50/50 Split', 'Milestone-Based']
      : id === 'discount_type'
      ? ['', 'None', 'Volume', 'Early Payment', 'Partnership', 'Custom']
      : [''];

    return (
      <div className="flex flex-col" data-unfilled={unfilled || undefined}>
        <label className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
          {label}
          {required && <span className="text-red-400 text-xs">*</span>}
          {badge && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${badge.className}`}>
              {badge.label}
            </span>
          )}
          {unfilled && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-red-100 text-red-700">
              UNFILLED
            </span>
          )}
        </label>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`p-2.5 border rounded-lg text-sm transition-colors bg-white ${
            unfilled ? 'border-red-300 bg-red-50/30' : !value ? 'border-slate-200 bg-yellow-50/30' : 'border-slate-200'
          } focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none`}
        >
          {options.map(opt => (
            <option key={opt} value={opt}>{opt || `Select ${label}...`}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex flex-col" data-unfilled={unfilled || undefined}>
      <label className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
        {label}
        {required && <span className="text-red-400 text-xs">*</span>}
        {badge && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${badge.className}`}>
            {badge.label}
          </span>
        )}
        {unfilled && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-red-100 text-red-700">
            UNFILLED
          </span>
        )}
      </label>
      <input
        type={type === 'number' ? 'text' : type}
        className={`p-2.5 border rounded-lg text-sm transition-colors ${
          unfilled
            ? 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-1 focus:ring-red-500'
            : !value
            ? 'border-slate-200 bg-yellow-50/30 focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
            : 'border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
        } outline-none`}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={label}
      />
    </div>
  );
}
