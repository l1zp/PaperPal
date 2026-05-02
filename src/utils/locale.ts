declare const Localization: any;

let bundle: any = null;

function getBundle(): any {
  if (!bundle) {
    try {
      bundle = new Localization(["paperpal-paperpal.ftl"], true);
    } catch (e) {
      Zotero.debug(`[PaperPal] failed to create Localization: ${e}`);
      bundle = null;
    }
  }
  return bundle;
}

export function getString(key: string, args?: Record<string, string | number>): string {
  const b = getBundle();
  if (!b) return `[${key}]`;
  try {
    const out = b.formatValueSync(key, args);
    return out || `[${key}]`;
  } catch {
    return `[${key}]`;
  }
}
