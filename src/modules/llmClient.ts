import { SSEParser } from "../utils/sse";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOpts {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  signal?: AbortSignal;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: string,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

interface WebGlobals {
  fetch: typeof fetch;
  AbortController: typeof AbortController;
  TextDecoder: typeof TextDecoder;
  DOMParser: typeof DOMParser;
}

export function getWebGlobals(): WebGlobals {
  const g: any = globalThis;
  if (typeof g.AbortController === "function" && typeof g.fetch === "function" && typeof g.DOMParser === "function") {
    return {
      fetch: g.fetch.bind(g),
      AbortController: g.AbortController,
      TextDecoder: g.TextDecoder,
      DOMParser: g.DOMParser,
    };
  }
  for (const w of Zotero.getMainWindows()) {
    const wAny = w as any;
    if (typeof wAny.AbortController === "function" && typeof wAny.fetch === "function" && typeof wAny.DOMParser === "function") {
      return {
        fetch: wAny.fetch.bind(wAny),
        AbortController: wAny.AbortController,
        TextDecoder: wAny.TextDecoder,
        DOMParser: wAny.DOMParser,
      };
    }
  }
  throw new Error("Web APIs not available in any window");
}

export function makeAbortController(): AbortController {
  return new (getWebGlobals().AbortController)();
}

async function postChat(o: ChatOpts, stream: boolean, extra: Record<string, unknown> = {}) {
  const { fetch: f } = getWebGlobals();
  const res = await f(`${o.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${o.apiKey}`,
    },
    body: JSON.stringify({
      model: o.model,
      messages: o.messages,
      temperature: o.temperature ?? 0.3,
      stream,
      ...extra,
    }),
    signal: o.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LLMError(`HTTP ${res.status}: ${text || res.statusText}`, res.status, text);
  }
  return res;
}

export async function* streamChat(o: ChatOpts): AsyncGenerator<string, void, void> {
  const res = await postChat(o, true);
  const reader = res.body?.getReader();
  if (!reader) throw new LLMError("Response has no body");
  const { TextDecoder: TD } = getWebGlobals();
  const decoder = new TD("utf-8");
  const parser = new SSEParser();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const events = parser.feed(decoder.decode(value, { stream: true }));
      for (const ev of events) {
        if (ev.data === "[DONE]") return;
        const delta = parseDelta(ev.data);
        if (delta) yield delta;
      }
    }
    const tail = parser.flush();
    if (tail && tail.data !== "[DONE]") {
      const delta = parseDelta(tail.data);
      if (delta) yield delta;
    }
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
}

function parseDelta(data: string): string {
  try {
    const obj = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
    };
    const c = obj.choices?.[0];
    return c?.delta?.content ?? c?.message?.content ?? "";
  } catch {
    return "";
  }
}

export async function chatOnce(o: ChatOpts, maxTokens?: number): Promise<string> {
  const res = await postChat(o, false, maxTokens ? { max_tokens: maxTokens } : {});
  const obj = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return obj.choices?.[0]?.message?.content ?? "";
}
