'use client';

// SourceChip — dismissible badge showing imported source

interface SourceChipProps {
  chip: { id: string; label: string; type: string };
  onRemove: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  hubspot: 'HubSpot',
  drive: 'Drive',
  text: 'Text',
};

export default function SourceChip({ chip, onRemove }: SourceChipProps) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 border border-teal-200 rounded-full text-sm text-teal-800">
      <span className="text-teal-600">✅</span>
      <span className="font-medium">{TYPE_LABELS[chip.type] || chip.type}</span>
      <span className="text-teal-600">—</span>
      <span>{chip.label}</span>
      <button
        onClick={onRemove}
        className="ml-1 text-teal-400 hover:text-red-500 font-bold transition-colors"
        aria-label="Remove source"
      >
        ×
      </button>
    </div>
  );
}
