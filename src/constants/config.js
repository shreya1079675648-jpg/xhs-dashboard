// Global config — colors, content pillars, statuses, type colors, etc.
export const ACCENT = "#C8FF00";
export const BG = "#0a0a0a";
export const CARD = "#141414";
export const BORDER = "#1e1e1e";
export const MUTED = "#555";

export const PILLARS = ["全部", "人生重铸", "奥德赛模板", "身体重铸", "副业实验", "北漂生活", "AI工具"];
export const STATUSES = ["灵感池", "待写", "写作中", "待发布", "已发布"];

export const TYPE_COLOR = {
  人生重铸: "#DDF76A",
  奥德赛模板: "#DCD7F4",
  身体重铸: "#D8E8EF",
  副业实验: "#F0D5C5",
  北漂生活: "#DDEDE3",
};

export const STATUS_DOT = {
  已发布: "#C8FF00", 待发布: "#ffffff", 草稿: "#8A8E86", 待写: "#8A8E86",
};

export const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const MONTH_NAMES = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

export const CAL_TYPE_GROUPS = {
  "全部": [],
  "人生设计": ["人生重铸", "奥德赛模板"],
  "生活实验": ["身体重铸", "北漂生活"],
  "探索区": ["副业实验", "AI工具"],
};

export const CAL_STATUS_OPTIONS = ["灵感池", "待写", "写作中", "待发布", "已发布", "草稿"];

export const WEEK_SLOTS = [
  { day: "周二", time: "21:00", type: "人生重铸" },
  { day: "周四", time: "21:00", type: "观点/干货" },
  { day: "周六", time: "21:00", type: "副线/运动" },
  { day: "周日", time: "20:30", type: "周复盘" },
];
