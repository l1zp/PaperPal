# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PaperPal is a Zotero 7 plugin that adds a reader-sidebar LLM chat panel and a "translate selection" button to the PDF reader's text-selection popup. Both features speak the OpenAI chat-completions protocol; chat typically points at a cloud provider (DeepSeek, GLM, OpenRouter, etc.) while translation usually points at a local mlx-lm/vLLM serving Hunyuan-MT 1.8B.

## Commands

```bash
npm install                     # one-time install
npm start                       # zotero-plugin scaffold: launches dev Zotero + watch + hot reload
npm run build                   # produce build/paper-pal.xpi (release)
npm test                        # vitest run (all)
npx vitest run path/to/x.test.ts  # single file
npx tsc --noEmit                # full type-check (strict)
```

`npm start` requires `.env` with `ZOTERO_PLUGIN_ZOTERO_BIN_PATH`, `ZOTERO_PLUGIN_PROFILE_PATH`, `ZOTERO_PLUGIN_DATA_DIR` (see `.env.example`). Use a dedicated dev profile, not the user's main Zotero profile — they share data dirs/sync state.

Hot reload only re-runs `onShutdown`/`onStartup`. UI bound to old DOM (e.g. an open reader sidebar panel) keeps its old listeners until you close+reopen the reader tab.

## Release flow

1. Bump `package.json` version
2. Commit, tag `vX.Y.Z`, `git push --follow-tags`
3. `npm run build` → `build/paper-pal.xpi`
4. `gh release create vX.Y.Z build/paper-pal.xpi --title ... --notes ...`

Memory rule from prior sessions: this repo's git remote uses the `github.com-personal` SSH alias. Don't reset/replace `origin` to default `github.com` or `github.com-work`.

## Architecture

### Runtime context

The bundled JS runs inside Zotero's chrome scope via `Services.scriptloader.loadSubScript(addonRoot/content/scripts/paperpal.js, ctx)` from `addon/bootstrap.js`. The `ctx` object **replaces** `globalThis` — only properties we explicitly inject are available as globals. Notably:

- `Zotero` ✓, `Services` ✓, `IOUtils`/`PathUtils` ✓, `fetch` ✓ — injected
- `AbortController`, `DOMParser`, `TextDecoder` are **NOT in chrome-scope `globalThis`** even though `fetch` is. Use `getWebGlobals()` in `src/modules/llmClient.ts` to lazily fetch them off `Zotero.getMainWindows()[0]`. New Web-API constructors should follow the same pattern.

### Module layout

```
src/
  index.ts          entry — instantiates Addon and assigns Zotero.PaperPal
  addon.ts          singleton holding ChatPanel, TranslatePopup, SummaryStore, ztoolkit, hooks, api
  hooks.ts          onStartup/onShutdown/onPrefsLoad/onMainWindow*
  modules/
    chatPanel.ts    reader sidebar section — DOM + per-tab ChatSession map + streaming render
    contextBuilder.ts  pure prompt assembly: buildChatPrompt, buildSummaryPrompt
    llmClient.ts    OpenAI-compatible transport (streamChat, chatOnce). chatOnce takes
                    `extra` for vLLM/mlx-lm sampling params (top_p, top_k, repetition_penalty)
    summaryStore.ts persists per-paper summaries to <profile>/paperpal/summaries.json
    translate.ts    Hunyuan-MT prompt templates + stripSpecialTokens (cleans <|hy_place_holder|>)
    popup.ts        Zotero.Reader.registerEventListener("renderTextSelectionPopup",...)
                    injects 翻译 button into the selection popup
    prefs.ts        getConfig (chat) / getTranslateConfig (translate) — auto-prepends http:// to bare URLs
    api.ts          testConnection / testTranslateConnection wired to prefs-pane buttons
    markdown.ts     marked + KaTeX, rendered via setHTML helper (see chatPanel.ts) because
                    XUL docs don't parse innerHTML as HTML
  utils/
    sse.ts          pure SSE line parser — covered by sse.test.ts
    tokens.ts       char-based token estimator + head/tail truncation
    locale.ts       Localization wrapper. MUST register both paperpal-paperpal.ftl
                    AND paperpal-preferences.ftl in the bundle, or prefs-pane
                    strings render as [key].
    ztoolkit.ts     zotero-plugin-toolkit instance
```

