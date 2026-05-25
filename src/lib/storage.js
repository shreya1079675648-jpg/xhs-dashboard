// ═════════════════════════════════════════════════════════════════
// Supabase Storage service layer — note images + covers.
// Path convention: {user_id}/topics/{topic_id}/{images/<id>.ext | cover.ext}
// First folder = user_id, satisfies bucket RLS policy.
// ═════════════════════════════════════════════════════════════════
import { supabase, SUPABASE_STORAGE_BUCKET as BUCKET } from './supabase';

const SIGNED_URL_TTL = 60 * 60 * 24; // 24 hours

const extFromName = (name = '') => {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : 'png';
};

const blobFromDataUrl = async (dataUrl) => {
  const res = await fetch(dataUrl);
  return await res.blob();
};

/* ─── NOTE IMAGES ────────────────────────────────────────────── */

export async function uploadNoteImage(file, { userId, topicId, imageId }) {
  const ext = extFromName(file.name || 'image.png');
  const path = `${userId}/topics/${topicId}/images/${imageId}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || 'image/png',
  });
  if (error) throw error;
  return path;
}

export async function deleteStoragePath(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn('[storage] delete failed', error);
}

export async function getSignedUrl(path) {
  if (!path) return '';
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error) {
    console.warn('[storage] signed url failed', error);
    return '';
  }
  return data.signedUrl;
}

export async function getSignedUrls(paths) {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);
  if (error) {
    console.warn('[storage] batch signed urls failed', error);
    return {};
  }
  const out = {};
  data.forEach((entry) => {
    if (entry.signedUrl) out[entry.path] = entry.signedUrl;
  });
  return out;
}

/* ─── DB METADATA: note_images table ─────────────────────────── */

export async function insertNoteImageRow({ id, topicId, userId, storagePath, displayOrder, name, size }) {
  const { error } = await supabase.from('note_images').insert({
    id,
    topic_id: topicId,
    user_id: userId,
    storage_path: storagePath,
    display_order: displayOrder,
    name,
    size,
  });
  if (error) throw error;
}

export async function deleteNoteImageRow(id) {
  const { error } = await supabase.from('note_images').delete().eq('id', id);
  if (error) console.warn('[storage] delete row failed', error);
}

export async function updateNoteImageOrder(id, displayOrder) {
  const { error } = await supabase
    .from('note_images')
    .update({ display_order: displayOrder })
    .eq('id', id);
  if (error) console.warn('[storage] update order failed', error);
}

export async function fetchAllNoteImages() {
  const { data, error } = await supabase
    .from('note_images')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/* ─── COVER (single per topic) ───────────────────────────────── */

export async function uploadCoverFromDataUrl(dataUrl, { userId, topicId }) {
  if (!dataUrl) return null;
  const blob = await blobFromDataUrl(dataUrl);
  const isSvg = (blob.type || '').includes('svg') || dataUrl.startsWith('data:image/svg');
  const ext = isSvg ? 'svg' : 'png';
  const path = `${userId}/topics/${topicId}/cover.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: '3600',
    upsert: true,
    contentType: isSvg ? 'image/svg+xml' : blob.type || 'image/png',
  });
  if (error) throw error;
  return path;
}

export async function uploadCoverFromFile(file, { userId, topicId }) {
  const ext = extFromName(file.name || 'cover.png');
  const path = `${userId}/topics/${topicId}/cover.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || 'image/png',
  });
  if (error) throw error;
  return path;
}

/* ─── HYDRATION HELPER ──────────────────────────────────────── */

/**
 * Given an array of topics, populate each topic.images[] from note_images table
 * + cover image signed URL. Returns topics with hydrated image fields.
 */
export async function hydrateTopicImages(topics) {
  // 1. Fetch all note_images rows for current user (RLS-filtered)
  const rows = await fetchAllNoteImages();

  // 2. Group by topic_id
  const byTopic = {};
  for (const r of rows) {
    if (!byTopic[r.topic_id]) byTopic[r.topic_id] = [];
    byTopic[r.topic_id].push(r);
  }

  // 3. Collect all storage paths (images + covers) for batch signed URL
  const allPaths = new Set();
  rows.forEach((r) => r.storage_path && allPaths.add(r.storage_path));
  topics.forEach((t) => t.coverImagePath && allPaths.add(t.coverImagePath));

  const urlMap = await getSignedUrls([...allPaths]);

  // 4. Inject images + coverImage URL into topics
  return topics.map((t) => {
    const imgRows = (byTopic[t.id] || []).sort(
      (a, b) => (a.display_order || 0) - (b.display_order || 0)
    );
    const images = imgRows.map((r) => ({
      id: r.id,
      storagePath: r.storage_path,
      dataUrl: urlMap[r.storage_path] || '',
      name: r.name,
      size: r.size,
    }));
    const coverImage = t.coverImagePath ? urlMap[t.coverImagePath] || '' : '';
    return { ...t, images, coverImage };
  });
}
