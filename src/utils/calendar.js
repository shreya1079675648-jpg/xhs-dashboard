// Calendar helpers
export const groupNotesByDate = (notes) => {
  const r = {};
  notes.forEach((n) => {
    const d = n.publish_date || "";
    if (!r[d]) r[d] = [];
    r[d].push(n);
  });
  return r;
};

export const buildCalendarCells = (year, monthIndex) => {
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  return cells;
};

export const formatDateKey = (year, monthIndex, day) =>
  `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export const getTodayStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

export const getMonthNotes = (notes, year, monthIndex) =>
  notes
    .filter((n) => {
      if (!n.publish_date) return false;
      const d = new Date(`${n.publish_date}T00:00:00`);
      return d.getFullYear() === year && d.getMonth() === monthIndex;
    })
    .sort((a, b) => (a.publish_date || "").localeCompare(b.publish_date || ""));

export const getCalDisplayDate = (note, todayStr) => {
  if (note.status === "待发布" && note.publish_date > todayStr) return "待定";
  return (note.publish_date || "").slice(5).replace("-", "/");
};
