"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "@/components/ui/icons";
import { AppNav } from "@/components/AppNav";
import { Document, DocumentText, Citation, fetchDocuments, fetchDocumentText, deleteDocument, uploadDocument, pollTask, streamChat } from "@/lib/api";

function fileTypeLabel(name: string): string | null {
  if (!name.includes('.')) return null;
  const ext = name.split('.').pop()?.toUpperCase();
  return (ext || 'DOC').slice(0, 4);
}

interface QaMessage {
  role: 'user' | 'bot';
  text: string;
  sources?: Citation[];
  loading?: boolean;
}

function LibraryInner() {
  const searchParams = useSearchParams();
  // Arriving from a Search citation click: ?doc=...&page=... seeds the reader
  // directly, so the initial state is derived from the URL instead of an effect.
  const docParam = searchParams.get('doc');
  const pageParam = searchParams.get('page');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDoc, setActiveDoc] = useState<string>(docParam ?? '');
  const [docText, setDocText] = useState<DocumentText | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [qa, setQa] = useState<QaMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [jumpPage, setJumpPage] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qaScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open the doc (and jump to its page) when arriving from a citation click in
  // Search. The state is already seeded from the URL; this effect only fetches
  // the full text and scrolls to the page.
  // openDocument is a mount-time helper that re-runs identically, so it's
  // intentionally omitted from the deps (exhaustive-deps has not flagged it).
  useEffect(() => {
    if (docParam) {
      openDocument(docParam, pageParam ? Number(pageParam) : null);
    }
  }, [docParam, pageParam]);

  useEffect(() => {
    if (qaScrollRef.current) {
      qaScrollRef.current.scrollTop = qaScrollRef.current.scrollHeight;
    }
  }, [qa]);

  async function loadDocuments() {
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
      if (docs.length > 0 && !activeDoc) {
        setActiveDoc(docs[0].name);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function openDocument(name: string, page: number | null = null) {
    setActiveDoc(name);
    setQa([]);
    setDocText(null);
    setJumpPage(page);
    try {
      const text = await fetchDocumentText(name);
      setDocText(text);
      if (page) {
        setTimeout(() => {
          document.getElementById(`page-${page}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      }
    } catch (e) {
      console.error(e);
      setDocText(null);
    }
  }

  async function handleDeleteDoc(name: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirmingDelete !== name) {
      setConfirmingDelete(name);
      setTimeout(() => setConfirmingDelete(c => (c === name ? null : c)), 3000);
      return;
    }
    setConfirmingDelete(null);
    setDeleting(name);
    try {
      await deleteDocument(name);
      if (activeDoc === name) {
        setActiveDoc('');
        setDocText(null);
        setQa([]);
      }
      await loadDocuments();
    } catch (err) {
      alert("Failed to delete document: " + err);
    } finally {
      setDeleting(null);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploading(true);
    try {
      const taskId = await uploadDocument(file);
      await pollTask(taskId);
      await loadDocuments();
      // select the newly uploaded doc
      const docs = await fetchDocuments();
      const uploaded = docs.find(d => d.name === file.name);
      if (uploaded) openDocument(uploaded.name);
    } catch (err) {
      alert("Failed to upload document: " + err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAskAboutPaper() {
    if (!draft.trim() || isAsking || !activeDoc) return;
    const question = draft;
    setDraft('');
    const scope = activeDoc;

    setQa(prev => [...prev, { role: 'user', text: question } as QaMessage, { role: 'bot', text: '', loading: true } as QaMessage]);
    setIsAsking(true);

    let currentText = '';

    await streamChat(
      question,
      scope,
      (sources) => {
        setQa(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          last.sources = sources.length > 0 ? sources : undefined;
          return next;
        });
      },
      (chunk) => {
        currentText += chunk;
        setQa(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          last.text = currentText;
          last.loading = false;
          return next;
        });
      },
      (err) => {
        setQa(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          last.text = (currentText || "I couldn't find an answer") + (err ? `\n\n[Error: ${err}]` : '');
          last.loading = false;
          return next;
        });
      }
    );

    setIsAsking(false);
  }

  function jumpToPage(page: number) {
    setJumpPage(page);
    document.getElementById(`page-${page}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="app-screen open">
      <AppNav active="library" />

      <div className="lib-body">
        {/* Documents sidebar */}
        <aside className="panel">
          <div className="panel-body">
            <div
              className="upload-zone cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              style={isUploading ? { opacity: 0.5, pointerEvents: 'none' } : {}}
            >
              <div className="flex items-center justify-center w-9 h-9 mx-auto mb-2 rounded-[10px] bg-surface text-accent border border-line">
                {isUploading ? <Icon.Refresh className="icon animate-spin" /> : <Icon.Upload />}
              </div>
              <div><strong>{isUploading ? 'Uploading & Ingesting...' : 'Drop a file'}</strong> {isUploading ? '' : 'or click to browse'}</div>
              <div className="text-[11.5px] mt-1 text-muted-2">PDF · DOCX · TXT · up to 50 MB</div>
            </div>
            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.txt,.docx" />

            <div className="mt-4 flex flex-col gap-[2px]">
              <div className="doc-list-label flex justify-between items-center">
                <span>Library · {documents.length}</span>
              </div>
              {documents.map(d => (
                <div key={d.name} className={`doc group ${activeDoc === d.name ? 'active' : ''}`} onClick={() => openDocument(d.name)}>
                  <span className="ftype" style={d.name.endsWith('.docx') ? { background: 'oklch(0.94 0.02 240)' } : d.name.endsWith('.txt') ? { background: 'oklch(0.94 0.04 60)' } : undefined}>
                    {fileTypeLabel(d.name) ?? <Icon.Doc className="w-3.5 h-3.5" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium whitespace-nowrap overflow-hidden text-ellipsis" title={d.name}>{d.name}</div>
                    <div className="text-[11.5px] text-muted mt-[2px]">{d.pages} pages</div>
                  </div>
                  <button
                    className={`doc-del ${deleting === d.name ? 'busy' : confirmingDelete === d.name ? 'armed' : ''}`}
                    onClick={(e) => handleDeleteDoc(d.name, e)}
                    disabled={deleting === d.name}
                    title={confirmingDelete === d.name ? 'Click again to confirm delete' : 'Delete document'}
                  >
                    {deleting === d.name
                      ? <Icon.Refresh className="icon-sm animate-spin" />
                      : confirmingDelete === d.name
                        ? <Icon.Check className="icon-sm" />
                        : <Icon.Trash className="icon-sm" />}
                  </button>
                </div>
              ))}
              {documents.length === 0 && <div className="text-[12px] text-muted text-center p-4">Your library is empty — upload a paper or save one from Search.</div>}
            </div>
          </div>
        </aside>

        {/* Main: reader + ask-about-this-paper */}
        <main className="lib-main">
          {!activeDoc ? (
            <div className="lib-empty">
              <Icon.Stack className="icon w-8 h-8 text-muted" />
              <p className="text-[15px] text-ink-2 font-medium mt-3">Select a document to read it</p>
              <p className="text-[13px] text-muted mt-1 max-w-[360px] leading-relaxed">
                Every paper you save from Search lands here with its full text. Click a document to read it and ask questions about it.
              </p>
            </div>
          ) : (
            <>
              <div className="reader-head">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[14px] leading-[1.3] text-ink truncate" title={activeDoc}>{activeDoc}</div>
                  <div className="font-normal text-[12px] leading-[1.3] font-mono text-muted flex gap-1.5 items-center mt-0.5">
                    <Icon.Doc className="icon-sm" />{docText ? `${docText.pages.length} pages · full text` : 'loading…'}
                  </div>
                </div>
              </div>

              {qa.length > 0 && (
                <div className="qa-thread" ref={qaScrollRef}>
                  {qa.map((m, i) => (
                    <div key={i} className={`qa-msg ${m.role}`}>
                      <div className="qa-label">{m.role === 'user' ? 'You' : 'Answer'}</div>
                      {m.role === 'bot' && m.loading && !m.text ? (
                        <span className="animate-pulse text-muted text-[13px]">Searching this paper…</span>
                      ) : m.role === 'bot' ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                      ) : (
                        <div className="whitespace-pre-wrap">{m.text}</div>
                      )}
                      {m.role === 'bot' && m.sources && m.sources.length > 0 && (
                        <div className="qa-sources">
                          {m.sources.map((s, idx) => (
                            <button
                              key={idx}
                              onClick={() => jumpToPage(s.page)}
                              className={`qa-src ${jumpPage === s.page ? 'active' : ''}`}
                              title="Jump to this page"
                            >
                              p. {s.page}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="reader-scroll">
                {docText ? (
                  docText.pages.map(p => (
                    <div key={p.page} id={`page-${p.page}`} className={`reader-page ${jumpPage === p.page ? 'highlighted' : ''}`}>
                      <div className="text-[11px] font-mono text-muted mb-1.5 uppercase tracking-wide">Page {p.page}</div>
                      <div className="bg-white border border-line shadow-sm rounded-md text-[13px] leading-relaxed p-4 whitespace-pre-wrap">{p.text}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-[13px] text-muted text-center mt-10">Loading full text…</div>
                )}
              </div>

              <div className="qa-composer">
                <div className="qa-composer-box">
                  <textarea
                    rows={1}
                    placeholder={`Ask about this paper…`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAskAboutPaper();
                      }
                    }}
                    className="border-0 bg-transparent resize-none outline-none font-normal text-[14px] leading-[1.5] text-ink min-h-[22px] p-1 placeholder:text-muted-2 flex-1"
                  ></textarea>
                  <button
                    onClick={handleAskAboutPaper}
                    disabled={!draft.trim() || isAsking}
                    className="h-8 px-3.5 bg-accent text-white border-0 rounded-lg font-semibold text-[13px] cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {isAsking ? <Icon.Refresh className="icon-sm animate-spin" /> : <Icon.ArrowUp className="icon-sm" />}
                    Ask
                  </button>
                </div>
                <div className="qa-composer-hint">
                  Answers are grounded only in this document, with page references.
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="app-screen open"><AppNav active="library" /></div>}>
      <LibraryInner />
    </Suspense>
  );
}
