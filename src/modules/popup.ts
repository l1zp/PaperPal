import { LLMError } from "./llmClient";
import { getTranslateConfig, isTranslateConfigured } from "./prefs";
import { translate } from "./translate";
import { getString } from "../utils/locale";

const XHTML_NS = "http://www.w3.org/1999/xhtml";
const PLUGIN_ID = "paperpal@local";

interface PopupEvent {
  reader?: any;
  doc: Document;
  params: { annotation?: { text?: string } };
  append: (node: Element) => void;
}

export class TranslatePopup {
  private handler = this.onRender.bind(this);
  private registered = false;

  register(): void {
    if (this.registered) return;
    const reader = (Zotero as any).Reader;
    if (!reader?.registerEventListener) {
      Zotero.debug("[PaperPal] Reader.registerEventListener unavailable");
      return;
    }
    try {
      reader.registerEventListener("renderTextSelectionPopup", this.handler, PLUGIN_ID);
      this.registered = true;
    } catch (e) {
      Zotero.debug(`[PaperPal] popup register failed: ${e}`);
    }
  }

  unregister(): void {
    if (!this.registered) return;
    const reader = (Zotero as any).Reader;
    try {
      reader?.unregisterEventListener?.("renderTextSelectionPopup", this.handler);
    } catch (e) {
      Zotero.debug(`[PaperPal] popup unregister failed: ${e}`);
    }
    this.registered = false;
  }

  private onRender(event: PopupEvent): void {
    const text = event.params?.annotation?.text?.trim();
    if (!text) return;
    const doc = event.doc;
    this.injectStyle(doc);

    const root = doc.createElementNS(XHTML_NS, "div") as HTMLDivElement;
    root.className = "pp-translate-popup";
    root.setAttribute(
      "style",
      "display:flex;flex-direction:column;gap:6px;padding:6px 4px;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;font-size:12px;max-width:360px;",
    );

    const btn = doc.createElementNS(XHTML_NS, "button") as HTMLButtonElement;
    btn.className = "pp-translate-btn";
    btn.textContent = getString("paperpal-btn-translate");
    btn.title = getString("paperpal-btn-translate");
    btn.setAttribute(
      "style",
      "align-self:flex-start;padding:4px 12px;font-size:12px;background:#7B3EE8;color:#fff;border:1px solid #6A2DD0;border-radius:4px;cursor:pointer;font-weight:500;",
    );

    const result = doc.createElementNS(XHTML_NS, "div") as HTMLDivElement;
    result.className = "pp-translate-result";
    result.hidden = true;
    result.setAttribute(
      "style",
      "background:rgba(123,62,232,0.08);border-left:3px solid #7B3EE8;padding:6px 8px;border-radius:3px;max-height:220px;overflow:auto;line-height:1.55;white-space:pre-wrap;word-wrap:break-word;display:flex;flex-direction:column;gap:6px;color:#222;",
    );

    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      if (!isTranslateConfigured()) {
        showError(result, doc, getString("paperpal-translate-not-configured"));
        return;
      }
      btn.disabled = true;
      btn.style.opacity = "0.6";
      btn.style.cursor = "default";
      btn.textContent = getString("paperpal-translating");
      result.hidden = false;
      while (result.firstChild) result.removeChild(result.firstChild);
      result.classList.remove("pp-translate-error");
      result.setAttribute("style", RESULT_STYLE_OK);
      result.textContent = "…";
      try {
        const target = getTranslateConfig().targetLang;
        const out = await translate(text, target);
        showResult(result, doc, out || "(empty)");
      } catch (e) {
        showError(result, doc, formatError(e));
      } finally {
        btn.disabled = false;
        btn.style.opacity = "";
        btn.style.cursor = "pointer";
        btn.textContent = getString("paperpal-btn-translate");
      }
    });

    root.appendChild(btn);
    root.appendChild(result);
    event.append(root);
  }

  private injectStyle(doc: Document): void {
    if (doc.getElementById("paperpal-translate-style")) return;
    const head = doc.head ?? doc.documentElement;
    const link = doc.createElementNS(XHTML_NS, "link") as HTMLLinkElement;
    link.id = "paperpal-translate-style";
    link.rel = "stylesheet";
    link.href = "chrome://paperpal/content/styles/chatPanel.css";
    head.appendChild(link);
  }
}

const RESULT_STYLE_OK =
  "background:rgba(123,62,232,0.08);border-left:3px solid #7B3EE8;padding:6px 8px;border-radius:3px;max-height:220px;overflow:auto;line-height:1.55;white-space:pre-wrap;word-wrap:break-word;display:flex;flex-direction:column;gap:6px;color:#222;";
const RESULT_STYLE_ERR =
  "background:#fde2e2;border-left:3px solid #b00020;padding:6px 8px;border-radius:3px;max-height:220px;overflow:auto;line-height:1.55;white-space:pre-wrap;word-wrap:break-word;color:#8a1f1f;";

function showResult(target: HTMLElement, doc: Document, text: string): void {
  while (target.firstChild) target.removeChild(target.firstChild);
  target.classList.remove("pp-translate-error");
  target.setAttribute("style", RESULT_STYLE_OK);
  const body = doc.createElementNS(XHTML_NS, "div") as HTMLDivElement;
  body.className = "pp-translate-result-body";
  body.textContent = text;
  const copy = doc.createElementNS(XHTML_NS, "button") as HTMLButtonElement;
  copy.className = "pp-translate-copy";
  copy.textContent = getString("paperpal-translate-copy");
  copy.setAttribute(
    "style",
    "align-self:flex-end;padding:2px 10px;font-size:11px;background:#fff;border:1px solid #7B3EE8;color:#7B3EE8;border-radius:3px;cursor:pointer;",
  );
  copy.addEventListener("click", () => {
    try {
      Zotero.Utilities.Internal.copyTextToClipboard(text);
      copy.textContent = getString("paperpal-translate-copied");
      setTimeout(() => {
        copy.textContent = getString("paperpal-translate-copy");
      }, 1200);
    } catch (e) {
      Zotero.debug(`[PaperPal] copy failed: ${e}`);
    }
  });
  target.appendChild(body);
  target.appendChild(copy);
}

function showError(target: HTMLElement, doc: Document, message: string): void {
  while (target.firstChild) target.removeChild(target.firstChild);
  target.classList.add("pp-translate-error");
  target.setAttribute("style", RESULT_STYLE_ERR);
  target.hidden = false;
  const body = doc.createElementNS(XHTML_NS, "div") as HTMLDivElement;
  body.textContent = `${getString("paperpal-error-prefix")}: ${message}`;
  target.appendChild(body);
}

function formatError(e: unknown): string {
  if (e instanceof LLMError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}
