import type { Metadata } from 'next';
import Link from 'next/link';
import UserMenu from '@/components/UserMenu';
import './globals.css';

export const metadata: Metadata = {
  title: 'Softway ContractGen',
  description: 'Generate legally complete contracts in under 3 minutes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
              Softway <span className="text-teal-600">ContractGen</span>
            </Link>
            <div className="flex items-center gap-5 text-sm">
              <Link href="/contracts/generate" className="text-slate-600 hover:text-teal-700 font-medium">
                New Contract
              </Link>
              <Link href="/contracts" className="text-slate-600 hover:text-teal-700 font-medium">
                History
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
