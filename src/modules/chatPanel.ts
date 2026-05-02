import { ChatMessage, LLMError, getWebGlobals, makeAbortController, streamChat } from "./llmClient";
import {
  buildChatPrompt,
  buildSummaryPrompt,
  getRegularItem,
} from "./contextBuilder";
import { ContextMode, getConfig, isConfigured } from "./prefs";
import { SummaryStore } from "./summaryStore";
import { renderMarkdown } from "./markdown";
import { getString } from "../utils/locale";

interface ChatSession {
  itemKey: string | null;
  history: ChatMessage[];
  mode: ContextMode;
  abort: AbortController | null;
  streaming: boolean;
}

interface PanelHandles {
  root: HTMLElement;
  modeSelect: HTMLSelectElement;
  summarizeBtn: HTMLButtonElement;
  clearBtn: HTMLButtonElement;
  stopBtn: HTMLButtonElement;
  status: HTMLElement;
  summaryWrap: HTMLElement;
  summaryBody: HTMLElement;
  summaryToggle: HTMLButtonElement;
  messages: HTMLElement;
  textarea: HTMLTextAreaElement;
  sendBtn: HTMLButtonElement;
  session: ChatSession;
  currentItem: Zotero.Item | null;
}

const SECTION_ID = "paperpal-chat";
const PANELS = new WeakMap<HTMLElement, PanelHandles>();

export class ChatPanel {
  private store: SummaryStore;
  private registered = false;

  constructor(store: SummaryStore) {
    this.store = store;
  }

  register(): void {
    if (this.registered) return;
    const mgr = (Zotero as any).ItemPaneManager;
    const reader = (Zotero as any).Reader;

    const sectionDef = {
      paneID: SECTION_ID,
      pluginID: "paperpal@local",
      header: { l10nID: "paperpal-sidebar-label", icon: "chrome://paperpal/content/icons/favicon.png" },
      sidenav: { l10nID: "paperpal-sidebar-tooltip", icon: "chrome://paperpal/content/icons/favicon.png" },
      onRender: ({ body, item }: { body: HTMLElement; item: Zotero.Item }) => {
        this.renderInto(body, item);
      },
      onItemChange: ({ body, item }: { body: HTMLElement; item: Zotero.Item }) => {
        const h = PANELS.get(body);
        if (h) this.bindItem(h, item);
      },
      onDestroy: ({ body }: { body: HTMLElement }) => {
        const h = PANELS.get(body);
        if (h?.session.abort) h.session.abort.abort();
        PANELS.delete(body);
      },
    };

    if (reader?.registerSidebarSection) {
      reader.registerSidebarSection(sectionDef);
    } else if (mgr?.registerReaderSidebarSection) {
      mgr.registerReaderSidebarSection(sectionDef);
    } else if (mgr?.registerSection) {
      mgr.registerSection(sectionDef);
    } else {
      Zotero.debug("[PaperPal] no compatible sidebar API available");
      return;
    }
    this.registered = true;
  }

  unregister(): void {
    if (!this.registered) return;
    const mgr = (Zotero as any).ItemPaneManager;
    const reader = (Zotero as any).Reader;
    try {
      reader?.unregisterSidebarSection?.(SECTION_ID);
      mgr?.unregisterReaderSidebarSection?.(SECTION_ID);
      mgr?.unregisterSection?.(SECTION_ID);
    } catch (e) {
      Zotero.debug(`[PaperPal] unregister failed: ${e}`);
    }
    this.registered = false;
  }

