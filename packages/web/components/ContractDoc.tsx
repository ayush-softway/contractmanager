'use client';

import { useEffect, useRef } from 'react';

interface ContractDocProps {
  html: string;
  highlightField?: string;
}

export default function ContractDoc({ html, highlightField }: ContractDocProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlightField || !ref.current) return;
    ref.current.querySelectorAll('[data-field]').forEach((el) => {
      if (el.getAttribute('data-field') === highlightField) {
        el.classList.add('field-flash');
        setTimeout(() => el.classList.remove('field-flash'), 1500);
      }
    });
  }, [highlightField, html]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 py-8">
      <div
        ref={ref}
        className="contract-doc bg-white mx-auto px-14 py-12 shadow-sm rounded-lg max-w-3xl prose prose-slate prose-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
