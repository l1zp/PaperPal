export interface SSEEvent {
  event?: string;
  data: string;
}

export class SSEParser {
  private buf = "";

  feed(chunk: string): SSEEvent[] {
    this.buf += chunk;
    const out: SSEEvent[] = [];
    let idx: number;
    while ((idx = this.findEventBoundary()) !== -1) {
      const raw = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx).replace(/^(\r\n\r\n|\n\n|\r\r)/, "");
      const ev = parseEvent(raw);
      if (ev) out.push(ev);
    }
    return out;
  }

  private findEventBoundary(): number {
    const candidates = ["\r\n\r\n", "\n\n", "\r\r"];
    let min = -1;
    for (const sep of candidates) {
      const i = this.buf.indexOf(sep);
      if (i !== -1 && (min === -1 || i < min)) min = i;
    }
    return min;
  }

  flush(): SSEEvent | null {
    if (!this.buf.trim()) return null;
    const ev = parseEvent(this.buf);
    this.buf = "";
    return ev;
  }
}

function parseEvent(raw: string): SSEEvent | null {
  const lines = raw.split(/\r\n|\n|\r/);
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "data") dataLines.push(value);
    else if (field === "event") event = value;
  }
  if (!dataLines.length) return null;
  return { event, data: dataLines.join("\n") };
}
