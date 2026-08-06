import { useState, useEffect } from 'react'
import { listDocuments, deleteDocument, ingestPDF, askQuestion } from './api.js'
import Sidebar from './components/Sidebar.jsx'
import Chat from './components/Chat.jsx'
import InputBar from './components/InputBar.jsx'
import ResearchPanel from './components/ResearchPanel.jsx'

export default function App() {
  const [documents, setDocuments] = useState([])
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hello! Upload a PDF and ask me anything about it.', sources: [], contextFound: true }
  ])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('library') // 'library' | 'research'

  useEffect(() => {
    refreshDocuments()
  }, [])

  async function refreshDocuments() {
    try {
      const docs = await listDocuments()
      setDocuments(docs)
    } catch {
      // silently ignore on load
    }
  }

  async function handleUpload(file, setStatus) {
    try {
      const data = await ingestPDF(file)
      setStatus({ text: `✓ ${data.filename} — ${data.chunks_stored} chunks stored`, type: 'success' })
      refreshDocuments()
    } catch (err) {
      setStatus({ text: `✗ ${err.message}`, type: 'error' })
    }
  }

  async function handleDelete(filename) {
    try {
      await deleteDocument(filename)
      refreshDocuments()
    } catch (err) {
      alert(`Could not remove ${filename}: ${err.message}`)
    }
  }

  async function handleAsk(question) {
    setMessages(prev => [...prev, { role: 'user', text: question }])
    setLoading(true)
    try {
      const data = await askQuestion(question)
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: data.answer, sources: data.sources, contextFound: data.context_found }
      ])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: err.message, sources: [], contextFound: false }
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-red-600 text-white px-6 h-14 flex items-center justify-center flex-shrink-0 relative">
        <h1 className="font-semibold text-base tracking-tight">Research Agent</h1>
        <nav className="absolute right-6 flex gap-1 text-xs">
          {[['library', 'Library Q&A'], ['research', 'Research']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3 py-1 rounded-full transition ${
                tab === id ? 'bg-white text-red-600 font-medium' : 'text-white/80 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Documents</h2>
          </div>
          <Sidebar documents={documents} onUpload={handleUpload} onDelete={handleDelete} />
        </aside>

        {/* Main column */}
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          {tab === 'library' ? (
            <>
              <Chat messages={messages} loading={loading} />
              <InputBar onAsk={handleAsk} loading={loading} />
            </>
          ) : (
            <ResearchPanel onLibraryChange={refreshDocuments} />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-red-600 text-white/90 text-center py-2 text-xs flex-shrink-0">
        Made with love ❤️
      </footer>
    </div>
  )
}
