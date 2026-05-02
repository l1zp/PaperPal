import { ZoteroToolkit } from "zotero-plugin-toolkit";

export function createZToolkit() {
  const tk = new ZoteroToolkit();
  tk.basicOptions.log.prefix = "[PaperPal]";
  tk.basicOptions.log.disableConsole = false;
  return tk;
}

export type ZToolkit = ReturnType<typeof createZToolkit>;
