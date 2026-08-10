"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Landing() {
  return (
    <div data-screen-label="Landing">
      {/* NAV */}
      <nav className="sticky top-0 z-50 border-b border-line-2 bg-bg/80 backdrop-blur-xl">
        <div className="container flex items-center h-16">
          <Link className="flex items-center gap-2.5 font-semibold text-[17px] tracking-tight text-ink no-underline" href="/">
            <span className="flex items-center justify-center w-[26px] h-[26px] rounded-[7px] bg-ink text-bg font-bold text-[14px] tracking-[-0.04em]">L</span>
            <span>Lexica</span>
          </Link>
          <div className="flex gap-1 ml-2">
            <a href="#features" className="px-3 py-2 font-medium text-[14px] text-ink-2 no-underline rounded-lg hover:bg-surface-2 hover:text-ink">Features</a>
            <a href="#how" className="px-3 py-2 font-medium text-[14px] text-ink-2 no-underline rounded-lg hover:bg-surface-2 hover:text-ink">How it works</a>
          </div>
          <div className="flex-1"></div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link className="btn btn-primary btn-sm" href="/chat">
              Open app <Icon.ArrowRight className="icon-sm" />
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden pt-20 pb-10">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <span className="inline-flex items-center gap-2.5 py-1.5 pr-3 pl-1.5 rounded-full bg-surface border border-line font-medium text-[12.5px] text-ink-2 shadow-[var(--shadow)]">
                <span className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-accent text-white font-bold text-[10px]"><Icon.Sparkle className="icon-sm" /></span>
                Powered by LangGraph Agent Architecture
              </span>
              <h1 className="mt-6 text-[clamp(44px,6vw,80px)] leading-[1.02] tracking-[-0.035em] text-ink font-semibold text-balance">
                Your autonomous AI<br />
                <em className="font-display italic font-normal text-accent-ink tracking-[-0.01em]">research assistant.</em>
              </h1>
              <p className="mt-6 text-[19px] leading-[1.55] text-muted max-w-[640px] text-pretty">
                Lexica discovers recent papers across arXiv and Semantic Scholar, reads your local library, and synthesizes answers you can cite. Built for researchers and students who refuse to guess.
              </p>
              <div className="flex items-center gap-3 mt-8">
                <Link className="btn btn-primary" href="/chat">
                  Open Workspace <Icon.ArrowRight className="icon-sm" />
                </Link>
                <a className="btn btn-ghost" href="#how">See how it works</a>
              </div>
              <div className="flex items-center gap-[18px] mt-6 text-muted font-medium text-[13px]">
                <span className="flex items-center gap-2"><span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-ok text-white font-bold text-[9px]"><Icon.Check className="w-2.5 h-2.5" /></span> Open Source</span>
                <span className="flex items-center gap-2"><span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-ok text-white font-bold text-[9px]"><Icon.Check className="w-2.5 h-2.5" /></span> Local & Private</span>
                <span className="flex items-center gap-2"><span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-ok text-white font-bold text-[9px]"><Icon.Check className="w-2.5 h-2.5" /></span> Grounded Citations</span>
              </div>
            </div>

            {/* preview card */}
            <div className="mt-14 lg:mt-0 border border-line rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-lg)] overflow-hidden relative" aria-hidden="true">
              <div className="flex items-center gap-2 h-9 px-3.5 border-b border-line-2 bg-surface-2">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-line" /><span className="w-2.5 h-2.5 rounded-full bg-line" /><span className="w-2.5 h-2.5 rounded-full bg-line" />
                </div>
                <div className="flex items-center gap-1.5 flex-1 h-[22px] ml-2 px-2.5 rounded-md bg-surface border border-line font-mono font-medium text-[12px] text-muted">
                  <Icon.Lock className="w-3.5 h-3.5" />
                  <span>lexica.local /workspace/research</span>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_280px] min-h-[460px]">
                {/* mini chat */}
                <div className="flex flex-col gap-[18px] p-5 bg-bg border-r border-line-2">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-line flex items-center justify-center text-[11px] font-bold">U</div>
                    <div className="flex-1 bg-surface-2 p-3 rounded-xl rounded-tl-none border border-line text-[13px]">
                      Can you find some recent papers on arXiv about Q-Star algorithms?
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-[11px] font-bold"><Icon.Sparkle className="w-4 h-4"/></div>
                    <div className="flex-1 bg-surface p-3 rounded-xl rounded-tl-none border border-line text-[13.5px] leading-[1.6]">
                      I couldn&apos;t find direct papers on Q-Star, but here are related topics you could search for:
                      <ol className="mt-2 pl-4 space-y-1">
                        <li>Process Reward Models (PRMs)</li>
                        <li>Monte Carlo Tree Search (MCTS) + LLMs</li>
                        <li>Let&apos;s Verify Step by Step</li>
                      </ol>
                    </div>
                  </div>
                </div>
                {/* mini docs panel */}
                <div className="p-3 bg-surface">
                  <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-3">Workspace Library</div>
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-surface-2 border border-line cursor-pointer mb-2">
                    <div className="w-8 h-8 bg-red-100 text-red-600 rounded flex items-center justify-center text-[10px] font-bold">PDF</div>
                    <div>
                      <div className="text-[12px] font-medium truncate w-[180px]">Attention is All You Need.pdf</div>
                      <div className="text-[11px] text-muted">15 pages</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-2 border border-transparent cursor-pointer mb-2">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded flex items-center justify-center text-[10px] font-bold">DOCX</div>
                    <div>
                      <div className="text-[12px] font-medium truncate w-[180px]">Lit Review draft.docx</div>
                      <div className="text-[11px] text-muted">24 pages</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24 border-t border-line-2" id="features">
        <div className="container">
          <span className="font-mono font-medium text-[12px] tracking-[0.06em] uppercase text-accent-ink">Features</span>
          <h2 className="mt-4 text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.03em] font-semibold max-w-[720px] text-balance">
            Built for research that <em className="font-display italic font-normal text-accent-ink">cannot</em> afford to be wrong.
          </h2>
          <p className="mt-4 text-[18px] leading-[1.5] text-muted max-w-[600px]">
            Every answer ships with the exact source. Every paper is pulled directly from scientific databases.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-line-2 mt-14 border border-line-2 rounded-[var(--radius-lg)] overflow-hidden">
            {[
              { i: <Icon.Globe />, t: "Global Discovery", d: "Agents autonomously search arXiv and Semantic Scholar to find the most relevant, recent literature for your query." },
              { i: <Icon.Cite />, t: "Inline Citations", d: "Click any number in an answer to jump to the exact paragraph in your local PDF." },
              { i: <Icon.Stack />, t: "Hybrid Retrieval", d: "Dense vector search + BM25 keyword matching, fused with Reciprocal Rank Fusion." },
              { i: <Icon.Sparkle />, t: "LangGraph Agents", d: "Stateful agents reason about your question, use tools, and analyze results before answering." },
              { i: <Icon.Lock />, t: "Local Privacy", d: "Your documents are stored in local ChromaDB. No training on your data, ever." },
              { i: <Icon.Bolt />, t: "Streaming SSE", d: "Sub-second retrieval over thousands of pages. Answers stream directly into the UI." },
            ].map((f, i) => (
              <div key={i} className="p-8 bg-surface flex flex-col gap-3 min-h-[220px]">
                <div className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-accent-soft text-accent-ink">{f.i}</div>
                <h3 className="m-0 font-semibold text-[17px] leading-[1.3] tracking-[-0.01em]">{f.t}</h3>
                <p className="m-0 text-muted text-[14.5px] leading-[1.55]">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 border-t border-line-2" id="how">
        <div className="container">
          <span className="font-mono font-medium text-[12px] tracking-[0.06em] uppercase text-accent-ink">How it works</span>
          <h2 className="mt-4 text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.03em] font-semibold">
            From query to <em className="font-display italic font-normal text-accent-ink">cited</em> synthesis.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-14">
            {[
              { n: "01", t: "Ask", d: "Ask the agent a research question. It determines if it needs to search the web or your local library." },
              { n: "02", t: "Discover", d: "The agent queries Semantic Scholar and arXiv, ranking papers by impact and recency." },
              { n: "03", t: "Retrieve", d: "Hybrid search pulls the most relevant chunks across all your local documents." },
              { n: "04", t: "Verify", d: "Read the synthesis, click any citation, and jump directly to the highlighted source." },
            ].map((s) => (
              <div key={s.n} className="flex flex-col gap-3 pt-6 border-t border-ink">
                <div className="font-mono font-medium text-[12px] text-muted">{s.n}</div>
                <h4 className="m-0 font-semibold text-[18px] leading-[1.25] tracking-[-0.01em]">{s.t}</h4>
                <p className="m-0 text-muted text-[14px] leading-[1.55]">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-line-2">
        <div className="container">
          <div className="text-center flex flex-col items-center">
            <h2 className="text-[clamp(36px,5vw,60px)] leading-[1.05] font-semibold tracking-[-0.03em]">Stop hunting for the right page.<br /><em className="font-display italic font-normal text-accent-ink">Just ask.</em></h2>
            <p className="mt-6 text-[19px] text-muted">Initialize the workspace and run the agent locally.</p>
            <Link className="btn btn-primary mt-8" href="/chat">
              Open Workspace <Icon.ArrowRight className="icon-sm" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line-2 py-8">
        <div className="container flex justify-between items-center text-[14px] text-muted">
          <div>© {new Date().getFullYear()} Lexica. Open source research agent.</div>
          <div className="flex gap-5">
            <a href="https://github.com" target="_blank" rel="noreferrer" className="text-inherit no-underline hover:text-ink">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
