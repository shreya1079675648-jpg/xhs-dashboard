// ═════════════════════════════════════════════════════════════════
// Supabase service layer — wraps all DB reads/writes.
// All functions assume user is authenticated; RLS enforces isolation.
// ═════════════════════════════════════════════════════════════════
import { supabase } from './supabase';

/* ─── Field name mappers (JS camelCase ↔ DB snake_case) ───────── */

const topicToDb = (t, userId) => ({
  id: t.id,
  user_id: userId,
  title: t.title,
  pillar: t.pillar ?? null,
  status: t.status ?? '灵感池',
  score: t.score ?? 70,
  scored_at: t.scoredAt ?? null,
  goal: t.goal ?? null,
  tag: t.tag ?? null,
  note_type: t.noteType ?? 'image',
  publish_time: t.publishTime ?? null,
  tags: t.tags ?? [],
  cover_text: t.coverText ?? null,
  cover_image_path: t.coverImagePath ?? null,
  ai_prediction: t.aiPrediction ?? null,
  snapshots: t.snapshots ?? [],
  auto_scheduled: t.autoScheduled ?? false,
  body: t.body ?? null,
});

const topicFromDb = (r) => ({
  id: r.id,
  title: r.title,
  pillar: r.pillar,
  status: r.status,
  score: r.score,
  scoredAt: r.scored_at,
  goal: r.goal,
  tag: r.tag,
  noteType: r.note_type,
  publishTime: r.publish_time,
  tags: r.tags ?? [],
  coverText: r.cover_text,
  coverImagePath: r.cover_image_path,
  aiPrediction: r.ai_prediction,
  snapshots: r.snapshots ?? [],
  autoScheduled: r.auto_scheduled,
  body: r.body ?? '',
  // images + coverImage hydrated separately (stage 4.3)
});

const commentToDb = (c, userId) => ({
  id: c.id,
  user_id: userId,
  scene: c.scene ?? null,
  reply: c.reply ?? null,
  tag: c.tag ?? null,
});

const commentFromDb = (r) => ({
  id: r.id,
  scene: r.scene,
  reply: r.reply,
  tag: r.tag,
});

/* ─── TOPICS ─────────────────────────────────────────────────── */

export async function fetchTopics() {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(topicFromDb);
}

export async function upsertTopic(topic, userId) {
  const row = topicToDb(topic, userId);
  const { error } = await supabase.from('topics').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

export async function upsertTopicsBatch(topics, userId) {
  if (!topics.length) return;
  const rows = topics.map((t) => topicToDb(t, userId));
  const { error } = await supabase.from('topics').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteTopicRow(id) {
  const { error } = await supabase.from('topics').delete().eq('id', id);
  if (error) throw error;
}

/* ─── COMMENTS ───────────────────────────────────────────────── */

export async function fetchComments() {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(commentFromDb);
}

export async function upsertComment(comment, userId) {
  const row = commentToDb(comment, userId);
  const { error } = await supabase.from('comments').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteCommentRow(id) {
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) throw error;
}

/* ─── PATTERN REPORTS (AI 规律报告) ──────────────────────────── */

const patternToDb = (p, userId) => ({
  user_id: userId,
  hit_patterns: p.hitPatterns ?? null,
  fail_patterns: p.failPatterns ?? null,
  strategies: p.strategies ?? null,
  skill_evolution: p.skillEvolution ?? null,
  analyzed_at: p.analyzedAt ?? null,
  analyzed_count: p.analyzedCount ?? null,
});

const patternFromDb = (r) => ({
  hitPatterns: r.hit_patterns,
  failPatterns: r.fail_patterns,
  strategies: r.strategies,
  skillEvolution: r.skill_evolution,
  analyzedAt: r.analyzed_at,
  analyzedCount: r.analyzed_count,
});

export async function fetchPatternReport() {
  const { data, error } = await supabase
    .from('pattern_reports')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ? patternFromDb(data) : null;
}

export async function upsertPatternReport(report, userId) {
  const row = patternToDb(report, userId);
  const { error } = await supabase
    .from('pattern_reports')
    .upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

/* ─── ONE-TIME MIGRATION FROM LOCALSTORAGE ──────────────────── */

/**
 * If Supabase is empty for this user but localStorage has data, migrate it.
 * Returns { migratedTopics, migratedComments, migratedReport } counts.
 */
export async function migrateLocalToSupabase(userId) {
  const result = { migratedTopics: 0, migratedComments: 0, migratedReport: false };

  // Check if Supabase already has data
  const existing = await fetchTopics();
  if (existing.length > 0) return result; // already migrated

  // Read local topics
  try {
    const raw = localStorage.getItem('xhs_topics_v1');
    if (raw) {
      const localTopics = JSON.parse(raw);
      if (Array.isArray(localTopics) && localTopics.length > 0) {
        await upsertTopicsBatch(localTopics, userId);
        result.migratedTopics = localTopics.length;
      }
    }
  } catch (e) {
    console.warn('[migrate] topics failed', e);
  }

  // Read local comments
  try {
    const raw = localStorage.getItem('xhs_comments_v1');
    if (raw) {
      const localComments = JSON.parse(raw);
      if (Array.isArray(localComments) && localComments.length > 0) {
        for (const c of localComments) {
          await upsertComment(c, userId);
        }
        result.migratedComments = localComments.length;
      }
    }
  } catch (e) {
    console.warn('[migrate] comments failed', e);
  }

  // Read local pattern report
  try {
    const raw = localStorage.getItem('xhs_pattern_ai_v1');
    if (raw) {
      const local = JSON.parse(raw);
      if (local && local.hitPatterns) {
        await upsertPatternReport(local, userId);
        result.migratedReport = true;
      }
    }
  } catch (e) {
    console.warn('[migrate] pattern report failed', e);
  }

  return result;
}
