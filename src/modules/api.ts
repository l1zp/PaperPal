import { chatOnce, LLMError } from "./llmClient";
import { getConfig } from "./prefs";
import { getString } from "../utils/locale";

function findResultElement(prefsWindow?: Window): HTMLElement | null {
  if (prefsWindow?.document) {
    const el = prefsWindow.document.getElementById("paperpal-test-result");
    if (el) return el as HTMLElement;
  }
  for (const w of Zotero.getMainWindows()) {
    const el = w.document.getElementById("paperpal-test-result");
    if (el) return el as HTMLElement;
  }
  // fall back: scan any open window for the element
  try {
    const Services = (globalThis as any).Services;
    const e = Services?.wm?.getEnumerator(null);
    while (e?.hasMoreElements?.()) {
      const w = e.getNext() as Window;
      const el = w?.document?.getElementById?.("paperpal-test-result");
      if (el) return el as HTMLElement;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function testConnection(prefsWindow?: Window): Promise<void> {
  const cfg = getConfig();
  const resultEl = findResultElement(prefsWindow);
  if (resultEl) {
    resultEl.textContent = getString("prefs-test-pending");
    resultEl.style.color = "";
  }
  if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) {
    if (resultEl) {
      resultEl.textContent = getString("paperpal-status-config-missing");
      resultEl.style.color = "#b00";
    }
    return;
  }
  const t0 = Date.now();
  try {
    const reply = await chatOnce(
      {
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        model: cfg.model,
        temperature: 0,
        messages: [{ role: "user", content: "ping" }],
      },
      1,
    );
    const ms = Date.now() - t0;
    if (resultEl) {
      resultEl.textContent = getString("prefs-test-ok", { ms, model: cfg.model });
      resultEl.style.color = "#087";
    }
    Zotero.debug(`[PaperPal] testConnection ok: reply=${reply.slice(0, 50)}`);
  } catch (e) {
    const msg = e instanceof LLMError ? e.message : (e as Error).message ?? String(e);
    if (resultEl) {
      resultEl.textContent = getString("prefs-test-fail", { msg });
      resultEl.style.color = "#b00";
    }
  }
}
