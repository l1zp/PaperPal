/* eslint-disable no-undef */
pref("baseUrl", "https://api.openai.com/v1");
pref("apiKey", "");
pref("model", "gpt-4o-mini");
pref("temperature", "0.3");
pref("maxContextTokens", 12000);
pref("defaultMode", "full");
pref("autoSummarizeOnOpen", false);
pref(
  "systemPrompt",
  "你是一名严谨的中文学术阅读助手。回答必须基于提供的论文内容；引用原文时使用引号；不确定时直说不知道。优先用中文，如保留原文术语请括注英文。",
);
pref(
  "summarySystemPrompt",
  "你是一名严谨的中文学术阅读助手。请基于用户提供的论文，用中文按以下结构提炼要点：研究问题 / 方法 / 主要结论 / 局限与未来方向 / 关键术语。每节用 Markdown 列表呈现，不要超过 600 字。",
);
pref("charsPerToken", "3");
