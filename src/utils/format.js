// Pure helpers — formatting, IDs, simple math
export const uid = () => Math.random().toString(36).slice(2, 10);
export const countChars = (s) => (s || "").replace(/\s/g, "").length;
export const hasConflict = (s) =>
  ["以为", "没想到", "不是", "才发现", "终于", "不再", "却", "反而", "原来"].some((w) => (s || "").includes(w));
export const fmtRate = (n, d) => (d > 0 ? ((n / d) * 100).toFixed(1) : "0.0");
export const fmtNum = (n) => (+n || 0).toLocaleString();
export const devPct = (actual, expected) =>
  expected > 0 ? Math.round(((actual - expected) / expected) * 100) : 0;
