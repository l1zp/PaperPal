export function estimateChars(tokens: number, charsPerToken = 3): number {
  return Math.max(0, Math.floor(tokens * charsPerToken));
}

export function truncateHeadTail(
  text: string,
  maxChars: number,
  marker = (cut: number) => `…[已截断 ${cut} 字]…`,
): string {
  if (maxChars <= 0) return "";
  if (text.length <= maxChars) return text;
  const reserve = 64;
  const usable = Math.max(maxChars - reserve, Math.floor(maxChars * 0.9));
  const headLen = Math.floor(usable * 0.6);
  const tailLen = usable - headLen;
  const cut = text.length - headLen - tailLen;
  return text.slice(0, headLen) + "\n" + marker(cut) + "\n" + text.slice(text.length - tailLen);
}

export function getCharsPerToken(): number {
  try {
    const v = parseFloat(Zotero.Prefs.get("extensions.zotero.paperpal.charsPerToken", true) as string);
    if (!isNaN(v) && v > 0) return v;
  } catch {
    // ignored
  }
  return 3;
}
