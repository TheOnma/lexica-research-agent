"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";

const SAMPLE_DOCS = [
  { id: 'd1', name: 'Attention is All You Need.pdf', type: 'PDF', pages: 15, chunks: 312, active: true },
  { id: 'd2', name: 'Climate Risk Report 2024.pdf', type: 'PDF', pages: 82, chunks: 1840 },
  { id: 'd3', name: 'Lit Review — Draft 4.docx', type: 'DOCX', pages: 24, chunks: 521 },
  { id: 'd4', name: 'Survey methodology.txt', type: 'TXT', pages: 6, chunks: 84 },
  { id: 'd5', name: 'WHO Air Quality Guidelines.pdf', type: 'PDF', pages: 360, chunks: 7210 },
];

const HISTORY = [
  { id: 'h1', t: 'Transformer self-attention key innovations', d: 'Today · 2:14 PM', active: true },
  { id: 'h2', t: 'Climate report — Arctic sea ice trajectory', d: 'Today · 11:03 AM' },
  { id: 'h3', t: 'PM2.5 thresholds vs. ozone', d: 'Yesterday' },
  { id: 'h4', t: 'Methodology section critique', d: '2 days ago' },
  { id: 'h5', t: 'Compare positional encoding schemes', d: 'Mar 28' },
];

const SUGGESTED = [
  "Summarise section 3.2 in two sentences",
  "Compare encoder and decoder stacks",
  "What's the dimensionality of the attention heads?",
  "Find every claim that cites Bahdanau et al.",
];

