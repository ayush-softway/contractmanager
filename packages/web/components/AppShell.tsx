'use client';

import { useState } from 'react';
import Link from 'next/link';
import Sidebar from './Sidebar';
import UserMenu from './UserMenu';
import NotificationBell from './NotificationBell';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <header className="h-16 flex items-center px-4 shrink-0 justify-between bg-white border-b border-slate-200">
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => setSidebarOpen(true)} 
            className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link href="/" className="flex items-center gap-2 mr-2 sm:mr-8">
            <div className="w-9 h-9 bg-teal-600 rounded flex items-center justify-center font-bold text-white text-xl leading-none">
              C
            </div>
            <span className="text-[22px] font-medium text-slate-600 hidden sm:block tracking-tight">ContractGen</span>
          </Link>
        </div>
        
        {/* Search bar */}
        <div className="flex-1 max-w-3xl px-2 sm:px-6">
          <div className="bg-[#f1f3f4] rounded-full flex items-center px-4 py-2.5 focus-within:bg-white focus-within:shadow-md border border-transparent focus-within:border-slate-200 transition-all">
            <button className="p-1 -ml-1 text-slate-600 hover:bg-slate-200 rounded-full transition-colors mr-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <input 
              type="text" 
              placeholder="Search" 
              className="bg-transparent border-none outline-none w-full text-slate-700 placeholder-slate-600 text-[15px]" 
            />
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 ml-2 sm:ml-4">
          <NotificationBell />
          <UserMenu />
        </div>
      </header>
      
      <main className="flex-1 bg-white">{children}</main>
    </div>
  );
}
