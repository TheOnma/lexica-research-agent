// Point the browser at the API. Override with NEXT_PUBLIC_API_URL when the
// frontend runs elsewhere (e.g. inside docker-compose).
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface Document {
  name: string;
  chunks: number;
  pages: number;
}

export interface Citation {
  source: string;
  page: number;
  score: number;
  text: string;
}

export async function fetchDocuments(): Promise<Document[]> {
  const res = await fetch(`${API_URL}/documents`);
  if (!res.ok) throw new Error("Failed to fetch documents");
  const data = await res.json();
  return data.documents;
}

export async function uploadDocument(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  
  const res = await fetch(`${API_URL}/ingest`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.task_id;
}

export async function pollTask(taskId: string): Promise<boolean> {
  // Returns true when SUCCESS
  let retries = 0;
  while (retries < 60) {
    const res = await fetch(`${API_URL}/task/${taskId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === "SUCCESS") return true;
      if (data.status === "FAILURE") throw new Error("Task failed");
    }
    await new Promise(r => setTimeout(r, 1000));
    retries++;
  }
  throw new Error("Timeout polling task");
}

export async function streamChat(
  question: string,
  onSources: (sources: Citation[]) => void,
  onChunk: (chunk: string) => void,
  onError: (err: string) => void
): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/ask_stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });
    
    if (!res.ok) {
      onError("Failed to connect to chat API");
      return;
    }
    
    const reader = res.body?.getReader();
    const decoder = new TextDecoder("utf-8");
    if (!reader) return;
    
    let buffer = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      
      const parts = buffer.split("\n\n");
      // keep the last part in buffer because it might be incomplete
      buffer = parts.pop() || "";
      
      for (const part of parts) {
        if (part.startsWith("data: ")) {
          try {
            const dataStr = part.slice(6);
            const payload = JSON.parse(dataStr);
            if (payload.type === "sources") {
              onSources(payload.data);
            } else if (payload.type === "text") {
              onChunk(payload.data);
            } else if (payload.type === "error") {
              onError(payload.data);
            }
          } catch (e) {
            console.error("Failed to parse SSE event", part, e);
          }
        }
      }
    }
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err));
  }
}

export async function streamAgentChat(
  message: string,
  onToolStart: (tool: string, input: unknown) => void,
  onToolEnd: (tool: string, output: unknown) => void,
  onChunk: (chunk: string) => void,
  onError: (err: string) => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/agent/chat_stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
      signal
    });
    
    if (!res.ok) {
      onError("Failed to connect to agent API");
      return;
    }
    
    const reader = res.body?.getReader();
    const decoder = new TextDecoder("utf-8");
    if (!reader) return;
    
    let buffer = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      
      for (const part of parts) {
        if (part.startsWith("data: ")) {
          try {
            const dataStr = part.slice(6);
            const payload = JSON.parse(dataStr);
            if (payload.type === "text") {
              onChunk(payload.content);
            } else if (payload.type === "tool_start") {
              onToolStart(payload.tool, payload.input);
            } else if (payload.type === "tool_end") {
              onToolEnd(payload.tool, payload.output);
            } else if (payload.type === "error") {
              onError(payload.content);
            }
          } catch (e) {
            console.error("Failed to parse SSE event", part, e);
          }
        }
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      onError("Stream stopped by user.");
    } else {
      onError(err instanceof Error ? err.message : String(err));
    }
  }
}
