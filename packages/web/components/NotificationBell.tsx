'use client';

import { useState } from 'react';

interface Notification {
  id: string;
  message: string;
  action: string;
  href: string;
  time: string;
}

// Demo notifications — will be driven from real contract state post-demo
const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    message: 'Horizon Retail MSA — no response in 5 days',
    action: 'Send Reminder',
    href: '/contracts',
    time: '2 days ago',
  },
];

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const count = DEMO_NOTIFICATIONS.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
            </div>
            {DEMO_NOTIFICATIONS.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">All caught up</p>
            ) : (
              DEMO_NOTIFICATIONS.map((n) => (
                <div key={n.id} className="px-4 py-3 border-b border-slate-50 last:border-0">
                  <p className="text-sm text-slate-800">{n.message}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-slate-400">{n.time}</span>
                    <a
                      href={n.href}
                      className="text-xs font-semibold text-teal-600 hover:text-teal-700"
                      onClick={() => setOpen(false)}
                    >
                      {n.action} →
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
