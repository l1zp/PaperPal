import { ChatMessage, chatOnce } from "./llmClient";
import { TargetLang, getTranslateConfig } from "./prefs";

interface LangLabel {
  zh: string;
  en: string;
}

const LANG_LABEL: Record<TargetLang, LangLabel> = {
  "zh-CN": { zh: "中文", en: "Chinese" },
  en: { zh: "英文", en: "English" },
  ja: { zh: "日文", en: "Japanese" },
  ko: { zh: "韩文", en: "Korean" },
  fr: { zh: "法文", en: "French" },
  de: { zh: "德文", en: "German" },
  es: { zh: "西班牙文", en: "Spanish" },
  ru: { zh: "俄文", en: "Russian" },
};

export function targetLangLabel(target: TargetLang, locale: "zh" | "en" = "zh"): string {
  return LANG_LABEL[target]?.[locale] ?? target;
}

export function buildTranslatePrompt(text: string, target: TargetLang): ChatMessage[] {
  const isZhTarget = target.startsWith("zh");
  const content = isZhTarget
    ? `把下面的文本翻译成${LANG_LABEL[target].zh}，不要额外解释。\n\n${text}`
    : `Translate the following segment into ${LANG_LABEL[target].en}, without additional explanation.\n\n${text}`;
  return [{ role: "user", content }];
}

// Hunyuan / common chat-template special tokens that occasionally leak through
// the assistant output. Match both ASCII pipes and U+2581 (▁) "lower one eighth block".
const SPECIAL_TOKEN_RE = /<[|｜][a-zA-Z_▁▁]+(?:[\s▁▁_]+\d+)?[|｜]>/g;

export function stripSpecialTokens(s: string): string {
  return s.replace(SPECIAL_TOKEN_RE, "").trim();
}

export async function translate(
  text: string,
  target: TargetLang,
  signal?: AbortSignal,
): Promise<string> {
  const cfg = getTranslateConfig();
  const messages = buildTranslatePrompt(text, target);
  const result = await chatOnce(
    {
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      model: cfg.model,
      messages,
      temperature: 0.7,
      signal,
    },
    undefined,
    { top_p: 0.6, top_k: 20, repetition_penalty: 1.05 },
  );
  return stripSpecialTokens(result);
}