export default function ChatPage() {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [activeCite, setActiveCite] = useState(1);
  const [activeDoc, setActiveDoc] = useState('d1');
  const [draft, setDraft] = useState('');

  return (
    <div className="app-screen open">
      {/* TOP BAR */}
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
            <span className="text-muted font-normal">· 5 documents · 9,967 chunks</span>
          </div>
        </div>
        <button className={`icon-btn ${leftOpen?'active':''}`} onClick={()=>setLeftOpen(!leftOpen)} title="Toggle documents (⌘\)"><Icon.Sidebar/></button>
        <button className={`icon-btn ${rightOpen?'active':''}`} onClick={()=>setRightOpen(!rightOpen)} title="Toggle preview"><Icon.PanelRight/></button>
        <button className="icon-btn"><Icon.Settings/></button>
        <div className="w-[1px] h-5 bg-line mx-1"/>
        <div className="flex items-center justify-center w-[30px] h-[30px] rounded-full bg-gradient-to-br from-accent to-accent-ink text-white font-bold text-[12px] tracking-tight">JR</div>
      </div>

      {/* BODY */}
      <div className="app-body" data-left={leftOpen?'open':'closed'} data-right={rightOpen?'open':'closed'}>
        {/* LEFT — DOCS + HISTORY */}
        <aside className="panel">
          <div className="panel-body">
            <div className="upload-zone">
              <div className="flex items-center justify-center w-9 h-9 mx-auto mb-2 rounded-[10px] bg-surface text-accent border border-line"><Icon.Upload/></div>
              <div><strong>Drop a file</strong> or click to browse</div>
              <div className="text-[11.5px] mt-1 text-muted-2">PDF · DOCX · TXT · up to 50 MB</div>
            </div>

            <div className="mt-4 flex flex-col gap-[2px]">
              <div className="doc-list-label flex justify-between items-center">
                <span>Documents · {SAMPLE_DOCS.length}</span>
                <button className="icon-btn !w-[22px] !h-[22px]"><Icon.Filter className="icon-sm"/></button>
              </div>
              {SAMPLE_DOCS.map(d => (
                <div key={d.id} className={`doc ${activeDoc===d.id?'active':''}`} onClick={()=>setActiveDoc(d.id)}>
                  <span className="ftype" style={d.type==='DOCX'?{background:'oklch(0.94 0.02 240)'}:d.type==='TXT'?{background:'oklch(0.94 0.04 60)'}:undefined}>{d.type}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">{d.name}</div>
                    <div className="text-[11.5px] text-muted mt-[2px]">{d.pages} pages · {d.chunks.toLocaleString()} chunks</div>
                  </div>
                  <button className="opacity-0 hover:opacity-100 w-[22px] h-[22px] rounded-md grid place-items-center text-muted hover:bg-surface hover:text-ink transition-opacity" onClick={(e)=>{e.stopPropagation();}}><Icon.X className="icon-sm"/></button>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <div className="doc-list-label">
                <Icon.History className="icon-sm inline mr-1.5 align-[-2px]"/>
                Recent conversations
              </div>
              {HISTORY.map(h => (
                <div key={h.id} className={`history-item ${h.active?'active':''}`}>
                  <div className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">{h.t}</div>
                  <div className="text-[11.5px] text-muted">{h.d}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* CENTER — CHAT */}
        <main className="chat-col">
          <div className="chat-scroll">
            <div className="chat-inner">

              <div className="flex items-center gap-2.5 p-2.5 px-3.5 bg-surface border border-line rounded-[10px] text-[13px] text-ink-2">
                <span className="ftype !w-[22px] !h-[26px] !rounded-[3px] !bg-accent-soft !text-accent-ink !border-0 !text-[8px]">PDF</span>
                <div className="flex-1">
                  <div className="font-semibold text-[13px]">Attention is All You Need.pdf</div>
                  <div className="text-[12px] text-muted">Active context · 312 chunks indexed</div>
                </div>
                <button className="btn btn-ghost btn-sm"><Icon.Plus className="icon-sm"/>Add document</button>
              </div>

              {/* USER MSG */}
              <div className="msg user">
                <div className="who">JR</div>
                <div className="body">
                  <div className="label">You · 2:14 PM</div>
                  <div className="text">What's the key innovation behind the transformer architecture, and why did the authors move away from recurrence?</div>
                </div>
              </div>

              {/* BOT MSG */}
              <div className="msg bot">
                <div className="who"><Icon.Sparkle className="icon-sm" /></div>
                <div className="body">
                  <div className="label">Lexica · GPT-4o · 0.84s</div>
                  <div className="text">
                    <p>
                      The transformer's central innovation is replacing recurrence and convolution with <strong>self-attention</strong> as
                      the sole mechanism for drawing dependencies between tokens
                      <span className={`cite ${activeCite===1?'active':''}`} onClick={()=>setActiveCite(1)}>1</span>.
                      Every position in the sequence can attend to every other position in a single step, giving the model
                      a constant path length between any two tokens
                      <span className={`cite ${activeCite===2?'active':''}`} onClick={()=>setActiveCite(2)}>2</span>.
                    </p>
                    <p>
                      The authors moved away from recurrence for two reasons. First, recurrent models compute sequentially,
                      which prevents parallelization within training examples and becomes prohibitive at long sequence lengths
                      <span className={`cite ${activeCite===3?'active':''}`} onClick={()=>setActiveCite(3)}>3</span>.
                      Second, the path length between distant tokens grows linearly with their distance in RNNs, making it
                      hard for them to learn long-range dependencies — self-attention reduces this to <em>O(1)</em>
                      <span className={`cite ${activeCite===2?'active':''}`} onClick={()=>setActiveCite(2)}>2</span>.
                    </p>
                    <p>
                      In return, the transformer trains <strong>significantly faster</strong> and reaches higher BLEU scores on
                      WMT 2014 English-to-German and English-to-French translation than any previously reported model, including
                      ensembles, at a fraction of the training cost
                      <span className={`cite ${activeCite===4?'active':''}`} onClick={()=>setActiveCite(4)}>4</span>.
                    </p>
                  </div>

                  <div className="sources">
                    <div className="sources-label">4 Sources</div>
                    {[
                      {n:1, doc:'Attention is All You Need.pdf', page:'p. 2 · §3', q:'The Transformer follows this overall architecture using stacked self-attention and point-wise, fully connected layers for both the encoder and decoder.'},
                      {n:2, doc:'Attention is All You Need.pdf', page:'p. 6 · Table 1', q:'Self-attention layers connect all positions with a constant number of sequentially executed operations.'},
                      {n:3, doc:'Attention is All You Need.pdf', page:'p. 1 · §1', q:'This inherently sequential nature precludes parallelization within training examples, which becomes critical at longer sequence lengths.'},
                      {n:4, doc:'Attention is All You Need.pdf', page:'p. 8 · §6.1', q:'Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task, improving over the existing best results, including ensembles, by over 2 BLEU.'},
                    ].map(s=>(
                      <div key={s.n} className={`source ${activeCite===s.n?'active':''}`} onClick={()=>setActiveCite(s.n)}>
                        <div className="w-[22px] h-[22px] shrink-0 rounded-md bg-accent-soft text-accent-ink grid place-items-center font-mono font-semibold text-[11px]">{s.n}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] text-muted flex gap-2 items-center"><strong className="text-ink font-semibold">{s.doc}</strong> · {s.page}</div>
                          <div className="text-[13px] text-ink-2 mt-1.5 leading-[1.5] border-l-2 border-line pl-2.5 font-sans">{s.q}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-1 mt-3.5">
                    <button className="act"><Icon.Copy className="icon-sm"/>Copy</button>
                    <button className="act"><Icon.Refresh className="icon-sm"/>Regenerate</button>
                    <button className="act"><Icon.ThumbsUp className="icon-sm"/></button>
                    <button className="act"><Icon.ThumbsDown className="icon-sm"/></button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {SUGGESTED.map((s,i)=>(
                      <button key={i} className="px-3 py-2 rounded-full bg-surface border border-line font-medium text-[13px] text-ink-2 hover:border-accent hover:text-accent-ink hover:bg-accent-soft transition-all" onClick={()=>setDraft(s)}>{s}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* COMPOSER */}
          <div className="composer-wrap">
            <div className="composer">
              <textarea
                rows={2}
                placeholder={`Ask anything about your documents — try "compare sections 2 and 3"`}
                value={draft}
                onChange={(e)=>setDraft(e.target.value)}
                className="border-0 bg-transparent resize-none outline-none font-normal text-[15px] leading-[1.5] text-ink min-h-[24px] p-1 placeholder:text-muted-2"
              ></textarea>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex gap-1">
                  <button className="act !h-[28px] !px-2"><Icon.Plus className="icon-sm"/></button>
                  <button className="act !h-[28px] !px-2"><Icon.Stack className="icon-sm"/>All docs</button>
                  <button className="act !h-[28px] !px-2"><Icon.Sparkle className="icon-sm"/>HyDE</button>
                </div>
                <button className="h-8 px-3.5 bg-accent text-white border-0 rounded-lg font-semibold text-[13px] cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed" disabled={!draft.trim()}>
                  Ask <Icon.ArrowUp className="icon-sm"/>
                </button>
              </div>
            </div>
            <div className="max-w-[760px] mx-auto mt-2 font-normal text-[12px] leading-[1.4] text-muted flex gap-4">
              <span><span className="kbd inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 font-mono font-medium text-[11px] bg-surface border border-line border-b-2 rounded-[5px] text-muted">⏎</span> to send</span>
              <span><span className="kbd inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 font-mono font-medium text-[11px] bg-surface border border-line border-b-2 rounded-[5px] text-muted">⇧</span><span className="kbd inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 font-mono font-medium text-[11px] bg-surface border border-line border-b-2 rounded-[5px] text-muted">⏎</span> for newline</span>
              <span><span className="kbd inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 font-mono font-medium text-[11px] bg-surface border border-line border-b-2 rounded-[5px] text-muted">⌘</span><span className="kbd inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 font-mono font-medium text-[11px] bg-surface border border-line border-b-2 rounded-[5px] text-muted">K</span> commands</span>
              <span className="ml-auto">Answers grounded in your documents · Lexica AI</span>
            </div>
          </div>
        </main>

        {/* RIGHT — PDF PREVIEW */}
        <aside className="panel right">
          <div className="p-3.5 px-4 border-b border-line-2 flex flex-col gap-1.5 bg-surface">
            <div className="font-semibold text-[13px] leading-[1.3] text-ink">Attention is All You Need.pdf</div>
            <div className="font-normal text-[12px] leading-[1.3] font-mono text-muted flex gap-1.5 items-center"><Icon.Doc className="icon-sm"/>Source [{activeCite}] · 15 pages</div>
          </div>
          <div className="h-9 px-3 border-b border-line-2 flex items-center gap-1.5 bg-surface-2 font-medium text-[12px] font-mono text-muted">
            <button className="icon-btn !w-6 !h-6"><Icon.Up className="icon-sm"/></button>
            <button className="icon-btn !w-6 !h-6"><Icon.Down className="icon-sm"/></button>
            <span className="flex-1 text-center">p. {activeCite===1?2:activeCite===2?6:activeCite===3?1:8} / 15</span>
            <button className="icon-btn !w-6 !h-6"><Icon.ZoomOut className="icon-sm"/></button>
            <button className="icon-btn !w-6 !h-6"><Icon.ZoomIn className="icon-sm"/></button>
          </div>
          <div className="flex-1 overflow-auto bg-surface-2 p-4 flex justify-center">
            <PdfPage activeCite={activeCite} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function PdfPage({ activeCite }: { activeCite: number }) {
  if (activeCite === 1) {
    return (
      <div className="pdf-page">
        <div className="text-[7px] text-[#888] mb-2">Vaswani et al., 2017 — page 2</div>
        <h2 className="font-bold text-[14px] leading-[1.2] mb-2.5">3 The Transformer</h2>
        <p className="mb-2">Most competitive neural sequence transduction models have an encoder-decoder structure. Here, the encoder maps an input sequence of symbol representations (x₁, …, xₙ) to a sequence of continuous representations z = (z₁, …, zₙ).</p>
        <p className="mb-2">Given z, the decoder then generates an output sequence (y₁, …, yₘ) of symbols one element at a time. At each step the model is auto-regressive, consuming the previously generated symbols as additional input when generating the next.</p>
        <p className="mb-2"><span className="hl-strong">The Transformer follows this overall architecture using stacked self-attention and point-wise, fully connected layers for both the encoder and decoder.</span></p>
      </div>
    );
  } else if (activeCite === 2) {
    return (
      <div className="pdf-page">
        <div className="text-[7px] text-[#888] mb-2">Vaswani et al., 2017 — page 6</div>
        <h3 className="font-semibold text-[11px] leading-[1.2] mt-3 mb-1.5">Table 1: Maximum path lengths, per-layer complexity and minimum number of sequential operations.</h3>
        <p className="mb-2">As noted in Table 1, a self-attention layer connects all positions with a constant number of sequentially executed operations, whereas a recurrent layer requires O(n) sequential operations.</p>
        <p className="mb-2"><span className="hl-strong">Self-attention layers connect all positions with a constant number of sequentially executed operations.</span></p>
      </div>
    );
  } else if (activeCite === 3) {
    return (
      <div className="pdf-page">
        <div className="text-[7px] text-[#888] mb-2">Vaswani et al., 2017 — page 1</div>
        <h2 className="font-bold text-[14px] leading-[1.2] mb-2.5">1 Introduction</h2>
        <p className="mb-2">Recurrent neural networks, long short-term memory and gated recurrent neural networks in particular, have been firmly established as state of the art approaches in sequence modeling and transduction problems such as language modeling and machine translation.</p>
        <p className="mb-2"><span className="hl-strong">This inherently sequential nature precludes parallelization within training examples, which becomes critical at longer sequence lengths.</span> Memory constraints limit batching across examples.</p>
      </div>
    );
  }
  return (
    <div className="pdf-page">
      <div className="text-[7px] text-[#888] mb-2">Vaswani et al., 2017 — page 8</div>
      <h2 className="font-bold text-[14px] leading-[1.2] mb-2.5">6.1 Machine Translation</h2>
      <p className="mb-2">On the WMT 2014 English-to-German translation task, the big transformer model (Transformer (big) in Table 2) outperforms the best previously reported models (including ensembles) by more than 2.0 BLEU.</p>
      <p className="mb-2"><span className="hl-strong">Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task, improving over the existing best results, including ensembles, by over 2 BLEU.</span></p>
    </div>
  );
}
