'use client';

import { useEffect, useRef, useState } from 'react';

interface ContractDocProps {
  html: string;
  highlightField?: string;
  title?: string;
  contractId?: string;
  onHtmlChange?: (html: string) => void;
}

export default function ContractDoc({
  html,
  highlightField,
  title = 'Contract',
  contractId: _contractId,
  onHtmlChange: _onHtmlChange,
}: ContractDocProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Share Modal State
  const [shareOpen, setShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState('Editor');
  const [sharedUsers, setSharedUsers] = useState<{email: string, role: string}[]>([
    { email: 'ayush@softwaysolutions.com', role: 'Owner' }
  ]);
  const [copySuccess, setCopySuccess] = useState(false);

  // File Menu State
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Field highlighting
  useEffect(() => {
    if (!highlightField || !ref.current) return;
    ref.current.querySelectorAll('[data-field]').forEach((el) => {
      if (el.getAttribute('data-field') === highlightField) {
        el.classList.add('field-flash');
        setTimeout(() => el.classList.remove('field-flash'), 1500);
      }
    });
  }, [highlightField, html]);

  // Sync external html prop into contentEditable (only when not focused)
  useEffect(() => {
    if (!ref.current) return;
    if (document.activeElement !== ref.current) {
      // Highlight any unsubstituted {{variable}} tokens with amber badges
      const processed = html.replace(
        /\{\{(\w+)\}\}/g,
        '<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:4px;font-size:0.85em;font-weight:500" title="Missing field: $1">⚠ $1</span>'
      );
      ref.current.innerHTML = processed;
    }
  }, [html]);

  const handleShare = () => {
    if (shareEmail.trim()) {
      setSharedUsers([...sharedUsers, { email: shareEmail.trim(), role: shareRole }]);
      setShareEmail('');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // EXPORT FUNCTIONS
  const exportPDF = () => {
    setFileMenuOpen(false);
    const content = ref.current?.innerHTML || '';
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; color: #000; line-height: 1.5; }
              @media print {
                body { padding: 0; }
              }
            </style>
          </head>
          <body>
            ${content}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  const exportMarkdown = () => {
    setFileMenuOpen(false);
    if (!ref.current) return;
    
    let md = ref.current.innerText || html.replace(/<[^>]+>/g, '\n');
    
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportDocx = () => {
    setFileMenuOpen(false);
    if (!ref.current) return;
    
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + ref.current.innerHTML + footer;
    
    const blob = new Blob(['\ufeff', sourceHTML], {
        type: 'application/msword'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#f0f4f9' }}>
      {/* Top bar — Docs icon + title + menu */}
      <div className="bg-white border-b border-[#e0e0e0] px-3 pt-1.5 pb-0 flex items-start gap-2.5 shrink-0 relative">
        <svg viewBox="0 0 24 24" className="w-8 h-8 shrink-0 mt-0.5" fill="none">
          <rect width="18" height="22" x="3" y="1" rx="2" fill="#4285F4" />
          <rect width="6" height="1.5" x="6" y="6.5" rx="0.75" fill="white" opacity="0.9" />
          <rect width="12" height="1.5" x="6" y="10" rx="0.75" fill="white" opacity="0.9" />
          <rect width="12" height="1.5" x="6" y="13.5" rx="0.75" fill="white" opacity="0.9" />
          <rect width="8" height="1.5" x="6" y="17" rx="0.75" fill="white" opacity="0.9" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[15px] font-medium text-[#202124] leading-snug truncate max-w-xs">{title}</div>
            <svg className="w-4 h-4 text-[#bbb] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span className="text-[11px] text-[#5f6368] shrink-0">Read-only · Use chat to edit</span>
          </div>
          <div className="flex items-center gap-0 mt-0.5 -ml-1.5 relative" ref={fileMenuRef}>
            <button 
              onClick={() => setFileMenuOpen(!fileMenuOpen)}
              className={`text-[12px] text-[#444746] px-1.5 py-0.5 rounded transition-colors ${fileMenuOpen ? 'bg-[#e8eaed]' : 'hover:bg-[#f1f3f4]'}`}
            >
              File
            </button>
            {['Edit', 'View', 'Insert', 'Format', 'Tools', 'Extensions', 'Help'].map((item) => (
              <button key={item} className="text-[12px] text-[#444746] px-1.5 py-0.5 rounded hover:bg-[#f1f3f4] transition-colors">
                {item}
              </button>
            ))}

            {/* File Menu Dropdown */}
            {fileMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-[#e0e0e0] rounded shadow-lg py-1.5 z-50">
                <div className="px-4 py-1.5 text-[11px] font-bold text-[#5f6368] tracking-wider uppercase mb-1">Download</div>
                <button onClick={exportDocx} className="w-full text-left px-4 py-1.5 text-[13px] text-[#202124] hover:bg-[#f1f3f4] flex items-center gap-3">
                  <span className="w-4 flex justify-center text-[#1a73e8] font-bold">W</span> Microsoft Word (.docx)
                </button>
                <button onClick={exportPDF} className="w-full text-left px-4 py-1.5 text-[13px] text-[#202124] hover:bg-[#f1f3f4] flex items-center gap-3">
                  <span className="w-4 flex justify-center text-[#ea4335] font-bold">P</span> PDF Document (.pdf)
                </button>
                <button onClick={exportMarkdown} className="w-full text-left px-4 py-1.5 text-[13px] text-[#202124] hover:bg-[#f1f3f4] flex items-center gap-3">
                  <span className="w-4 flex justify-center text-[#5f6368] font-bold">M</span> Markdown (.md)
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Share button */}
        <button 
          onClick={() => setShareOpen(true)}
          className="shrink-0 mt-1 flex items-center gap-1.5 bg-[#c2e7ff] hover:bg-[#a8dff] text-[#001d35] hover:shadow text-[13px] font-medium px-5 py-1.5 rounded-full transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
          Share
        </button>
      </div>

      {/* Formatting toolbar */}
      <div className="bg-[#f8f9fa] border-b border-[#e0e0e0] px-3 py-1 flex items-center gap-0.5 shrink-0 overflow-x-auto hide-scrollbar">
        <button className="p-1.5 rounded hover:bg-[#e8eaed] text-[#444746]">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h10c4 0 7 3 7 7M3 10l4-4M3 10l4 4"/></svg>
        </button>
        <button className="p-1.5 rounded hover:bg-[#e8eaed] text-[#444746]">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10H11C7 10 4 13 4 17M21 10l-4-4M21 10l-4 4"/></svg>
        </button>
        <button onClick={exportPDF} className="p-1.5 rounded hover:bg-[#e8eaed] text-[#444746]" title="Print (PDF)">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="9" width="12" height="9" rx="1"/><path d="M6 9V5a1 1 0 011-1h10a1 1 0 011 1v4M9 17v2h6v-2"/></svg>
        </button>
        <div className="w-px h-5 bg-[#dadce0] mx-1" />
        <button className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#e8eaed] text-[12px] text-[#444746]">
          100% <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div className="w-px h-5 bg-[#dadce0] mx-1" />
        <button className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#e8eaed] text-[12px] text-[#444746] min-w-[100px]">
          Normal text <svg className="w-3 h-3 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div className="w-px h-5 bg-[#dadce0] mx-1" />
        <button className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#e8eaed] text-[12px] text-[#444746] min-w-[80px]">
          Arial <svg className="w-3 h-3 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <button className="p-1.5 rounded hover:bg-[#e8eaed] text-[#444746]">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/></svg>
        </button>
        <button className="flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-[#e8eaed] text-[12px] text-[#444746] w-9 justify-center">
          11 <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <button className="p-1.5 rounded hover:bg-[#e8eaed] text-[#444746]">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <div className="w-px h-5 bg-[#dadce0] mx-1" />
        <button className="w-7 h-7 rounded hover:bg-[#e8eaed] text-[13px] text-[#444746] font-bold flex items-center justify-center">B</button>
        <button className="w-7 h-7 rounded hover:bg-[#e8eaed] text-[13px] text-[#444746] italic flex items-center justify-center">I</button>
        <button className="w-7 h-7 rounded hover:bg-[#e8eaed] text-[13px] text-[#444746] underline flex items-center justify-center">U</button>
        <button className="w-7 h-7 rounded hover:bg-[#e8eaed] text-[13px] text-[#444746] line-through flex items-center justify-center">A</button>
        <div className="w-px h-5 bg-[#dadce0] mx-1" />
        <button className="p-1.5 rounded hover:bg-[#e8eaed] text-[#444746]">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.5 2C6.81 2 3 5.81 3 10.5S6.81 19 11.5 19h.5v3c4.86-2.34 8-7 8-11.5C20 5.81 16.19 2 11.5 2zm1 14.5h-2v-2h2v2zm.13-5.18l-.9.92C11.22 12.75 11 13.5 11 14h-2v-.5c0-.71.29-1.36.76-1.84l1.24-1.26c.25-.25.4-.59.4-.95 0-.74-.6-1.34-1.34-1.34-.74 0-1.34.6-1.34 1.34H7C7 8.01 8.01 7 9.5 7s2.5 1.01 2.5 2.5c0 .55-.22 1.05-.57 1.42l-.3.4z"/></svg>
        </button>
        <button className="p-1.5 rounded hover:bg-[#e8eaed] text-[#444746]">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.86L12 17.77l-6.18 3.23L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </button>
        <div className="w-px h-5 bg-[#dadce0] mx-1" />
        <button className="p-1.5 rounded hover:bg-[#e8eaed] text-[#444746]">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
        </button>
        <button className="p-1.5 rounded hover:bg-[#e8eaed] text-[#444746]">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        </button>
        <div className="w-px h-5 bg-[#dadce0] mx-1" />
        <button className="p-1.5 rounded hover:bg-[#e8eaed] text-[#444746]">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
        </button>
        <button className="p-1.5 rounded hover:bg-[#e8eaed] text-[#444746]">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1M4 10h1M5 10V6M4 14v.5a.5.5 0 00.5.5H5a.5.5 0 01.5.5v.5a.5.5 0 01-.5.5H4" strokeLinecap="round"/></svg>
        </button>
        <div className="w-px h-5 bg-[#dadce0] mx-1" />
        <button className="p-1.5 rounded hover:bg-[#e8eaed] text-[#444746]">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/><polyline points="11 8 7 12 11 16"/></svg>
        </button>
        <button className="p-1.5 rounded hover:bg-[#e8eaed] text-[#444746]">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/><polyline points="7 8 11 12 7 16"/></svg>
        </button>
      </div>

      {/* Ruler */}
      <div className="bg-[#f8f9fa] border-b border-[#e0e0e0] h-5 shrink-0 relative overflow-hidden hidden sm:block">
        <div className="absolute inset-0 flex items-end pb-0.5 px-[calc(50%-408px+96px)]">
          {Array.from({ length: 65 }, (_, i) => (
            <div key={i} className="absolute bottom-1" style={{ left: `${i * 12}px` }}>
              <div className={`bg-[#bbb] w-px ${i % 4 === 0 ? 'h-2.5' : 'h-1.5'}`} />
              {i % 4 === 0 && i > 0 && (
                <span className="absolute -top-0.5 left-1 text-[8px] text-[#888]">{i / 4}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Document scroll area */}
      <div className="flex-1 overflow-y-auto py-8" style={{ background: '#f0f4f9' }}>
        <div
          ref={ref}
          className="contract-doc bg-white mx-auto max-w-[816px] min-h-[1056px] px-12 sm:px-24 py-16 sm:py-20 prose prose-slate prose-sm select-text"
          style={{
            boxShadow: '0 1px 3px rgba(0,0,0,.2), 0 0 0 1px rgba(0,0,0,.04)',
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {/* Share Modal */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-[#f9fbfd] rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col">
            <div className="px-6 pt-5 pb-3 flex items-center justify-between">
              <h2 className="text-[22px] text-[#202124]">Share "{title}"</h2>
              <button onClick={() => setShareOpen(false)} className="p-2 hover:bg-black/5 rounded-full text-slate-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="px-6 pb-6 pt-2">
              <div className="flex items-center gap-2 mb-4 relative">
                <input 
                  type="email" 
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleShare()}
                  placeholder="Add people and groups" 
                  className="flex-1 bg-white border border-[#dadce0] rounded-[4px] px-3 py-2.5 text-sm focus:outline-none focus:border-[#1a73e8] focus:border-2 transition-all placeholder:text-[#5f6368]"
                />
                <select 
                  value={shareRole}
                  onChange={(e) => setShareRole(e.target.value)}
                  className="bg-transparent border border-[#dadce0] rounded-[4px] px-2 py-2.5 text-sm focus:outline-none text-[#5f6368]"
                >
                  <option>Viewer</option>
                  <option>Commenter</option>
                  <option>Editor</option>
                </select>
                <button 
                  onClick={handleShare}
                  disabled={!shareEmail.trim()}
                  className="bg-[#1a73e8] hover:bg-[#1765cc] text-white px-5 py-2.5 rounded-[4px] text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Send
                </button>
              </div>

              <div className="space-y-3 mb-6 mt-6">
                <p className="text-[13px] font-medium text-[#202124] mb-2">People with access</p>
                {sharedUsers.map((u, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                        {u.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-[14px]">
                        <p className="text-[#202124] font-medium leading-tight">
                          {u.email.split('@')[0]}
                          {u.role === 'Owner' && <span className="ml-1 text-[12px] text-[#5f6368] font-normal">(you)</span>}
                        </p>
                        <p className="text-[#5f6368] text-[12px]">{u.email}</p>
                      </div>
                    </div>
                    <span className="text-[13px] text-[#5f6368] pr-2">{u.role}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3 mt-6">
                <p className="text-[13px] font-medium text-[#202124] mb-2">General access</p>
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-black/5 transition-colors -ml-2 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#e8eaed] flex items-center justify-center text-[#444746]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <div>
                      <p className="text-[14px] font-medium text-[#202124]">Restricted</p>
                      <p className="text-[12px] text-[#5f6368]">Only people with access can open with the link</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 flex justify-between items-center">
              <button 
                onClick={handleCopyLink}
                className="flex items-center gap-2 text-[14px] font-medium text-[#1a73e8] hover:bg-[#f1f8ff] px-3 py-1.5 -ml-3 rounded-[4px] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                {copySuccess ? 'Link copied!' : 'Copy link'}
              </button>
              <button 
                onClick={() => setShareOpen(false)}
                className="border border-[#dadce0] text-[#1a73e8] hover:bg-[#f8f9fa] hover:text-[#174ea6] px-6 py-2 rounded-full text-[14px] font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
