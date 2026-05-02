const PREFIX = "extensions.zotero.paperpal.";

export type ContextMode = "full" | "selection";

export interface PluginConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxContextTokens: number;
  defaultMode: ContextMode;
  systemPrompt: string;
  summarySystemPrompt: string;
  autoSummarizeOnOpen: boolean;
}

function getStr(key: string, fallback = ""): string {
  const v = Zotero.Prefs.get(PREFIX + key, true);
  return typeof v === "string" ? v : fallback;
}

function getNum(key: string, fallback: number): number {
  const v = Zotero.Prefs.get(PREFIX + key, true);
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string") {
    const p = parseFloat(v);
    if (!isNaN(p)) return p;
  }
  return fallback;
}

function getBool(key: string, fallback: boolean): boolean {
  const v = Zotero.Prefs.get(PREFIX + key, true);
  if (typeof v === "boolean") return v;
  return fallback;
}

export function getConfig(): PluginConfig {
  const mode = getStr("defaultMode", "full");
  return {
    baseUrl: getStr("baseUrl", "https://api.openai.com/v1").replace(/\/+$/, ""),
    apiKey: getStr("apiKey", ""),
    model: getStr("model", "gpt-4o-mini"),
    temperature: getNum("temperature", 0.3),
    maxContextTokens: getNum("maxContextTokens", 12000),
    defaultMode: mode === "selection" ? "selection" : "full",
    systemPrompt: getStr("systemPrompt", ""),
    summarySystemPrompt: getStr("summarySystemPrompt", ""),
    autoSummarizeOnOpen: getBool("autoSummarizeOnOpen", false),
  };
}

export function isConfigured(): boolean {
  const c = getConfig();
  return !!(c.baseUrl && c.apiKey && c.model);
}
