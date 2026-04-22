'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { User } from '@cg/shared';

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-slate-500">Loading…</p>;
  }

  if (!user) {
    return (
      <section className="mx-auto max-w-xl text-center space-y-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome</h1>
        <p className="text-slate-600">
          Sign in with Google to manage your contract templates and generate
          contracts directly in your Drive.
        </p>
        <a
          href="/api/backend/auth/google/login"
          className="inline-block rounded-md bg-brand px-5 py-2.5 text-white font-medium hover:bg-brand-dark"
        >
          Sign in with Google
        </a>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hello, {user.displayName.split(' ')[0]}
        </h1>
        <p className="text-slate-600 mt-1">
          Jump into your templates or contracts to get started.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/templates"
          className="block rounded-lg border border-slate-200 bg-white p-6 hover:border-brand hover:shadow-sm"
        >
          <h2 className="font-medium">Templates</h2>
          <p className="text-sm text-slate-600 mt-1">
            Create reusable contract templates with `{'{{variables}}'}`.
          </p>
        </Link>
        <Link
          href="/contracts"
          className="block rounded-lg border border-slate-200 bg-white p-6 hover:border-brand hover:shadow-sm"
        >
          <h2 className="font-medium">Contracts</h2>
          <p className="text-sm text-slate-600 mt-1">
            Generate contracts from templates and refine them with AI.
          </p>
        </Link>
      </div>
    </section>
  );
}
