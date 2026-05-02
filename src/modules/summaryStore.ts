interface SummaryRecord {
  text: string;
  model: string;
  generatedAt: number;
}

type StoreShape = Record<string, SummaryRecord>;

function keyOf(item: Zotero.Item): string {
  return `${item.libraryID}:${item.key}`;
}

export class SummaryStore {
  private cache: StoreShape = {};
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private filePath: string;

  constructor() {
    this.filePath = PathUtils.join(PathUtils.profileDir, "paperpal", "summaries.json");
  }

  async load(): Promise<void> {
    try {
      const dir = PathUtils.join(PathUtils.profileDir, "paperpal");
      await IOUtils.makeDirectory(dir, { ignoreExisting: true });
      if (await IOUtils.exists(this.filePath)) {
        const raw = await IOUtils.readJSON(this.filePath);
        if (raw && typeof raw === "object") {
          this.cache = raw as StoreShape;
        }
      }
    } catch (e) {
      Zotero.debug(`[PaperPal] SummaryStore.load failed: ${e}`);
    }
  }

  has(item: Zotero.Item): boolean {
    return !!this.cache[keyOf(item)];
  }

  get(item: Zotero.Item): SummaryRecord | null {
    return this.cache[keyOf(item)] ?? null;
  }

  set(item: Zotero.Item, text: string, model: string): void {
    this.cache[keyOf(item)] = { text, model, generatedAt: Date.now() };
    this.scheduleFlush();
  }

  delete(item: Zotero.Item): void {
    if (this.cache[keyOf(item)]) {
      delete this.cache[keyOf(item)];
      this.scheduleFlush();
    }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => void this.flush(), 500);
  }

  async flush(): Promise<void> {
    if (!this.dirty) return;
    this.dirty = false;
    try {
      await IOUtils.writeJSON(this.filePath, this.cache);
    } catch (e) {
      Zotero.debug(`[PaperPal] SummaryStore.flush failed: ${e}`);
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}
