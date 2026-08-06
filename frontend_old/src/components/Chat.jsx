import { useEffect, useRef } from 'react'

function UserBubble({ text }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%]">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-blue-300 text-right mb-1">You</p>
        <div className="bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed">
          {text}
        </div>
      </div>
    </div>
  )
}

function RoseBubble({ text, sources, contextFound }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[75%]">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-gray-400 mb-1">Rose</p>
        <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed text-gray-800 shadow-sm">
          {contextFound === false
            ? <em className="text-gray-400">{text}</em>
            : text}
          {sources && sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[0.7rem] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Sources</p>
              <div className="flex flex-wrap gap-1.5">
                {sources.map((s, i) => (
                  <span key={i} className="bg-gray-50 border border-gray-200 rounded-md px-2 py-0.5 text-[0.72rem] text-gray-500">
                    {s.source} p.{s.page} ({s.score})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Chat({ messages, loading }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
      {messages.map((msg, i) => (
        msg.role === 'user'
          ? <UserBubble key={i} text={msg.text} />
          : <RoseBubble key={i} text={msg.text} sources={msg.sources} contextFound={msg.contextFound} />
      ))}
      {loading && (
        <div className="flex justify-start">
          <div className="max-w-[75%]">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-gray-400 mb-1">Rose</p>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex gap-1 items-center">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
