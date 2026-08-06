"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { Document, Citation, fetchDocuments, uploadDocument, pollTask, streamAgentChat } from "@/lib/api";

interface ToolAction {
  name: string;
  input: any;
  output?: string;
  status: 'running' | 'done';
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

const SUGGESTED = [
  "Summarise the key findings",
  "Compare encoder and decoder stacks",
  "What are the limitations mentioned?",
];

export default function ChatPage() {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [activeCite, setActiveCite] = useState<Citation | null>(null);
  const [activeDoc, setActiveDoc] = useState<string>('');
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDocuments();
    const saved = localStorage.getItem('lexica_sessions');
    if (saved) {
      try {
        setSessions(JSON.parse(saved));
      } catch(e) {}
    }
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploading(true);
    try {
      const taskId = await uploadDocument(file);
      await pollTask(taskId);
      await loadDocuments();
    } catch (err) {
      alert("Failed to upload document: " + err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAsk() {
    if (!draft.trim() || isStreaming) return;
    
    const question = draft;
    setDraft('');
    
    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = Date.now().toString();
      setActiveSessionId(sessionId);
    }
    const currentSessionId = sessionId;

    setMessages(prev => {
      const newMsgs = [...prev, { role: 'user', text: question } as Message];
      saveSession(currentSessionId, newMsgs, question);
      return newMsgs;
    });
    
    // placeholder for bot
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

    await streamAgentChat(
      question,
      (tool, input) => {
        currentTools = [...currentTools, { name: tool, input, status: 'running' }];
        setMessages(prev => {
          const newMsgs = [...prev];
          const last = newMsgs[newMsgs.length - 1];
          last.tools = currentTools;
          return newMsgs;
        });
      },
      (tool, output) => {
        currentTools = [...currentTools];
        const t = currentTools.find(x => x.name === tool && x.status === 'running');
        if (t) {
          t.status = 'done';
          t.output = output;
          
          // Parse specific tool outputs
          if (tool === 'search_local_library') {
            try {
              const parsed = JSON.parse(output);
              if (parsed.sources) {
                currentSources = [...currentSources, ...parsed.sources];
              }
            } catch (e) {}
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
    }
  }

  function newChat() {
    if (isStreaming) return;
    setActiveSessionId(null);
    setMessages([]);
  }

  function handleStop() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }

  return (
    <div className="app-screen open">
      <div className="app-top">
        <Link href="/" className="icon-btn" title="Back to landing">
          <Icon.ArrowRight className="icon" style={{transform:'rotate(180deg)'}}/>
        </Link>
        <div className="flex items-center gap-2.5 font-semibold text-[15px] tracking-tight text-ink">
          <span className="flex items-center justify-center w-[26px] h-[26px] rounded-[7px] bg-ink text-bg font-bold text-[14px] tracking-[-0.04em]">L</span>
          <span>Lexica</span>
        </div>
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 border border-line-2 text-[13px] text-ink-2 font-medium">
            <Icon.Stack className="icon-sm"/>
            Research workspace
            <span className="text-muted font-normal">· {documents.length} documents</span>
          </div>
        </div>
        <button className={`icon-btn ${leftOpen?'active':''}`} onClick={()=>setLeftOpen(!leftOpen)} title="Toggle documents (⌘\)"><Icon.Sidebar/></button>
        <button className={`icon-btn ${rightOpen?'active':''}`} onClick={()=>setRightOpen(!rightOpen)} title="Toggle preview"><Icon.PanelRight/></button>
        <button className="icon-btn"><Icon.Settings/></button>
        <div className="w-[1px] h-5 bg-line mx-1"/>
        <div className="flex items-center justify-center w-[30px] h-[30px] rounded-full bg-gradient-to-br from-accent to-accent-ink text-white font-bold text-[12px] tracking-tight cursor-pointer" onClick={newChat} title="New Chat">JR</div>
      </div>

      <div className="app-body" data-left={leftOpen?'open':'closed'} data-right={rightOpen?'open':'closed'}>
        <aside className="panel">
          <div className="panel-body">
            <div 
              className="upload-zone cursor-pointer" 
              onClick={() => fileInputRef.current?.click()}
              style={isUploading ? { opacity: 0.5, pointerEvents: 'none' } : {}}
            >
              <div className="flex items-center justify-center w-9 h-9 mx-auto mb-2 rounded-[10px] bg-surface text-accent border border-line">
                {isUploading ? <Icon.Refresh className="icon animate-spin" /> : <Icon.Upload/>}
              </div>
              <div><strong>{isUploading ? 'Uploading & Ingesting...' : 'Drop a file'}</strong> {isUploading ? '' : 'or click to browse'}</div>
              <div className="text-[11.5px] mt-1 text-muted-2">PDF · DOCX · TXT · up to 50 MB</div>
            </div>
            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.txt,.docx" />

            <div className="mt-4 flex flex-col gap-[2px]">
              <div className="doc-list-label flex justify-between items-center">
                <span>Documents · {documents.length}</span>
                <button className="icon-btn !w-[22px] !h-[22px]"><Icon.Filter className="icon-sm"/></button>
              </div>
              {documents.map(d => (
                <div key={d.name} className={`doc ${activeDoc===d.name?'active':''}`} onClick={()=>setActiveDoc(d.name)}>
                  <span className="ftype" style={d.name.endsWith('.docx')?{background:'oklch(0.94 0.02 240)'}:d.name.endsWith('.txt')?{background:'oklch(0.94 0.04 60)'}:undefined}>
                    {d.name.split('.').pop()?.toUpperCase() || 'DOC'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">{d.name}</div>
                    <div className="text-[11.5px] text-muted mt-[2px]">{d.pages} pages · {d.chunks.toLocaleString()} chunks</div>
                  </div>
                </div>
              ))}
              {documents.length === 0 && <div className="text-[12px] text-muted text-center p-4">No documents yet.</div>}
            </div>

            <div className="mt-6">
              <div className="doc-list-label flex justify-between items-center">
                <span>
                  <Icon.History className="icon-sm inline mr-1.5 align-[-2px]"/>
                  Recent conversations
                </span>
                <button className="icon-btn !w-[22px] !h-[22px]" onClick={newChat} title="New Chat"><Icon.Plus className="icon-sm"/></button>
              </div>
              {sessions.map(h => (
                <div key={h.id} className={`history-item ${activeSessionId === h.id ? 'active' : ''}`} onClick={() => loadSession(h.id)}>
                  <div className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">{h.title}</div>
                  <div className="text-[11.5px] text-muted">{h.date}</div>
                </div>
              ))}
              {sessions.length === 0 && <div className="text-[12px] text-muted text-center p-4 mt-2">No recent chats</div>}
            </div>
          </div>
        </aside>

        <main className="chat-col">
          <div className="chat-scroll" ref={chatScrollRef}>
            <div className="chat-inner">
              {activeDoc && (
                <div className="flex items-center gap-2.5 p-2.5 px-3.5 bg-surface border border-line rounded-[10px] text-[13px] text-ink-2 mb-6">
                  <span className="ftype !w-[22px] !h-[26px] !rounded-[3px] !bg-accent-soft !text-accent-ink !border-0 !text-[8px]">DOC</span>
                  <div className="flex-1">
                    <div className="font-semibold text-[13px]">{activeDoc}</div>
                    <div className="text-[12px] text-muted">Active context</div>
                  </div>
                </div>
              )}

              {messages.length === 0 && (
                <div className="text-center text-muted mt-10">
                  <Icon.Sparkle className="icon-sm inline mb-2" />
                  <p>Welcome to Lexica. Upload a document to begin.</p>
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
                      if (t.name === 'ingest_arxiv_paper') uiLabel = `Downloading and ingesting paper...`;

                      let arxivPapers = [];
                      if (t.name === 'search_arxiv_for_papers' && t.output) {
                        try {
                          const p = JSON.parse(t.output);
                          arxivPapers = p.papers || [];
                        } catch(e) {}
                      }

                      return (
                        <div key={idx} className="my-2 p-3 bg-surface-2 border border-line rounded-lg text-[13px] text-ink flex flex-col gap-2">
                          <div className="flex items-center gap-2 font-medium">
                            {t.status === 'running' ? <Icon.Refresh className="icon-sm animate-spin text-accent"/> : <Icon.Check className="icon-sm text-green-500"/>}
                            {uiLabel}
                          </div>
                          
                          {arxivPapers.length > 0 && (
                            <div className="mt-2 flex flex-col gap-2">
                              <div className="font-semibold text-[11px] uppercase tracking-wider text-muted">Found Papers</div>
                              {arxivPapers.map((paper: any, pidx: number) => (
                                <div key={pidx} className="bg-white border border-line-2 rounded p-2 shadow-sm">
                                  <div className="font-semibold text-accent">{paper.title}</div>
                                  <div className="text-[11.5px] text-muted">{paper.authors} · {paper.year}</div>
                                  <div className="text-[12px] mt-1 line-clamp-2 text-ink-2 leading-snug">{paper.abstract}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    <div className="text whitespace-pre-wrap leading-relaxed">
                      {msg.loading && !msg.text && (!msg.tools || msg.tools.every(t=>t.status==='done')) ? (
                        <span className="animate-pulse">Thinking...</span>
                      ) : (
                        msg.text
                      )}
                    </div>

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="sources mt-4">
                        <div className="sources-label">{msg.sources.length} Sources</div>
                        {msg.sources.map((s, idx) => (
                          <div 
                            key={idx} 
                            className={`source ${activeCite === s ? 'active' : ''}`} 
                            onClick={() => { setActiveCite(s); setRightOpen(true); }}
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
                rows={2}
                placeholder={`Ask anything about your documents...`}
                value={draft}
                onChange={(e)=>setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAsk();
                  }
                }}
                className="border-0 bg-transparent resize-none outline-none font-normal text-[15px] leading-[1.5] text-ink min-h-[24px] p-1 placeholder:text-muted-2"
              ></textarea>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex gap-1">
                  <button className="act !h-[28px] !px-2"><Icon.Plus className="icon-sm"/></button>
                  <button className="act !h-[28px] !px-2"><Icon.Stack className="icon-sm"/>All docs</button>
                </div>
                <button 
                  onClick={handleAsk}
                  className="h-8 px-3.5 bg-accent text-white border-0 rounded-lg font-semibold text-[13px] cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed" 
                  disabled={!draft.trim() || isStreaming}
                >
                  Ask <Icon.ArrowUp className="icon-sm"/>
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between max-w-[760px] mx-auto mt-2">
              <div className="font-normal text-[12px] leading-[1.4] text-muted flex gap-4">
                <span><span className="kbd inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 font-mono font-medium text-[11px] bg-surface border border-line border-b-2 rounded-[5px] text-muted">⏎</span> to send</span>
                <span>Answers grounded in your documents · Lexica AI</span>
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

        <aside className="panel right">
          {activeCite ? (
            <>
              <div className="p-3.5 px-4 border-b border-line-2 flex flex-col gap-1.5 bg-surface">
                <div className="font-semibold text-[13px] leading-[1.3] text-ink">{activeCite.source}</div>
                <div className="font-normal text-[12px] leading-[1.3] font-mono text-muted flex gap-1.5 items-center"><Icon.Doc className="icon-sm"/>p. {activeCite.page}</div>
              </div>
              <div className="h-9 px-3 border-b border-line-2 flex items-center gap-1.5 bg-surface-2 font-medium text-[12px] font-mono text-muted">
                <span className="flex-1 text-center">Extracted Text Context</span>
              </div>
              <div className="flex-1 overflow-auto bg-surface p-4 flex flex-col">
                <div className="pdf-page p-4 bg-white border border-line shadow-sm rounded-md text-[13px] leading-relaxed font-serif whitespace-pre-wrap">
                  {activeCite.text}
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-muted text-[13px] mt-10">
              Select a citation to view its source context.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
