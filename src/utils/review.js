// Review status tag computation
export const computeStatusTags = (note) => {
  if (!note.snapshots?.length) return ["PENDING"];
  const latest = note.snapshots[note.snapshots.length - 1];
  const first1h = note.snapshots.find((s) => s.type === "1h");
  const tags = [];
  const pred = note.aiPrediction?.predictions;
  const lr = latest.views > 0 ? (latest.likes / latest.views) * 100 : 0;
  const cr = latest.views > 0 ? (latest.collects / latest.views) * 100 : 0;
  const cmr = latest.views > 0 ? (latest.comments / latest.views) * 100 : 0;
  if (first1h && first1h.views < 500) tags.push("COLDFAIL");
  if (pred) {
    if (latest.views >= pred.views.max * 1.5) tags.push("HOT");
    else if (latest.views >= pred.views.median && (lr >= 6.0 || cr >= 5.0)) tags.push("EXCELLENT");
    else if (latest.views < pred.views.min && !tags.includes("COLDFAIL")) tags.push("UNDERPERF");
    else if (cr >= 5.0 && !tags.length) tags.push("POTENTIAL");
  }
  if (cmr >= 1.8) tags.push("TOPICAL");
  return tags.length ? tags : ["PENDING"];
};
