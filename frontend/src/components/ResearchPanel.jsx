import { useState } from 'react'
import { discoverPapers, summarizeWork, ingestPaper } from '../api.js'

function authorLabel(authors) {
  if (!authors || authors.length === 0) return 'Unknown'
  return authors[0] + (authors.length > 1 ? ' et al.' : '')
}

function PaperCard({ paper, onAdded }) {
  const [status, setStatus] = useState(null) // null | 'adding' | 'added' | 'error'
  const [errorMsg, setErrorMsg] = useState(null)

  async function add() {
    setStatus('adding')
    setErrorMsg(null)
    try {
      await ingestPaper(paper)
      setStatus('added')
      onAdded?.()
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message)
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
      <div className="flex justify-between gap-3">
        <a href={paper.url} target="_blank" rel="noreferrer"
           className="text-sm font-semibold text-gray-800 hover:text-red-600 leading-snug">
          {paper.title}
        </a>
        <button
          onClick={add}
          disabled={status === 'adding' || status === 'added'}
          className="bg-red-600 text-white rounded-lg px-3 py-1 text-xs font-medium whitespace-nowrap
                     hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed self-start"
        >
          {status === 'added' ? '✓ Added' : status === 'adding' ? '…' : '+ Library'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {authorLabel(paper.authors)} · {paper.year || 'n.d.'} · {paper.source.replace('_', ' ')}
        {paper.citation_count > 0 && ` · ${paper.citation_count} citations`}
      </p>
      {paper.abstract && (
        <p className="text-[0.8rem] text-gray-600 mt-2 line-clamp-3">{paper.abstract}</p>
      )}
      {status === 'error' && (
        <p className="text-xs text-red-500 mt-1">
          Could not add to library{errorMsg ? `: ${errorMsg}` : '.'}
        </p>
      )}
    </div>
  )
}

export default function ResearchPanel({ onLibraryChange }) {
  const [topic, setTopic] = useState('')
  const [papers, setPapers] = useState([])
  const [summary, setSummary] = useState(null) // { summary, references }
  const [discovering, setDiscovering] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [error, setError] = useState(null)

  async function discover() {
    const t = topic.trim()
    if (!t || discovering) return
    setDiscovering(true)
    setError(null)
    setSummary(null)
    setPapers([])
    try {
      setPapers(await discoverPapers(t))
    } catch (err) {
      setError(err.message)
    } finally {
      setDiscovering(false)
    }
  }

  async function summarize() {
    if (!papers.length || summarizing) return
    setSummarizing(true)
    setError(null)
    try {
      setSummary(await summarizeWork(topic.trim(), papers))
    } catch (err) {
      setError(err.message)
    } finally {
      setSummarizing(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {/* Topic search */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && discover()}
          placeholder="Enter a research topic, e.g. retrieval-augmented generation…"
          className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none
                     focus:border-red-400 focus:ring-2 focus:ring-red-100 transition"
        />
        <button
          onClick={discover}
          disabled={discovering || !topic.trim()}
          className="bg-red-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium
                     hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {discovering ? 'Searching…' : 'Find papers'}
        </button>
      </div>

      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

      {/* Grounded summary */}
      {papers.length > 0 && (
        <div className="mb-4">
          <button
            onClick={summarize}
            disabled={summarizing}
            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-40"
          >
            {summarizing ? 'Synthesizing…' : '✨ Summarize recent work'}
          </button>
        </div>
      )}

      {summary && (
        <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm mb-5">
          <p className="text-[0.7rem] font-semibold text-gray-400 uppercase tracking-wider mb-2">Recent work</p>
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{summary.summary}</p>
          {summary.references.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[0.7rem] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">References</p>
              <ol className="text-xs text-gray-500 space-y-1">
                {summary.references.map(r => (
                  <li key={r.index}>
                    [{r.index}]{' '}
                    <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-red-600">
                      {r.title}
                    </a>{' '}
                    ({authorLabel(r.authors)}, {r.year || 'n.d.'})
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Paper cards */}
      <div className="flex flex-col gap-3">
        {papers.map((p, i) => (
          <PaperCard key={p.id || i} paper={p} onAdded={onLibraryChange} />
        ))}
      </div>

      {!discovering && papers.length === 0 && !error && (
        <p className="text-sm text-gray-400 text-center mt-10">
          Search a topic to discover recent papers and a grounded literature summary.
        </p>
      )}
    </div>
  )
}
