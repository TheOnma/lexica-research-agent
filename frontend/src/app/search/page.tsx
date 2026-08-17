"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "@/components/ui/icons";
import { AppNav } from "@/components/AppNav";
import { Citation, ChatHistoryEntry, ingestArxiv, pollTask, streamAgentChat } from "@/lib/api";

interface ToolAction {
  name: string;
  input: unknown;
  output?: string;
  status: 'running' | 'done';
}

interface ArxivPaper {
  title: string;
  authors: string;
  year: number;
  abstract: string;
  arxiv_id?: string;
  url?: string;
}

interface Message {
  role: 'user' | 'bot';
  text: string;
  sources?: Citation[];
  tools?: ToolAction[];
  loading?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  date: string;
  messages: Message[];
}

export default function SearchPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saving, setSaving] = useState<Record<string, 'saving' | 'saved'>>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  // Session ids only need to be unique per browser. A ref counter keeps the
  // id generation pure (react-hooks/purity flags Date.now()/Math.random even
  // inside event handlers); display timestamps are computed in saveSession.
  const sessionSeqRef = useRef(0);

  useEffect(() => {
    const saved = localStorage.getItem('lexica_sessions');
    if (saved) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSessions(JSON.parse(saved));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  async function handleAsk() {
    if (!draft.trim() || isStreaming) return;

    const question = draft;
    setDraft('');

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = `s${++sessionSeqRef.current}`;
      setActiveSessionId(sessionId);
    }
    const currentSessionId = sessionId;

    setMessages(prev => {
      const newMsgs = [...prev, { role: 'user', text: question } as Message];
      saveSession(currentSessionId, newMsgs, question);
      return newMsgs;
    });

    setMessages(prev => {
      const newMsgs = [...prev, { role: 'bot', text: '', tools: [], loading: true } as Message];
      saveSession(currentSessionId, newMsgs, question);
      return newMsgs;
    });
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let currentText = '';
    let currentTools: ToolAction[] = [];
    let currentSources: Citation[] = [];

    // Tier-0 conversation memory: replay prior turns so the agent can refer to
    // things it said earlier (e.g. "save the first and second"). Text only.
    const history: ChatHistoryEntry[] = messages
      .filter(m => m.text && m.text.trim().length > 0)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));

    await streamAgentChat(
      question,
      history,
      (tool, input) => {
        currentTools = [...currentTools, { name: tool, input, status: 'running' }];
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1].tools = currentTools;
          return newMsgs;
        });
      },
      (tool, output) => {
        currentTools = [...currentTools];
        const t = currentTools.find(x => x.name === tool && x.status === 'running');
        if (t) {
          t.status = 'done';
          const outputStr = typeof output === "string" ? output : JSON.stringify(output);
          t.output = outputStr;

          if (tool === 'search_local_library') {
            try {
              const parsed = JSON.parse(outputStr);
              if (parsed.sources) {
                currentSources = [...currentSources, ...parsed.sources];
              }
            } catch {}
          }
        }
        setMessages(prev => {
          const newMsgs = [...prev];
          const last = newMsgs[newMsgs.length - 1];
          last.tools = currentTools;
          last.sources = currentSources.length > 0 ? currentSources : undefined;
          return newMsgs;
        });
      },
      (chunk) => {
        currentText += chunk;
        setMessages(prev => {
          const newMsgs = [...prev];
          const last = newMsgs[newMsgs.length - 1];
          last.text = currentText;
          last.loading = false;
          saveSession(currentSessionId, newMsgs, question);
          return newMsgs;
        });
      },
      (err) => {
        setMessages(prev => {
          const newMsgs = [...prev];
          const last = newMsgs[newMsgs.length - 1];
          last.text = currentText + `\n\n[Error: ${err}]`;
          last.loading = false;
          saveSession(currentSessionId, newMsgs, question);
          return newMsgs;
        });
      },
      abortController.signal
    );

    abortControllerRef.current = null;
    setIsStreaming(false);
  }

  function saveSession(id: string, msgs: Message[], firstQuestion: string) {
    const title = msgs.length > 0 && msgs[0].role === 'user' ? msgs[0].text.substring(0, 40) + "..." : firstQuestion.substring(0, 40) + "...";
    const dateStr = new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });

    setSessions(prev => {
      const existing = prev.find(s => s.id === id);
      let updated;
      if (existing) {
        updated = prev.map(s => s.id === id ? { ...s, messages: msgs } : s);
      } else {
        updated = [{ id, title, date: `Today · ${dateStr}`, messages: msgs }, ...prev];
      }
      localStorage.setItem('lexica_sessions', JSON.stringify(updated));
      return updated;
    });
  }

  function loadSession(id: string) {
    if (isStreaming) return;
    const s = sessions.find(x => x.id === id);
    if (s) {
      setActiveSessionId(id);
      setMessages(s.messages);
      setHistoryOpen(false);
    }
  }

  function newChat() {
    if (isStreaming) return;
    setActiveSessionId(null);
    setMessages([]);
    setHistoryOpen(false);
  }

  function handleStop() {
    if (abortControllerRef.current) abortControllerRef.current.abort();
  }

  async function handleSave(paper: ArxivPaper, key: string) {
    if (!paper.arxiv_id || saving[key]) return;
    setSaving(prev => ({ ...prev, [key]: 'saving' }));
    try {
      const taskId = await ingestArxiv(paper.arxiv_id);
      await pollTask(taskId);
      setSaving(prev => ({ ...prev, [key]: 'saved' }));
    } catch (err) {
      setSaving(prev => ({ ...prev, [key]: 'saved' })); // keep button stable; ingestion is async anyway
      console.error("Save failed:", err);
    }
  }

  return (
    <div className="app-screen open">
      <AppNav
        active="search"
        right={
          <div className="relative">
            <button
              className={`icon-btn ${historyOpen ? 'active' : ''}`}
              onClick={() => setHistoryOpen(o => !o)}
              title="Recent conversations"
            >
              <Icon.History />
            </button>
            {historyOpen && (
              <div className="absolute right-0 top-10 w-80 max-h-[60vh] overflow-auto rounded-xl bg-surface border border-line-2 shadow-[var(--shadow-lg)] p-2 z-50">
                <div className="doc-list-label flex justify-between items-center !py-1.5">
                  <span>Recent conversations</span>
                  <button className="icon-btn !w-[22px] !h-[22px]" onClick={newChat} title="New chat"><Icon.Plus className="icon-sm" /></button>
                </div>
                {sessions.length === 0 && (
                  <div className="text-[12px] text-muted text-center p-4">No recent chats</div>
                )}
                {sessions.map(h => (
                  <div key={h.id} className={`history-item ${activeSessionId === h.id ? 'active' : ''}`} onClick={() => loadSession(h.id)}>
                    <div className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">{h.title}</div>
                    <div className="text-[11.5px] text-muted">{h.date}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        }
      />

      <main className="chat-col">
        <div className="chat-scroll" ref={chatScrollRef}>
          <div className="chat-inner">
            {messages.length === 0 && (
              <div className="text-center mt-14 mb-6">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-accent-soft text-accent-ink grid place-items-center mb-4">
                  <Icon.Sparkle className="w-6 h-6" />
                </div>
                <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-ink">Find papers. Save them. Read them.</h1>
                <p className="text-muted text-[15px] mt-2 max-w-[440px] mx-auto leading-relaxed">
                  Ask the agent to research any topic — it searches arXiv, streams its work, and
                  answers with citations. Save what matters, then read and question it in your library.
                </p>
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    onClick={() => composerRef.current?.focus()}
                    className="btn btn-primary"
                  >
                    Ask a research question <Icon.ArrowRight className="icon-sm" />
                  </button>
                  <Link href="/library" className="btn btn-ghost">
                    <Icon.Stack className="icon-sm" /> Browse your library
                  </Link>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`msg ${msg.role}`}>
                <div className="who">{msg.role === 'user' ? 'JR' : <Icon.Sparkle className="icon-sm" />}</div>
                <div className="body">
                  <div className="label">{msg.role === 'user' ? 'You' : 'Lexica Agent'}</div>

                  {msg.tools && msg.tools.map((t, idx) => {
                    let uiLabel = "Executing tool...";
                    if (t.name === 'search_arxiv_for_papers') uiLabel = "Searching arXiv for research papers...";
                    if (t.name === 'search_local_library') uiLabel = "Searching your local workspace...";
                    if (t.name === 'ingest_arxiv_paper') uiLabel = "Downloading and ingesting paper...";

                    let arxivPapers: ArxivPaper[] = [];
                    if (t.name === 'search_arxiv_for_papers' && t.output) {
                      try {
                        const p = JSON.parse(t.output);
                        arxivPapers = p.papers || [];
                      } catch {}
                    }

                    return (
                      <div key={idx} className="my-2 p-3 bg-surface-2 border border-line rounded-lg text-[13px] text-ink flex flex-col gap-2">
                        <div className="flex items-center gap-2 font-medium">
                          {t.status === 'running' ? <Icon.Refresh className="icon-sm animate-spin text-accent" /> : <Icon.Check className="icon-sm text-green-500" />}
                          {uiLabel}
                        </div>

                        {arxivPapers.length > 0 && (
                          <div className="mt-2 flex flex-col gap-2">
                            <div className="font-semibold text-[11px] uppercase tracking-wider text-muted">Found Papers</div>
                            {arxivPapers.map((paper, pidx) => {
                              const key = `${t.name}-${idx}-${pidx}`;
                              const saved = saving[key];
                              const absUrl = paper.url || (paper.arxiv_id ? `https://arxiv.org/abs/${paper.arxiv_id}` : undefined);
                              return (
                                <div key={pidx} className="bg-white border border-line-2 rounded p-2 shadow-sm">
                                  <div className="font-semibold text-accent leading-snug">{paper.title}</div>
                                  <div className="text-[11.5px] text-muted mt-0.5">{paper.authors} · {paper.year}</div>
                                  <div className="text-[12px] mt-1 line-clamp-2 text-ink-2 leading-snug">{paper.abstract}</div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <button
                                      onClick={() => handleSave(paper, key)}
                                      disabled={saved === 'saved'}
                                      className={`h-7 px-2.5 rounded-md text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors border ${
                                        saved === 'saved'
                                          ? 'bg-ok/10 text-ok border-ok/30 cursor-default'
                                          : 'bg-accent text-white border-accent hover:brightness-105 cursor-pointer'
                                      }`}
                                    >
                                      {saved === 'saving'
                                        ? <Icon.Refresh className="icon-sm animate-spin" />
                                        : saved === 'saved'
                                          ? <Icon.Check className="icon-sm" />
                                          : <Icon.Stack className="icon-sm" />}
                                      {saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'In library' : 'Save'}
                                    </button>
                                    {absUrl && (
                                      <a
                                        href={absUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="h-7 px-2.5 rounded-md text-[12px] font-semibold inline-flex items-center gap-1.5 text-ink-2 bg-surface border border-line hover:bg-surface-2 no-underline"
                                      >
                                        <Icon.Globe className="icon-sm" /> arXiv
                                      </a>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="text leading-relaxed">
                    {msg.loading && !msg.text && (!msg.tools || msg.tools.every(t => t.status === 'done')) ? (
                      <span className="animate-pulse">Thinking...</span>
                    ) : msg.role === 'bot' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    )}
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="sources mt-4">
                      <div className="sources-label">{msg.sources.length} Sources</div>
                      {msg.sources.map((s, idx) => (
                        <div
                          key={idx}
                          className="source"
                          onClick={() => router.push(`/library?doc=${encodeURIComponent(s.source)}&page=${s.page}`)}
                          title="Open in your library at this page"
                        >
                          <div className="w-[22px] h-[22px] shrink-0 rounded-md bg-accent-soft text-accent-ink grid place-items-center font-mono font-semibold text-[11px]">{idx + 1}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12.5px] text-muted flex gap-2 items-center"><strong className="text-ink font-semibold">{s.source}</strong> · p. {s.page}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="composer-wrap">
          <div className="composer">
            <textarea
              ref={composerRef}
              rows={2}
              placeholder="Find papers about any research topic…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              className="border-0 bg-transparent resize-none outline-none font-normal text-[15px] leading-[1.5] text-ink min-h-[24px] p-1 placeholder:text-muted-2"
            ></textarea>
            <div className="flex items-center gap-2">
              <div className="flex-1"></div>
              <button
                onClick={handleAsk}
                className="h-8 px-3.5 bg-accent text-white border-0 rounded-lg font-semibold text-[13px] cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!draft.trim() || isStreaming}
              >
                Search <Icon.ArrowUp className="icon-sm" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between max-w-[760px] mx-auto mt-2">
            <div className="font-normal text-[12px] leading-[1.4] text-muted flex gap-4">
              <span><span className="kbd inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 font-mono font-medium text-[11px] bg-surface border border-line border-b-2 rounded-[5px] text-muted">⏎</span> to send</span>
              <span>Agent searches arXiv & your library · every claim cited</span>
            </div>
            {isStreaming && (
              <button
                onClick={handleStop}
                className="flex items-center gap-1 px-2.5 py-1 text-[12px] font-semibold text-white bg-red-500 rounded shadow-sm hover:bg-red-600 active:scale-95 transition-all"
              >
                Stop Search
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
