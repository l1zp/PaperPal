import { ChatPanel } from "./modules/chatPanel";
import { SummaryStore } from "./modules/summaryStore";
import { ZToolkit, createZToolkit } from "./utils/ztoolkit";
import * as api from "./modules/api";
import * as hooksImpl from "./hooks";

export class Addon {
  data: {
    initialized: boolean;
    ztoolkit: ZToolkit;
    summaryStore: SummaryStore;
    chatPanel: ChatPanel;
    prefsObserverID: symbol | null;
  };
  hooks: typeof hooksImpl;
  api: typeof api;

  constructor() {
    const ztoolkit = createZToolkit();
    const summaryStore = new SummaryStore();
    this.data = {
      initialized: false,
      ztoolkit,
      summaryStore,
      chatPanel: new ChatPanel(summaryStore),
      prefsObserverID: null,
    };
    this.hooks = hooksImpl;
    this.api = api;
  }
}
