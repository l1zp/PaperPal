declare const PathUtils: {
  join(...parts: string[]): string;
  profileDir: string;
};

declare const IOUtils: {
  exists(path: string): Promise<boolean>;
  makeDirectory(path: string, opts?: { ignoreExisting?: boolean }): Promise<void>;
  readJSON(path: string): Promise<unknown>;
  writeJSON(path: string, data: unknown, opts?: { compress?: boolean }): Promise<void>;
};

declare const Components: any;
declare const Services: any;
declare const ChromeUtils: any;