`chatPanel.ts` keeps a `Map<bodyElement, PanelHandles>` (in module-scope WeakMap) so each reader tab has its own DOM + session. `bindItem(handles, item)` is called by Zotero on item change; on a fresh item it resets `session.history` and `messages` and reads any stored summary out of `SummaryStore` for compressed-context injection into subsequent chat prompts.

### `addon/` static files

`bootstrap.js` runs in Zotero core's chrome global, registers chrome paths via `aomStartup.registerChrome`, then loadSubScripts the bundled JS. `manifest.json`, `prefs.js` (default prefs), `preferences.xhtml`, `locale/zh-CN/*.ftl`, `content/styles/chatPanel.css`, and `content/icons/*.png` are passed through to the xpi by the scaffold.

### Build pipeline

`zotero-plugin.config.ts` drives `zotero-plugin-scaffold` (esbuild under the hood). It bundles `src/index.ts` → `build/addon/content/scripts/paperpal.js`, copies `addon/**/*` (auto-prefixing locale filenames as `paperpal-<basename>.ftl`), generates `update.json`, and packs the xpi. The scaffold also auto-generates `typings/i10n.d.ts` (Fluent message ID union) and `typings/prefs.d.ts` (pref key types) — these are committed.

## Non-obvious Zotero 7 gotchas

These cost real iteration time during v0.1 / v0.2 development; baked into existing code, do not regress:

1. **Prefs pane root must be `<vbox>` (XUL), not `<html>`** — a pure-HTML root XHTML loads (HTTP 200, parses fine) but Zotero's pane loader silently aborts on inject; user clicks the entry in the prefs sidebar, sees it highlight, but the right pane never switches. Use `<vbox xmlns="...XUL" xmlns:html="...">` and prefix HTML with `html:`.

2. **Inline `onclick` on HTML buttons silently no-ops in the prefs pane sandbox** — even though the button renders and click events register. Inline `onload` on the **root `<vbox>`** does work. We use that to dispatch into `Zotero.PaperPal.hooks.onPrefsLoad(window)`, which then `addEventListener`s the buttons.

3. **`AbortController`/`DOMParser` not in chrome-scope `globalThis`** even though `fetch` is. See `getWebGlobals()` in llmClient.ts. Setting `innerHTML` on a XUL document throws `An invalid or illegal string was specified` because it parses as XML, not HTML — use the `setHTML` helper in chatPanel.ts which goes through `DOMParser.parseFromString(..., "text/html")` and `doc.importNode`.

4. **`<html:input preference="...">` fields display literal `"undefined"`** if the pref hasn't been initialized. Defaults from `addon/prefs.js` only attach on Zotero startup; if the addon was just installed and the pref didn't exist yet, the bound input shows the JS-stringified `undefined`. Guard against missing prefs in code (treat as fallback) and tell users to restart Zotero after upgrading across versions that add new prefs.

5. **Bare URL without scheme in a `fetch()` call is silently misinterpreted** — `fetch("127.0.0.1:8000/v1/x")` treats `127.0.0.1` as the URL scheme. `getTranslateConfig()` auto-prepends `http://` to user-entered base URLs. Apply the same when adding new URL-bearing prefs.

6. **`mlx_lm.server` requires `HF_HUB_OFFLINE=1` after first download** — otherwise it phones home to huggingface.co per request to revalidate model files, which hangs in CN networks. Documented in README; not something the plugin code can fix.

These three are also stored in user memory (see `~/.claude/projects/.../memory/project_zotero_prefs_pane.md`) so they persist across sessions.

## Testing strategy

Unit tests cover the **pure** modules (no Zotero runtime dependency): `utils/sse.ts`, `utils/tokens.ts`, `modules/translate.ts` (prompt templates + token stripping). Integration of `chatPanel`, `popup`, `summaryStore`, prefs binding, etc. is verified by hand in dev Zotero — they touch live `Zotero.*` APIs that don't have a useful mock.

When adding a new pure utility, prefer adding a `*.test.ts` in the same dir over a manual smoke test.

## Reference docs in the repo

- `README.md` — user-facing install + config (covers mlx-lm setup and provider examples)
- Plan files in `~/.claude/plans/` — historical design docs for v0.1 (chat) and v0.2 (translate)
