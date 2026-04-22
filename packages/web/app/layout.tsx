import type { Metadata } from 'next';
import Link from 'next/link';
import UserMenu from '@/components/UserMenu';
import './globals.css';

export const metadata: Metadata = {
  title: 'Contract Generator',
  description: 'Generate, edit, and manage contracts with Google Docs + AI.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Contract Generator
            </Link>
            <div className="flex items-center gap-5 text-sm">
              <Link href="/templates" className="text-slate-600 hover:text-slate-900">
                Templates
              </Link>
              <Link href="/contracts" className="text-slate-600 hover:text-slate-900">
                Contracts
              </Link>
              <UserMenu />
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
