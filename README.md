# PaperPal

Zotero 7 阅读器侧边栏 LLM 对话插件。打开 PDF 后在右侧栏与论文实时对话，支持流式 Markdown / KaTeX 渲染、一键生成可持久化的论文要点、按选中文本提问。

## 功能

- **侧栏对话**：注册到 Zotero 阅读器右侧栏，自动跟随当前打开的论文
- **两种上下文模式**
  - `全文`：自动注入 metadata + PDF 全文（按 token 预算头尾截断）
  - `选中`：注入 metadata + 你在 PDF 中选中的片段
- **总结-存储-复用**：点 "总结全文" 一次，要点持久化到 `<profile>/paperpal/summaries.json`，之后每轮对话都把要点作为上下文一起带上 —— v1 先用静态总结模拟 RAG，v1.1 升级到真分块检索
- **OpenAI 兼容**：一套 base URL + API Key + 模型名 即可适配 OpenAI / DeepSeek / 智谱 / Moonshot / SiliconFlow / OpenRouter / 兼容 chat completion 协议的本地推理服务
- **流式 + 可中断**：SSE 流式响应，"停止" 按钮立即取消
- **多 tab 独立会话**：每个阅读器 tab 有独立的对话历史

## 开发

### 一次性安装

```bash
npm install
cp .env.example .env
# 编辑 .env，填入本机 Zotero 路径
```

`.env` 三个字段：

| 变量 | 说明 |
| --- | --- |
| `ZOTERO_PLUGIN_ZOTERO_BIN_PATH` | Zotero 7 可执行文件路径 |
| `ZOTERO_PLUGIN_PROFILE_PATH` | 一个独立的 dev profile 目录（建议新建，避免污染主资料库） |
| `ZOTERO_PLUGIN_DATA_DIR` | dev 数据目录 |

### 命令

```bash
npm start          # 启动 Zotero 开发实例 + 热重载
npm run build      # 产出 build/paper-pal.xpi
npm test           # 运行 vitest 单元测试
npx tsc --noEmit   # 类型检查
```

## 安装到正式 Zotero

1. `npm run build`
2. 在 Zotero 中 `工具 → 插件 → 齿轮 → Install Add-on From File…`
3. 选择 `build/paper-pal.xpi`
4. 重启 Zotero

## 配置

`编辑 → 设置 → PaperPal`

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| Base URL | `https://api.openai.com/v1` | OpenAI 兼容接口；末尾不要带斜杠 |
| API Key | 空 | Bearer Token |
| 模型名 | `gpt-4o-mini` | 例：`deepseek-chat`、`glm-4-plus`、`gpt-4o-mini` |
| 温度 | 0.3 | |
| 最大上下文 token | 12000 | 超过部分头尾截断 |
| 默认模式 | 全文 | `全文` 或 `选中` |
| 自动生成总结 | 关 | 打开论文时自动调一次 LLM 生成总结，会消耗 API |
| 系统提示词 | 中文学术助手 | |
| 总结提示词 | 五段式提炼 | |

设置好后点 "测试连接"，绿色 "OK" 表示通路正常。

## 安全提示

API Key 以**明文**存储在 `<profile>/prefs.js` 中（与 Better BibTeX 等主流插件做法一致）。如果你的 Zotero 资料库会通过 Zotero Sync 服务同步，请知悉风险，建议为 PaperPal 单独申请额度受限的 API Key。

## 项目结构

```
addon/
  manifest.json            WebExtension 清单
  bootstrap.js             启动桥
  prefs.js                 默认偏好
  content/
    preferences.xhtml      偏好设置 UI
    styles/chatPanel.css   聊天面板样式
    icons/                 图标
  locale/zh-CN/            Fluent 中文文案

src/
  index.ts                 入口
  addon.ts                 单例
  hooks.ts                 startup / shutdown
  modules/
    chatPanel.ts           侧栏注册 + DOM 管理
    contextBuilder.ts      prompt 装配
    llmClient.ts           OpenAI 兼容 + SSE 流式
    summaryStore.ts        论文要点本地持久化
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

- [ ] v1.1：真 RAG（分块 + embedding 召回）
- [ ] v1.1：使用 `nsILoginManager` 加密存储 API Key
- [ ] v1.2：分章节总结再合并，提升长论文摘要质量
- [ ] v1.2：根据 fulltext 哈希自动判定总结失效

## License

MIT
