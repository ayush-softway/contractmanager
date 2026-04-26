'use client';

// LegalLockBadge — "🔒 Legal Approved — Locked" banner

export default function LegalLockBadge() {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center gap-3">
      <span className="text-lg">🔒</span>
      <div>
        <p className="text-sm font-bold text-emerald-800">LEGAL APPROVED — LOCKED</p>
        <p className="text-xs text-emerald-600">Template content cannot be modified. Only variable fields are editable.</p>
      </div>
    </div>
  );
}