  private renderInto(body: HTMLElement, item: Zotero.Item): void {
    const doc = body.ownerDocument!;
    body.innerHTML = "";

    const linkID = "paperpal-style";
    if (!doc.getElementById(linkID)) {
      const link = doc.createElementNS("http://www.w3.org/1999/xhtml", "link") as HTMLLinkElement;
      link.id = linkID;
      link.rel = "stylesheet";
      link.href = "chrome://paperpal/content/styles/chatPanel.css";
      doc.documentElement.appendChild(link);
    }

    const cfg = getConfig();
    const root = el(doc, "div", "pp-root");

    // Header
    const head = el(doc, "div", "pp-head");
    const modeSelect = html<HTMLSelectElement>(doc, "select", "pp-mode");
    [
      { v: "full", k: "paperpal-mode-full" },
      { v: "selection", k: "paperpal-mode-selection" },
    ].forEach(({ v, k }) => {
      const opt = html<HTMLOptionElement>(doc, "option");
      opt.value = v;
      opt.textContent = getString(k);
      if (v === cfg.defaultMode) opt.selected = true;
      modeSelect.appendChild(opt);
    });
    const summarizeBtn = html<HTMLButtonElement>(doc, "button");
    summarizeBtn.textContent = getString("paperpal-btn-summarize");
    const clearBtn = html<HTMLButtonElement>(doc, "button");
    clearBtn.textContent = getString("paperpal-btn-clear");
    const stopBtn = html<HTMLButtonElement>(doc, "button");
    stopBtn.textContent = getString("paperpal-btn-stop");
    stopBtn.hidden = true;
    const spacer = el(doc, "div", "pp-spacer");
    const status = el(doc, "div", "pp-status");
    head.append(modeSelect, summarizeBtn, clearBtn, stopBtn, spacer, status);

    // Summary
    const summaryWrap = el(doc, "div", "pp-summary");
    summaryWrap.hidden = true;
    const summaryTitle = el(doc, "div", "pp-summary-title");
    summaryTitle.textContent = getString("paperpal-summary-title");
    const summaryToggle = html<HTMLButtonElement>(doc, "button", "pp-summary-toggle");
    summaryToggle.textContent = "−";
    summaryTitle.appendChild(summaryToggle);
    const summaryBody = el(doc, "div", "pp-summary-body");
    summaryWrap.append(summaryTitle, summaryBody);

    // Messages
    const messages = el(doc, "div", "pp-messages");

    // Footer
    const footer = el(doc, "div", "pp-input");
    const textarea = html<HTMLTextAreaElement>(doc, "textarea");
    textarea.setAttribute("placeholder", getString("paperpal-input-placeholder"));
    textarea.rows = 2;
    const sendBtn = html<HTMLButtonElement>(doc, "button");
    sendBtn.textContent = getString("paperpal-btn-send");
    footer.append(textarea, sendBtn);

    root.append(head, summaryWrap, messages, footer);
    body.appendChild(root);

    const session: ChatSession = {
      itemKey: null,
      history: [],
      mode: cfg.defaultMode,
      abort: null,
      streaming: false,
    };
    const handles: PanelHandles = {
      root,
      modeSelect,
      summarizeBtn,
      clearBtn,
      stopBtn,
      status,
      summaryWrap,
      summaryBody,
      summaryToggle,
      messages,
      textarea,
      sendBtn,
      session,
      currentItem: null,
    };
    PANELS.set(body, handles);
    this.wireEvents(handles);
    this.bindItem(handles, item);
  }

