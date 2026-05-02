/* eslint-disable no-undef */
var chromeHandle;

function install(_data, _reason) {}

async function startup({ id, version, resourceURI, rootURI = resourceURI.spec }, _reason) {
  await Zotero.initializationPromise;

  const aomStartup = Cc["@mozilla.org/addons/addon-manager-startup;1"].getService(
    Ci.amIAddonManagerStartup,
  );
  const manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "paperpal", rootURI + "content/"],
    ["locale", "paperpal", "zh-CN", rootURI + "locale/zh-CN/"],
  ]);

  const ctx = {
    id,
    version,
    rootURI,
    Zotero,
    ChromeUtils,
    Services,
    Components,
    Cc,
    Ci,
    Cu,
    Cr,
    XPCOMUtils:
      typeof XPCOMUtils !== "undefined"
        ? XPCOMUtils
        : ChromeUtils.importESModule("resource://gre/modules/XPCOMUtils.sys.mjs").XPCOMUtils,
    IOUtils: globalThis.IOUtils,
    PathUtils: globalThis.PathUtils,
    fetch: globalThis.fetch,
    Headers: globalThis.Headers,
    Request: globalThis.Request,
    Response: globalThis.Response,
    AbortController: globalThis.AbortController,
    TextDecoder: globalThis.TextDecoder,
    TextEncoder: globalThis.TextEncoder,
    Localization: globalThis.Localization,
    L10nRegistry: globalThis.L10nRegistry,
    L10nFileSource: globalThis.L10nFileSource,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
  };
  ctx.globalThis = ctx;

  Services.scriptloader.loadSubScript(rootURI + "content/scripts/paperpal.js", ctx);
  if (Zotero.PaperPal?.hooks?.onStartup) {
    await Zotero.PaperPal.hooks.onStartup();
  }
}

async function onMainWindowLoad({ window }, _reason) {
  if (Zotero.PaperPal?.hooks?.onMainWindowLoad) {
    await Zotero.PaperPal.hooks.onMainWindowLoad(window);
  }
}

async function onMainWindowUnload({ window }, _reason) {
  if (Zotero.PaperPal?.hooks?.onMainWindowUnload) {
    await Zotero.PaperPal.hooks.onMainWindowUnload(window);
  }
}

function shutdown(_data, _reason) {
  if (typeof Zotero === "undefined") return;
  try {
    Zotero.PaperPal?.hooks?.onShutdown?.();
  } catch (e) {
    Zotero.debug("[PaperPal] shutdown error: " + e);
  }
  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
  delete Zotero.PaperPal;
}

function uninstall(_data, _reason) {}
