'use client';

interface LegalLockBadgeProps {
  allClausesPass: boolean;
  status: string;
}

export default function LegalLockBadge({ allClausesPass, status }: LegalLockBadgeProps) {
  if (status === 'sent' || status === 'signed') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center gap-3">
        <span className="text-lg">🔒</span>
        <div>
          <p className="text-sm font-bold text-emerald-800">LEGAL APPROVED — LOCKED</p>
          <p className="text-xs text-emerald-600">This contract has been sent for signature. No further edits allowed.</p>
        </div>
      </div>
    );
  }

  if (allClausesPass) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center gap-3">
        <span className="text-lg">✅</span>
        <div>
          <p className="text-sm font-bold text-emerald-800">ALL CLAUSE CHECKS PASSED</p>
          <p className="text-xs text-emerald-600">Template content verified. Ready for signature.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
      <span className="text-lg">⚠️</span>
      <div>
        <p className="text-sm font-bold text-amber-800">CLAUSE REVIEW REQUIRED</p>
        <p className="text-xs text-amber-600">Some clause coverage checks need resolution before sending for signature.</p>
      </div>
    </div>
  );
}
