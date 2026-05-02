import { describe, expect, it } from "vitest";
import { SSEParser } from "./sse";

describe("SSEParser", () => {
  it("parses a single event split across multiple chunks", () => {
    const p = new SSEParser();
    expect(p.feed("data: {\"choi")).toEqual([]);
    expect(p.feed("ces\":[{\"delta\":{\"content\":\"hi\"}}]}\n")).toEqual([]);
    expect(p.feed("\n")).toEqual([{ data: '{"choices":[{"delta":{"content":"hi"}}]}' }]);
  });

  it("parses multiple back-to-back events", () => {
    const p = new SSEParser();
    const events = p.feed(
      'data: {"a":1}\n\ndata: {"b":2}\n\ndata: [DONE]\n\n',
    );
    expect(events.map((e) => e.data)).toEqual(['{"a":1}', '{"b":2}', "[DONE]"]);
  });

  it("supports multi-line data fields", () => {
    const p = new SSEParser();
    const events = p.feed("data: line1\ndata: line2\n\n");
    expect(events).toEqual([{ data: "line1\nline2" }]);
  });

  it("ignores comment lines", () => {
    const p = new SSEParser();
    const events = p.feed(": ping\n\ndata: hello\n\n");
    expect(events.map((e) => e.data)).toEqual(["hello"]);
  });

  it("handles CRLF line endings", () => {
    const p = new SSEParser();
    const events = p.feed("data: x\r\ndata: y\r\n\r\n");
    expect(events).toEqual([{ data: "x\ny" }]);
  });

  it("flush returns trailing buffered event", () => {
    const p = new SSEParser();
    expect(p.feed("data: tail\n")).toEqual([]);
    expect(p.flush()).toEqual({ data: "tail" });
  });
});
