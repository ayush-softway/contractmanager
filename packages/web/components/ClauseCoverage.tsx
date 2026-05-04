'use client';

interface ClauseCoverageProps {
  clauseChecks: Record<string, boolean>;
  clauseNames: Record<string, string>;
}

export default function ClauseCoverage({ clauseChecks, clauseNames }: ClauseCoverageProps) {
  const entries = Object.entries(clauseChecks);
  if (entries.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Clause Coverage</h3>
      <ul className="space-y-2">
        {entries.map(([id, passes]) => (
          <li key={id} className="flex items-center gap-2 text-sm">
            <span className={passes ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
              {passes ? '✅' : '✗'}
            </span>
            <span className={passes ? 'text-slate-700' : 'text-red-600'}>
              {clauseNames[id] ?? id}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
