// Review-specific constants: status tags, priorities, judgment styles
import { ACCENT } from "./config";

export const ST = {
  HOT:        { emoji: "🔥", label: "爆款",       bg: "rgba(127,29,29,0.85)", color: "#fca5a5" },
  EXCELLENT:  { emoji: "⭐", label: "优质",       bg: "rgba(29,78,216,0.55)", color: "#93c5fd" },
  POTENTIAL:  { emoji: "📈", label: "潜力",       bg: "rgba(20,83,45,0.65)",  color: "#86efac" },
  TOPICAL:    { emoji: "💬", label: "话题型",     bg: "rgba(76,29,149,0.55)", color: "#c4b5fd" },
  LONGTAIL:   { emoji: "🌱", label: "长尾型",     bg: "rgba(19,78,74,0.55)",  color: "#5eead4" },
  UNDERPERF:  { emoji: "⚠️", label: "待优化",     bg: "rgba(120,53,15,0.65)", color: "#fcd34d" },
  COLDFAIL:   { emoji: "❄️", label: "冷启动失败", bg: "rgba(31,41,55,0.9)",   color: "#9ca3af" },
  REPETITIVE: { emoji: "🔄", label: "重复疲劳",   bg: "rgba(67,20,7,0.65)",   color: "#fb923c" },
  PENDING:    { emoji: "⏳", label: "待观察",     bg: "rgba(17,24,39,0.9)",   color: "#6b7280" },
};

export const PRIORITY = {
  immediate: { label: "立即", color: "#ef4444", bg: "rgba(127,29,29,0.5)" },
  today:     { label: "今天", color: "#f59e0b", bg: "rgba(120,53,15,0.5)" },
  this_week: { label: "本周", color: "#6b7280", bg: "rgba(31,41,55,0.7)" },
};

export const JUDGMENT = {
  exceeded: { label: "超预期",    bg: ACCENT,                    color: "black" },
  met:      { label: "符合预期",  bg: "rgba(255,255,255,0.1)",   color: "white" },
  below:    { label: "低于预期",  bg: "rgba(127,29,29,0.6)",     color: "#fca5a5" },
  abnormal: { label: "数据异常",  bg: "rgba(120,53,15,0.6)",     color: "#fcd34d" },
};
