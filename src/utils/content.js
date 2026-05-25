// Content / status / draft helpers
import { ACCENT } from "../constants/config";

export const judgePost = (p) => {
  const v = +p.views || 0, s = +p.saves || 0, c = +p.comments || 0, f = +p.followers || 0;
  if (v >= 8000 || f >= 50 || (v > 0 && c / v >= 0.005)) return "超预期";
  if (v >= 2500 || (v > 0 && s / v >= 0.04)) return "符合预期";
  return "待优化";
};

export const statusColor = (s) => {
  const m = {
    "灵感池": { bg: "#1e1e1e", color: "#888" },
    "待写": { bg: "rgba(88,28,135,0.4)", color: "#c4b5fd" },
    "写作中": { bg: "rgba(29,78,216,0.4)", color: "#93c5fd" },
    "待发布": { bg: "rgba(120,53,15,0.4)", color: "#fcd34d" },
    "已发布": { bg: "rgba(200,255,0,0.15)", color: ACCENT },
    "超预期": { bg: ACCENT, color: "black" },
    "符合预期": { bg: "rgba(255,255,255,0.1)", color: "white" },
    "待优化": { bg: "rgba(127,29,29,0.4)", color: "#fca5a5" },
  };
  return m[s] || { bg: "#1e1e1e", color: "#888" };
};

export const generateCover = (title) => {
  if (!title) return "30+\n人生草稿";
  if (title.includes("巴西") || title.includes("外派")) return "以为是镀金\n没想到熔掉我";
  if (title.includes("北漂")) return "30岁北漂\n不是因为勇敢";
  if (title.includes("奥德赛") || title.includes("版本")) return "不是迷茫\n是没版本";
  if (title.includes("AI")) return "AI不是焦虑\n是工具箱";
  if (title.includes("健身") || title.includes("攀岩") || title.includes("变瘦")) return "不是变小\n是变强";
  return title.length > 10 ? `${title.slice(0, 6)}\n${title.slice(6, 14)}` : title;
};

export const generateBody = (title) =>
  `${title || "这篇笔记"}\n\n我最近一直在想一件事：30岁以后，很多变化不是突然发生的，而是你终于不想再按默认设置活了。\n\n以前我总觉得，人生应该有一条比较标准的路线。可是在巴西外派一年后，我发现自己被彻底打开了。\n\n所以这篇想记录一个真实过程：我怎么从原来的惯性生活里走出来。\n\n不是逆袭，也不是鸡血。只是一个普通女生，开始认真把自己当成一个长期项目来经营。`;

export const compressBody = (b) => {
  if (!b || b.length <= 520) return b || "";
  return b.slice(0, 500) + "\n\n如果你也在30岁左右卡住，可以先问自己：我是不是还有另一种人生版本没有写出来？";
};

export const addEmotion = (b) => {
  if (!b) return "";
  if (b.includes("重新长出来")) return b;
  return "我以前一直以为，30岁之后就该把自己定下来。\n\n后来我才发现，我真正需要的不是定型，而是重新长出来。\n\n" + b;
};

export const addEnding = (b) => {
  if (!b) return "";
  if (b.includes("评论区")) return b;
  return b + "\n\n你们有没有类似的时刻：突然发现自己不想再按原来的生活方式继续了？评论区告诉我。";
};

export const titleSuggestions = (base) => {
  const pool = [
    "以为外派镀金却熔掉我", "30岁北漂不是因为勇敢", "不是迷茫是没有版本",
    "我终于不想装稳了", "30岁不是截止日期", "不想变瘦只想变强",
    "学AI不是为了更卷", "我开始重写人生草稿",
  ];
  if (base?.includes("巴西")) pool.unshift("巴西没镀金而是熔掉了我", "外派后我不想装稳了");
  if (base?.includes("北漂")) pool.unshift("北漂不是逃离是重启", "有房有车30岁北漂她们说我疯了");
  if (base?.includes("AI")) pool.unshift("普通人也该学AI", "AI让我重铸了工作方式");
  return [...new Set(pool)].filter((t) => {
    const n = (t || "").replace(/\s/g, "").length;
    return n >= 8 && n <= 18;
  }).slice(0, 8);
};
