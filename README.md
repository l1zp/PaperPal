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
