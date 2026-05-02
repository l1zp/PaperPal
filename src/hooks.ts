import { Addon } from "./addon";

declare const Zotero: any;
declare const L10nRegistry: any;

function getAddon(): Addon {
  return Zotero.PaperPal as Addon;
}

export async function onStartup(): Promise<void> {
  const addon = getAddon();
  if (addon.data.initialized) return;

  await addon.data.summaryStore.load();
  registerLocale();
  await registerPrefsPane();
  addon.data.chatPanel.register();

  addon.data.initialized = true;
  Zotero.debug("[PaperPal] startup complete");
}

export async function onShutdown(): Promise<void> {
  const addon = getAddon();
  if (!addon || !addon.data.initialized) return;
  addon.data.chatPanel.unregister();
  await addon.data.summaryStore.shutdown();
  try {
    addon.data.ztoolkit.unregisterAll();
  } catch (e) {
    Zotero.debug(`[PaperPal] toolkit unregister failed: ${e}`);
  }
  addon.data.initialized = false;
}

export async function onMainWindowLoad(_window: Window): Promise<void> {
  // No per-window setup needed at this time.
}

export async function onMainWindowUnload(_window: Window): Promise<void> {
  // No per-window teardown needed at this time.
}

export function onPrefsLoad(prefsWindow: Window): void {
  try {
    const doc = prefsWindow.document;
    const btn = doc.getElementById("paperpal-test-button");
    if (btn && !(btn as any)._paperpalBound) {
      (btn as any)._paperpalBound = true;
      btn.addEventListener("click", () => {
        void getAddon().api.testConnection(prefsWindow);
      });
    }
  } catch (e) {
    Zotero.debug(`[PaperPal] onPrefsLoad failed: ${e}`);
  }
}

async function registerPrefsPane(): Promise<void> {
  try {
    await Zotero.PreferencePanes.register({
      pluginID: "paperpal@local",
      src: "chrome://paperpal/content/preferences.xhtml",
      label: "PaperPal",
      image: "chrome://paperpal/content/icons/favicon.png",
    });
  } catch (e) {
    Zotero.debug(`[PaperPal] registerPrefsPane failed: ${e}`);
    Zotero.logError(e as any);
  }
}

function registerLocale(): void {
  try {
    const reg =
      (globalThis as any).L10nRegistry?.getInstance?.() ?? (globalThis as any).L10nRegistry;
    if (!reg) return;
    const source = new (globalThis as any).L10nFileSource(
      "paperpal",
      "paperpal",
      ["zh-CN"],
      "chrome://paperpal/locale/{locale}/",
    );
    reg.registerSources([source]);
  } catch (e) {
    Zotero.debug(`[PaperPal] registerLocale failed: ${e}`);
  }
}
