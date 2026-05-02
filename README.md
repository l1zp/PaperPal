# PaperPal

> Zotero 7 阅读器侧边栏 LLM 对话插件

打开 PDF 后在阅读器右侧栏与论文实时对话。一键生成可持久化的论文要点，后续每轮提问都会自动把要点作为压缩上下文带上。OpenAI 兼容协议，覆盖 OpenAI / DeepSeek / 智谱 / Moonshot / SiliconFlow / OpenRouter / 无问芯穹 / 任何兼容 chat completion 的本地推理服务。

<p align="center">
  <img src="addon/content/icons/favicon@2x.png" width="64" height="64" alt="PaperPal icon" />
</p>

## 快速安装

1. 到 [Releases](https://github.com/l1zp/PaperPal/releases) 下载最新的 `paper-pal.xpi`
2. Zotero 7 → `工具 / Tools → 插件 / Plugins → ⚙ → Install Plugin From File…`
3. 选刚下载的 `paper-pal.xpi` → `Install Now` → 重启 Zotero
4. `编辑 → 设置`，左侧选 `PaperPal`，填 Base URL / API Key / 模型名 → 点 "测试连接"
5. 双击任意 PDF → 阅读器右侧栏点 PaperPal 图标（紫色对话气泡）

## 功能

- **侧栏聊天**：注册到 Zotero 阅读器右侧栏，自动跟随当前打开的论文；多 tab 会话独立
- **两种上下文模式**
  - `全文`：自动注入 metadata + PDF 全文（按 token 预算头尾截断，保住引言和结论）
  - `选中`：注入 metadata + 你在 PDF 中选中的片段
- **总结-存储-复用**：点 "总结全文" 一次，要点持久化到 `<profile>/paperpal/summaries.json`，之后每轮对话都把要点作为压缩上下文一起带上 —— v0.1 用静态总结模拟 RAG，v0.2 升级真分块检索
- **OpenAI 兼容**：一套 Base URL + API Key + 模型名搞定所有兼容服务商
- **流式 + 可中断**：SSE 流式响应，"停止" 按钮立即取消
- **Markdown + KaTeX** 渲染，深色模式自适应
- 中文 UI

## 配置项

`编辑 → 设置 → PaperPal`

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| Base URL | `https://api.openai.com/v1` | OpenAI 兼容接口；末尾不要带斜杠 |
| API Key | 空 | Bearer Token，**不要**把 URL 又粘到这里 |
| 模型名 | `gpt-4o-mini` | 例：`deepseek-chat`、`glm-4-plus`、`Qwen/Qwen2.5-72B-Instruct` |
| 温度 | 0.3 | |
| 最大上下文 token | 12000 | 超过部分头尾截断 |
| 默认模式 | 全文 | `全文` 或 `选中` |
| 自动生成总结 | 关 | 打开论文时自动调一次 LLM 生成总结（会消耗 API 配额） |
| 聊天系统提示词 | 中文学术助手 | |
| 总结系统提示词 | 五段式提炼 | |

设置好后点 "测试连接"，绿色 "连接成功" 表示通路正常。

### 常用服务商配置

| 服务商 | Base URL | 模型示例 |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini`, `gpt-4o` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat`, `deepseek-reasoner` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-plus`, `glm-4-flash` |
| Moonshot | `https://api.moonshot.cn/v1` | `moonshot-v1-32k` |
| SiliconFlow | `https://api.siliconflow.cn/v1` | `Qwen/Qwen2.5-72B-Instruct` |
| OpenRouter | `https://openrouter.ai/api/v1` | `anthropic/claude-3.7-sonnet` |
| 本地 Ollama | `http://localhost:11434/v1` | `qwen2.5:14b` 等 |

## 安全提示

API Key 以**明文**存储在 `<profile>/prefs.js`（与 Better BibTeX 等主流 Zotero 插件做法一致）。如果你的 Zotero 资料库会通过 Zotero Sync 同步，请知悉风险 —— 建议为 PaperPal 单独申请一个额度受限的 Key。下个版本会接入 `nsILoginManager` 加密存储。

## 故障排查

| 现象 | 原因 / 解决 |
| --- | --- |
| 偏好里点 PaperPal 没反应 | 老版本 bug，升到 v0.1.0+ 即可 |
| 偏好测试连接失败 | 检查 API Key 有没有粘错（不是 Base URL 又粘了一遍）；检查网络能否访问 Base URL；模型名拼写 |
| 总结按钮点了没反应 | 关掉 Zotero 阅读器 tab 重新打开 PDF 让面板刷新 |
| 总结生成完毕但显示原始 HTML 标签 | 老版本 bug，升级即可 |
| `正文尚未索引` 提示 | Zotero 还没把 PDF 全文索引完，等几分钟或在 Zotero 里 `工具 → 重建数据库 → 搜索索引` |
| 长论文回答缺失中段细节 | v0.1 用头尾截断 + 总结压缩；v0.2 会换成真 RAG |

如果有未列出的问题，欢迎在 [Issues](https://github.com/l1zp/PaperPal/issues) 反馈，附上 Zotero 版本、出错时操作步骤、`Help → Debug Output Logging` 的输出。

## 开发

### 准备 dev 环境

```bash
npm install
cp .env.example .env
# 编辑 .env，填入本机路径
```

`.env` 三个字段：

| 变量 | 说明 |
| --- | --- |
| `ZOTERO_PLUGIN_ZOTERO_BIN_PATH` | Zotero 7 可执行文件路径（macOS：`/Applications/Zotero.app/Contents/MacOS/zotero`） |
| `ZOTERO_PLUGIN_PROFILE_PATH` | 一个独立的 dev profile 目录（强烈建议新建，避免污染主资料库；用 `zotero -P` 创建） |
| `ZOTERO_PLUGIN_DATA_DIR` | dev 数据目录（首次启动 dev profile 时在 Zotero 设置里指向这里） |

### 常用命令

```bash
npm start          # 启动 Zotero dev 实例 + 文件 watcher 热重载
npm run build      # 产出 build/paper-pal.xpi
npm test           # 运行 vitest 单元测试（SSE 解析器 + token 截断）
npx tsc --noEmit   # 类型检查
```

### 发版流程

```bash
npm version patch              # 自动改 package.json 并打 tag
git push origin main --tags
npx zotero-plugin build
gh release create vX.Y.Z build/paper-pal.xpi --title "PaperPal vX.Y.Z" --notes "..."
```

## 项目结构

```
addon/
  manifest.json            WebExtension 清单
  bootstrap.js             启动桥（loadSubScript 加载编译产物）
  prefs.js                 默认偏好
  content/
    preferences.xhtml      偏好设置 UI（XUL <vbox> 根 + html: 内容）
    styles/chatPanel.css   聊天面板样式
    icons/                 紫色对话气泡图标
  locale/zh-CN/            Fluent 中文文案

src/
  index.ts                 入口，挂到 Zotero.PaperPal
  addon.ts                 单例，持有 ChatPanel/SummaryStore/api/hooks
  hooks.ts                 startup / shutdown / onPrefsLoad
  modules/
    chatPanel.ts           阅读器侧栏注册、DOM 管理、流式渲染
    contextBuilder.ts      prompt 装配（聊天 / 总结两个入口）
    llmClient.ts           OpenAI 兼容 + SSE 流式 + 从 window 取 Web API
    summaryStore.ts        论文要点本地持久化（profile/paperpal/summaries.json）
    prefs.ts               配置读取
    markdown.ts            marked + KaTeX
    api.ts                 testConnection
  utils/
    sse.ts                 SSE 行解析器（可单测）
    tokens.ts              token 估算 + 头尾截断
    locale.ts              Fluent 取串
    ztoolkit.ts            zotero-plugin-toolkit 实例
```

## 路线图

- [ ] v0.2：真 RAG（分块 + embedding 召回）
- [ ] v0.2：使用 `nsILoginManager` 加密存储 API Key
- [ ] v0.3：分章节总结再合并，提升长论文摘要质量
- [ ] v0.3：根据 fulltext 哈希自动判定总结失效
- [ ] v0.4：英文 UI（locale/en-US）

## License

MIT
