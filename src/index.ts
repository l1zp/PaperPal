import { Addon } from "./addon";

declare const Zotero: any;

if (!Zotero.PaperPal) {
  const addon = new Addon();
  Zotero.PaperPal = addon;
  (globalThis as any).addon = addon;
  (globalThis as any).ztoolkit = addon.data.ztoolkit;
}
