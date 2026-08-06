import { useState } from 'react'

export default function InputBar({ onAsk, loading }) {
  const [value, setValue] = useState('')

  function submit() {
    const q = value.trim()
    if (!q || loading) return
    setValue('')
    onAsk(q)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="px-6 py-4 border-t border-gray-200 bg-white flex gap-3 flex-shrink-0">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={loading}
        placeholder="Ask a question about your documents…"
        className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none
                   focus:border-red-400 focus:ring-2 focus:ring-red-100 transition disabled:opacity-50"
      />
      <button
        onClick={submit}
        disabled={loading || !value.trim()}
        className="bg-red-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium
                   hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {loading ? '…' : 'Ask →'}
      </button>
    </div>
  )
}
