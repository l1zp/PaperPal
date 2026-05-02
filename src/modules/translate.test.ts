import { describe, expect, it } from "vitest";
import { buildTranslatePrompt, stripSpecialTokens } from "./translate";

describe("buildTranslatePrompt", () => {
  it("emits a single user message with no system prompt", () => {
    const msgs = buildTranslatePrompt("hello world", "zh-CN");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");
  });

  it("uses Chinese template when target is Chinese", () => {
    const msgs = buildTranslatePrompt("hello", "zh-CN");
    expect(msgs[0].content).toContain("把下面的文本翻译成中文");
    expect(msgs[0].content).toContain("不要额外解释");
    expect(msgs[0].content).toContain("hello");
  });

  it("uses English template when target is non-Chinese", () => {
    const msgs = buildTranslatePrompt("你好世界", "en");
    expect(msgs[0].content).toContain("Translate the following segment into English");
    expect(msgs[0].content).toContain("without additional explanation");
    expect(msgs[0].content).toContain("你好世界");
  });

  it("supports Japanese / Korean / French targets", () => {
    expect(buildTranslatePrompt("foo", "ja")[0].content).toContain("Japanese");
    expect(buildTranslatePrompt("foo", "ko")[0].content).toContain("Korean");
    expect(buildTranslatePrompt("foo", "fr")[0].content).toContain("French");
  });

  it("preserves multi-line text in the prompt", () => {
    const text = "line one\nline two\nline three";
    const msgs = buildTranslatePrompt(text, "zh-CN");
    expect(msgs[0].content).toContain(text);
  });
});

describe("stripSpecialTokens", () => {
  it("removes Hunyuan-MT trailing placeholder tokens", () => {
    const s = "大型语言模型彻底改变了自然语言处理领域。<|hy_place▁holder▁no▁2|>";
    expect(stripSpecialTokens(s)).toBe("大型语言模型彻底改变了自然语言处理领域。");
  });

  it("strips multiple chat-template tokens", () => {
    const s = "<|im_start|>hello<|im_end|>";
    expect(stripSpecialTokens(s)).toBe("hello");
  });

  it("trims whitespace after stripping", () => {
    expect(stripSpecialTokens("foo  <|end|>  ")).toBe("foo");
  });

  it("leaves normal text untouched", () => {
    expect(stripSpecialTokens("just text")).toBe("just text");
  });
});
