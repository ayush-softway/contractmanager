import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Softway ContractGen',
  description: 'Generate legally complete contracts in under 3 minutes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
