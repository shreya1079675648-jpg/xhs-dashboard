// Legacy IndexedDB image store — kept for backwards compatibility & fallback cleanup.
// Active image persistence is now Supabase Storage (lib/storage.js).
export const IDB_NAME = "xhs_images_db";
export const IDB_STORE = "note_images";

export const openImgDB = () =>
  new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });

export const idbSaveImages = async (noteId, images) => {
  try {
    const db = await openImgDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      if (!images || images.length === 0) store.delete(noteId);
      else store.put(images, noteId);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) {
    console.warn("[idb] save failed", e);
  }
};

export const idbLoadAllImages = async () => {
  try {
    const db = await openImgDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const result = {};
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cur = cursorReq.result;
        if (cur) {
          result[cur.key] = cur.value;
          cur.continue();
        } else res(result);
      };
      cursorReq.onerror = () => rej(cursorReq.error);
    });
  } catch (e) {
    console.warn("[idb] load failed", e);
    return {};
  }
};

export const idbDeleteImages = async (noteId) => {
  try {
    const db = await openImgDB();
    return new Promise((res) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(noteId);
      tx.oncomplete = () => res();
    });
  } catch (e) {}
};

export const idbSaveCover = async (noteId, dataUrl) => {
  try {
    const db = await openImgDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      if (!dataUrl) store.delete(`cover_${noteId}`);
      else store.put(dataUrl, `cover_${noteId}`);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) {
    console.warn("[idb] cover save failed", e);
  }
};
