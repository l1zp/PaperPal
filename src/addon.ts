import { ChatPanel } from "./modules/chatPanel";
import { SummaryStore } from "./modules/summaryStore";
import { TranslatePopup } from "./modules/popup";
import { ZToolkit, createZToolkit } from "./utils/ztoolkit";
import * as api from "./modules/api";
import * as hooksImpl from "./hooks";

export class Addon {
  data: {
    initialized: boolean;
    ztoolkit: ZToolkit;
    summaryStore: SummaryStore;
    chatPanel: ChatPanel;
    translatePopup: TranslatePopup;
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
      translatePopup: new TranslatePopup(),
      prefsObserverID: null,
    };
    this.hooks = hooksImpl;
    this.api = api;
  }
}
