import { describe, expect, it } from "vitest";
import { estimateChars, truncateHeadTail } from "./tokens";

describe("tokens", () => {
  it("estimateChars multiplies tokens by ratio", () => {
    expect(estimateChars(1000, 3)).toBe(3000);
    expect(estimateChars(0, 3)).toBe(0);
    expect(estimateChars(-5, 3)).toBe(0);
  });

  it("returns text unchanged when within budget", () => {
    const t = "hello world";
    expect(truncateHeadTail(t, 100)).toBe(t);
  });

  it("preserves head and tail when truncating", () => {
    const text = "AAAAAAAAAA" + "B".repeat(1000) + "ZZZZZZZZZZ";
    const out = truncateHeadTail(text, 100);
    expect(out.length).toBeLessThanOrEqual(100 + 64);
    expect(out.startsWith("AAAAAAAAAA")).toBe(true);
    expect(out.endsWith("ZZZZZZZZZZ")).toBe(true);
    expect(out).toMatch(/已截断/);
  });

  it("returns empty string when budget is zero", () => {
    expect(truncateHeadTail("anything", 0)).toBe("");
  });
});
