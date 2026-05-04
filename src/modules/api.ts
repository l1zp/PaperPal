import { chatOnce, LLMError } from "./llmClient";
import { getConfig, getTranslateConfig } from "./prefs";
import { getString } from "../utils/locale";

function findElementById(id: string, prefsWindow?: Window): HTMLElement | null {
  if (prefsWindow?.document) {
    const el = prefsWindow.document.getElementById(id);
    if (el) return el as HTMLElement;
  }
  for (const w of Zotero.getMainWindows()) {
    const el = w.document.getElementById(id);
    if (el) return el as HTMLElement;
  }
  try {
    const Services = (globalThis as any).Services;
    const e = Services?.wm?.getEnumerator(null);
    while (e?.hasMoreElements?.()) {
      const w = e.getNext() as Window;
      const el = w?.document?.getElementById?.(id);
      if (el) return el as HTMLElement;
    }
  } catch {
    // ignore
  }
  return null;
}

interface TestTarget {
  resultElID: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  needsKey: boolean;
}

async function runTest(target: TestTarget, prefsWindow?: Window): Promise<void> {
  const resultEl = findElementById(target.resultElID, prefsWindow);
  if (resultEl) {
    resultEl.textContent = getString("prefs-test-pending");
    resultEl.style.color = "";
  }
  const missingKey = target.needsKey && !target.apiKey;
  if (!target.baseUrl || missingKey || !target.model) {
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
        baseUrl: target.baseUrl,
        apiKey: target.apiKey || "EMPTY",
        model: target.model,
        temperature: 0,
        messages: [{ role: "user", content: "ping" }],
      },
      1,
    );
    const ms = Date.now() - t0;
    if (resultEl) {
      resultEl.textContent = getString("prefs-test-ok", { ms, model: target.model });
      resultEl.style.color = "#087";
    }
    Zotero.debug(`[PaperPal] test ok: reply=${reply.slice(0, 50)}`);
  } catch (e) {
    const msg = e instanceof LLMError ? e.message : (e as Error).message ?? String(e);
    if (resultEl) {
      resultEl.textContent = getString("prefs-test-fail", { msg });
      resultEl.style.color = "#b00";
    }
  }
}

export async function testConnection(prefsWindow?: Window): Promise<void> {
  const cfg = getConfig();
  await runTest(
    {
      resultElID: "paperpal-test-result",
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      model: cfg.model,
      needsKey: true,
    },
    prefsWindow,
  );
}

export async function testTranslateConnection(prefsWindow?: Window): Promise<void> {
  const cfg = getTranslateConfig();
  await runTest(
    {
      resultElID: "paperpal-test-translate-result",
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      model: cfg.model,
      needsKey: false,
    },
    prefsWindow,
  );
}
