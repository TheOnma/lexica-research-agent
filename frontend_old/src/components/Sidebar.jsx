import { useRef, useState } from 'react'

export default function Sidebar({ documents, onUpload, onDelete }) {
  const fileInputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [status, setStatus] = useState({ text: '', type: '' })

  const ACCEPTED = ['.pdf', '.docx', '.txt']

  function handleFiles(files) {
    const file = files[0]
    if (!file) return
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!ACCEPTED.includes(ext)) {
      setStatus({ text: 'Supported formats: PDF, DOCX, TXT.', type: 'error' })
      return
    }
    setStatus({ text: 'Uploading…', type: '' })
    onUpload(file, setStatus)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Upload zone */}
      <div className="p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          hidden
          onChange={e => { if (e.target.files[0]) handleFiles(e.target.files); e.target.value = '' }}
        />
        <div
          onClick={() => fileInputRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
          className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors
            ${dragOver ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-red-400 hover:bg-red-50'}`}
        >
          <div className="text-3xl mb-2">📄</div>
          <p className="text-sm text-gray-500">
            Drop a file here or <strong className="text-gray-700">click to browse</strong>
            <br /><span className="text-[0.7rem] text-gray-400">PDF, DOCX, TXT</span>
          </p>
        </div>
        <p className={`text-xs mt-2 min-h-[1.25rem] ${status.type === 'error' ? 'text-red-500' : status.type === 'success' ? 'text-green-600' : 'text-gray-400'}`}>
          {status.text}
        </p>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Uploaded</p>
        {documents.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No documents yet.</p>
        ) : (
          <ul className="space-y-1">
            {documents.map(doc => (
              <li key={doc} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <span className="text-base">📄</span>
                <span className="flex-1 truncate text-xs">{doc}</span>
                <button
                  onClick={() => onDelete(doc)}
                  className="text-gray-400 hover:text-red-500 transition-colors text-xs leading-none"
                  title="Remove document"
                >✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
