import { ChatMessage } from "./llmClient";
import { ContextMode, PluginConfig } from "./prefs";
import { estimateChars, getCharsPerToken, truncateHeadTail } from "../utils/tokens";

export interface PaperMeta {
  title: string;
  creators: string[];
  abstract: string;
  year: string;
  doi: string;
  itemKey: string;
  libraryID: number;
}

export interface FulltextResult {
  text: string;
  total: number;
  truncated: boolean;
  cut: number;
}

export function getRegularItem(item: Zotero.Item | null | undefined): Zotero.Item | null {
  if (!item) return null;
  if (item.isAttachment() && item.parentItem) return item.parentItem;
  return item.isRegularItem() ? item : null;
}

export function readMeta(item: Zotero.Item): PaperMeta {
  const creators = (item.getCreators() || []).map((c: any) => {
    const last = c.lastName || c.name || "";
    const first = c.firstName || "";
    return [last, first].filter(Boolean).join(", ");
  });
  return {
    title: item.getField("title") || "",
    creators,
    abstract: item.getField("abstractNote") || "",
    year: (item.getField("date") || "").toString().slice(0, 4),
    doi: item.getField("DOI") || "",
    itemKey: item.key,
    libraryID: item.libraryID,
  };
}

export function formatMeta(m: PaperMeta): string {
  const lines = [
    `标题：${m.title}`,
    m.creators.length ? `作者：${m.creators.join("; ")}` : "",
    m.year ? `年份：${m.year}` : "",
    m.doi ? `DOI：${m.doi}` : "",
    m.abstract ? `摘要：${m.abstract}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export async function getFulltext(item: Zotero.Item): Promise<string> {
  const regular = getRegularItem(item);
  if (!regular) return "";
  const attachmentIDs = regular.getAttachments() || [];
  for (const id of attachmentIDs) {
    const att = Zotero.Items.get(id) as Zotero.Item | false;
    if (!att || !att.isAttachment()) continue;
    if (att.attachmentContentType !== "application/pdf") continue;
    try {
      const ftAny = (Zotero as any).Fulltext;
      if (ftAny?.getItemContent) {
        const t = await ftAny.getItemContent(att.id);
        if (t && t.length) return String(t);
      }
    } catch {
      // fall through to attachmentText
    }
    try {
      const txt = await (att as any).attachmentText;
      if (txt && String(txt).length) return String(txt);
    } catch {
      // continue to next attachment
    }
  }
  return "";
}

export async function getFulltextWithBudget(
  item: Zotero.Item,
  maxChars: number,
): Promise<FulltextResult> {
  const raw = await getFulltext(item);
  if (!raw) return { text: "", total: 0, truncated: false, cut: 0 };
  if (raw.length <= maxChars) {
    return { text: raw, total: raw.length, truncated: false, cut: 0 };
  }
  const truncated = truncateHeadTail(raw, maxChars);
  return { text: truncated, total: raw.length, truncated: true, cut: raw.length - maxChars };
}

export interface BuildChatArgs {
  item: Zotero.Item;
  mode: ContextMode;
  summary: string | null;
  userText: string;
  selection?: string;
  history: ChatMessage[];
  cfg: PluginConfig;
}

export async function buildChatPrompt(a: BuildChatArgs): Promise<{
  messages: ChatMessage[];
  fulltext?: FulltextResult;
}> {
  const item = getRegularItem(a.item);
  if (!item) {
    throw new Error("no regular item");
  }
  const meta = readMeta(item);
  const parts: string[] = [formatMeta(meta)];
  if (a.summary) parts.push(`[已生成的论文要点]\n${a.summary}`);

  let fulltext: FulltextResult | undefined;
  if (a.mode === "selection") {
    if (a.selection?.trim()) {
      parts.push(`[选中片段]\n${a.selection.trim()}`);
    }
  } else {
    const budgetChars = estimateChars(a.cfg.maxContextTokens, getCharsPerToken());
    const used = parts.reduce((n, p) => n + p.length, 0);
    const remaining = Math.max(2000, budgetChars - used - 1000);
    fulltext = await getFulltextWithBudget(item, remaining);
    if (fulltext.text) {
      parts.push(`[正文]\n${fulltext.text}`);
    }
  }

  const userBlock = parts.join("\n\n") + `\n\n问题：${a.userText.trim()}`;
  const messages: ChatMessage[] = [
    { role: "system", content: a.cfg.systemPrompt },
    ...a.history,
    { role: "user", content: userBlock },
  ];
  return { messages, fulltext };
}

export async function buildSummaryPrompt(
  item: Zotero.Item,
  cfg: PluginConfig,
): Promise<{ messages: ChatMessage[]; fulltext: FulltextResult }> {
  const regular = getRegularItem(item);
  if (!regular) throw new Error("no regular item");
  const meta = readMeta(regular);
  const budgetChars = estimateChars(cfg.maxContextTokens, getCharsPerToken());
  const ft = await getFulltextWithBudget(regular, Math.max(2000, budgetChars - 1500));
  const body =
    formatMeta(meta) + (ft.text ? `\n\n[正文]\n${ft.text}` : "\n\n（正文未索引，仅依据元数据）");
  const messages: ChatMessage[] = [
    { role: "system", content: cfg.summarySystemPrompt },
    { role: "user", content: body },
  ];
  return { messages, fulltext: ft };
}