  private wireEvents(h: PanelHandles): void {
    h.modeSelect.addEventListener("change", () => {
      h.session.mode = h.modeSelect.value as ContextMode;
    });
    h.clearBtn.addEventListener("click", () => {
      h.session.history = [];
      h.messages.innerHTML = "";
      this.renderEmptyHint(h);
    });
    h.stopBtn.addEventListener("click", () => {
      h.session.abort?.abort();
    });
    h.summarizeBtn.addEventListener("click", () => void this.handleSummarize(h));
    h.sendBtn.addEventListener("click", () => void this.handleSend(h));
    h.textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.handleSend(h);
      }
    });
    h.textarea.addEventListener("input", () => autosize(h.textarea));
    h.summaryToggle.addEventListener("click", () => {
      const collapsed = h.summaryWrap.classList.toggle("collapsed");
      h.summaryToggle.textContent = collapsed ? "+" : "−";
    });
  }

  private bindItem(h: PanelHandles, item: Zotero.Item | null): void {
    const regular = getRegularItem(item);
    h.currentItem = regular;
    if (h.session.abort) {
      h.session.abort.abort();
      h.session.abort = null;
    }
    if (!regular) {
      h.session.itemKey = null;
      h.session.history = [];
      h.messages.innerHTML = "";
      h.summaryWrap.hidden = true;
      h.status.textContent = getString("paperpal-status-no-item");
      return;
    }
    const newKey = `${regular.libraryID}:${regular.key}`;
    if (h.session.itemKey !== newKey) {
      h.session.itemKey = newKey;
      h.session.history = [];
      h.messages.innerHTML = "";
    }
    this.refreshSummaryView(h, regular);
    h.status.textContent = "";
    if (!h.messages.childElementCount) this.renderEmptyHint(h);
  }

  private refreshSummaryView(h: PanelHandles, item: Zotero.Item): void {
    const rec = this.store.get(item);
    if (rec) {
      h.summaryWrap.hidden = false;
      setHTML(h.summaryBody, renderMarkdown(rec.text));
      h.summarizeBtn.textContent = getString("paperpal-btn-resummarize");
    } else {
      h.summaryWrap.hidden = true;
      h.summaryBody.innerHTML = "";
      h.summarizeBtn.textContent = getString("paperpal-btn-summarize");
    }
  }

  private renderEmptyHint(h: PanelHandles): void {
    h.messages.innerHTML = "";
    const empty = el(h.messages.ownerDocument!, "div", "pp-empty");
    empty.textContent = "提问关于这篇论文的任何问题。";
    h.messages.appendChild(empty);
  }

  private async handleSummarize(h: PanelHandles): Promise<void> {
    if (h.session.streaming) return;
    if (!h.currentItem) {
      h.status.textContent = getString("paperpal-status-no-item");
      return;
    }
    if (!isConfigured()) {
      h.status.textContent = getString("paperpal-status-config-missing");
      return;
    }
    const cfg = getConfig();
    const ctrl = makeAbortController();
    h.session.abort = ctrl;
    h.session.streaming = true;
    this.toggleBusy(h, true);
    h.status.textContent = getString("paperpal-summary-generating");
    h.summaryWrap.hidden = false;
    h.summaryWrap.classList.remove("collapsed");
    h.summaryToggle.textContent = "−";
    h.summaryBody.innerHTML = "";
    let acc = "";
    try {
      const { messages, fulltext } = await buildSummaryPrompt(h.currentItem, cfg);
      if (fulltext.truncated) {
        h.status.textContent = getString("paperpal-status-truncated", {
          head: fulltext.text.length,
          total: fulltext.total,
        });
      } else if (!fulltext.text) {
        h.status.textContent = getString("paperpal-status-no-fulltext");
      }
      for await (const delta of streamChat({
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        model: cfg.model,
        messages,
        temperature: cfg.temperature,
        signal: ctrl.signal,
      })) {
        acc += delta;
        setHTML(h.summaryBody, renderMarkdown(acc));
      }
      if (acc.trim()) {
        this.store.set(h.currentItem, acc, cfg.model);
        h.summarizeBtn.textContent = getString("paperpal-btn-resummarize");
        h.status.textContent = "";
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setHTML(
          h.summaryBody,
          renderMarkdown(`**${getString("paperpal-error-prefix")}**: ${formatError(e)}`),
        );
        h.status.textContent = "";
      } else {
        h.status.textContent = "";
      }
    } finally {
      h.session.streaming = false;
      h.session.abort = null;
      this.toggleBusy(h, false);
    }
  }

  private async handleSend(h: PanelHandles): Promise<void> {
    if (h.session.streaming) return;
    const text = h.textarea.value.trim();
    if (!text || !h.currentItem) return;
    if (!isConfigured()) {
      h.status.textContent = getString("paperpal-status-config-missing");
      return;
    }
    const cfg = getConfig();

    let selection = "";
    if (h.session.mode === "selection") {
      selection = await getReaderSelection(h.currentItem);
      if (!selection.trim()) {
        h.status.textContent = getString("paperpal-status-no-selection");
        return;
      }
    }

    if (h.messages.querySelector(".pp-empty")) h.messages.innerHTML = "";

    h.textarea.value = "";
    autosize(h.textarea);

    this.appendBubble(h, "user", text);
    const assistantBubble = this.appendBubble(h, "assistant", "");

    const summaryRec = this.store.get(h.currentItem);
    const ctrl = makeAbortController();
    h.session.abort = ctrl;
    h.session.streaming = true;
    this.toggleBusy(h, true);
    h.status.textContent = "";

    let acc = "";
    try {
      const { messages, fulltext } = await buildChatPrompt({
        item: h.currentItem,
        mode: h.session.mode,
        summary: summaryRec?.text ?? null,
        userText: text,
        selection,
        history: h.session.history,
        cfg,
      });
      if (fulltext?.truncated) {
        h.status.textContent = getString("paperpal-status-truncated", {
          head: fulltext.text.length,
          total: fulltext.total,
        });
      }
      for await (const delta of streamChat({
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        model: cfg.model,
        messages,
        temperature: cfg.temperature,
        signal: ctrl.signal,
      })) {
        acc += delta;
        setHTML(assistantBubble.querySelector(".pp-md")!, renderMarkdown(acc));
        h.messages.scrollTop = h.messages.scrollHeight;
      }
      h.session.history.push({ role: "user", content: text });
      h.session.history.push({ role: "assistant", content: acc });
      if (h.session.history.length > 20) h.session.history.splice(0, h.session.history.length - 20);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        assistantBubble.classList.remove("pp-assistant");
        assistantBubble.classList.add("pp-error");
        setHTML(
          assistantBubble.querySelector(".pp-md")!,
          renderMarkdown(`**${getString("paperpal-error-prefix")}**: ${formatError(e)}`),
        );
      } else if (!acc.trim()) {
        assistantBubble.remove();
      }
    } finally {
      h.session.streaming = false;
      h.session.abort = null;
      this.toggleBusy(h, false);
    }
  }

  private appendBubble(h: PanelHandles, role: "user" | "assistant", initial: string): HTMLElement {
    const doc = h.messages.ownerDocument!;
    const bubble = el(doc, "div", `pp-msg pp-${role}`);
    if (role === "assistant") {
      const md = el(doc, "div", "pp-md");
      setHTML(md, renderMarkdown(initial));
      bubble.appendChild(md);
    } else {
      bubble.textContent = initial;
    }
    h.messages.appendChild(bubble);
    h.messages.scrollTop = h.messages.scrollHeight;
    return bubble;
  }

  private toggleBusy(h: PanelHandles, busy: boolean): void {
    h.stopBtn.hidden = !busy;
    h.sendBtn.disabled = busy;
    h.summarizeBtn.disabled = busy;
    h.clearBtn.disabled = busy;
  }
}

