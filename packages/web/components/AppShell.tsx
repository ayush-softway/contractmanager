'use client';

import Sidebar from './Sidebar';
import UserMenu from './UserMenu';
import NotificationBell from './NotificationBell';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b border-slate-200 bg-white flex items-center justify-end px-6 gap-2 shrink-0">
          <NotificationBell />
          <UserMenu />
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