const XHTML_NS = "http://www.w3.org/1999/xhtml";

function html<E extends HTMLElement = HTMLElement>(
  doc: Document,
  tag: string,
  className?: string,
): E {
  const e = doc.createElementNS(XHTML_NS, tag) as unknown as E;
  if (className) e.className = className;
  return e;
}

function el(doc: Document, tag: string, className: string): HTMLElement {
  return html(doc, tag, className);
}

function setHTML(target: Element, htmlSrc: string): void {
  const doc = target.ownerDocument!;
  while (target.firstChild) target.removeChild(target.firstChild);
  if (!htmlSrc) return;
  try {
    const Parser = getWebGlobals().DOMParser;
    const parsed = new Parser().parseFromString(`<div>${htmlSrc}</div>`, "text/html");
    const root = parsed.body.firstElementChild;
    if (root) {
      for (const node of Array.from(root.childNodes)) {
        target.appendChild(doc.importNode(node as Node, true));
      }
    }
  } catch (e) {
    Zotero.debug(`[PaperPal] setHTML failed: ${e}`);
    target.textContent = htmlSrc.replace(/<[^>]+>/g, "");
  }
}

function autosize(t: HTMLTextAreaElement): void {
  t.style.height = "auto";
  t.style.height = Math.min(t.scrollHeight, 120) + "px";
}

async function getReaderSelection(item: Zotero.Item): Promise<string> {
  try {
    const reader = (Zotero as any).Reader;
    if (!reader?.getByTabID) return "";
    const tabsAny = (globalThis as any).Zotero_Tabs;
    const tabID = tabsAny?.selectedID;
    if (!tabID) return "";
    const r = reader.getByTabID(tabID);
    if (!r) return "";
    const ownerKey = r.itemID
      ? Zotero.Items.get(r.itemID)?.key
      : null;
    if (ownerKey && ownerKey !== item.key) {
      const parent = (Zotero.Items.get(r.itemID) as Zotero.Item | undefined)?.parentItem;
      if (parent && parent.key !== item.key) return "";
    }
    if (typeof r.getSelectedText === "function") {
      const t = await r.getSelectedText();
      if (typeof t === "string") return t;
    }
    if (r._iframeWindow?.getSelection) {
      return r._iframeWindow.getSelection().toString();
    }
  } catch (e) {
    Zotero.debug(`[PaperPal] getReaderSelection failed: ${e}`);
  }
  return "";
}

function formatError(e: unknown): string {
  if (e instanceof LLMError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}
