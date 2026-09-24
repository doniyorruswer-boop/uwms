/**
 * UWMS - Oflayn Audit va QR-Skaner IndexedDB Xotirasi
 *
 * Internet aloqasi yo'q bo'lgan vaqtda (yer osti omborlari, laboratoriyalar)
 * o'qilgan barcha QR-kodlarni brauzerning IndexedDB xotirasida saqlash,
 * internet tiklanganda esa serverga ommaviy sinxronlash (batch-scan) uchun xizmat qiladi.
 */

export interface OfflineScanRecord {
  id: string;
  qrCode: string;
  roomId: string;
  campaignId?: string;
  timestamp: number;
  synced?: boolean;
  notes?: string;
}

const DB_NAME = 'UWMS_AUDIT_OFFLINE_DB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_scans';
const FALLBACK_LOCALSTORAGE_KEY = 'uwms_audit_offline_queue';

let dbInstance: IDBDatabase | null = null;

/**
 * IndexedDB ma'lumotlar bazasini ochish va kerakli storelarni yaratish
 */
export async function openAuditDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (typeof window === 'undefined' || !window.indexedDB) {
    throw new Error('IndexedDB ushbu muhitda qo‘llab-quvvatlanmaydi.');
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('roomId', 'roomId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Yangi skaner qilingan elementni oflayn navbatga saqlash
 */
export async function saveOfflineScan(
  scan: Omit<OfflineScanRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: number },
): Promise<OfflineScanRecord> {
  const record: OfflineScanRecord = {
    id: scan.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `offline-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`),
    qrCode: scan.qrCode.trim(),
    roomId: scan.roomId,
    campaignId: scan.campaignId,
    timestamp: scan.timestamp || Date.now(),
    synced: false,
    notes: scan.notes,
  };

  try {
    const db = await openAuditDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB saqlashda xatolik, localStorage fallback ishlatilmoqda:', err);
    saveToLocalStorageFallback(record);
  }

  return record;
}

/**
 * Barcha oflayn skanlarni olish (ixtiyoriy ravishda xona bo'yicha filtrlash)
 */
export async function getAllOfflineScans(roomId?: string): Promise<OfflineScanRecord[]> {
  try {
    const db = await openAuditDB();
    return await new Promise<OfflineScanRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        let results = (req.result as OfflineScanRecord[]) || [];
        if (roomId) {
          results = results.filter((item) => item.roomId === roomId);
        }
        // Eng yangilaridan tartiblash
        results.sort((a, b) => b.timestamp - a.timestamp);

        // Fallbackdagi ma'lumotlar bilan birlashtirish
        const fallback = getFromLocalStorageFallback(roomId);
        const combinedMap = new Map<string, OfflineScanRecord>();
        results.forEach((item) => combinedMap.set(item.id, item));
        fallback.forEach((item) => combinedMap.set(item.id, item));

        resolve(Array.from(combinedMap.values()).sort((a, b) => b.timestamp - a.timestamp));
      };

      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB dan o‘qishda xatolik, localStorage ishlatilmoqda:', err);
    return getFromLocalStorageFallback(roomId);
  }
}

/**
 * Muayyan ID ga ega oflayn yozuvni o'chirish
 */
export async function removeOfflineScan(id: string): Promise<void> {
  try {
    const db = await openAuditDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB dan o‘chirishda xatolik:', err);
  }

  removeFromLocalStorageFallback(id);
}

/**
 * Bir nechta ID larni bir vaqtda o'chirish (Sinxronizatsiya muvaffaqiyatli yakunlangach)
 */
export async function removeOfflineScans(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;

  try {
    const db = await openAuditDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      ids.forEach((id) => store.delete(id));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB ommaviy o‘chirishda xatolik:', err);
  }

  const idSet = new Set(ids);
  const fallback = getFromLocalStorageFallback();
  const remaining = fallback.filter((item) => !idSet.has(item.id));
  try {
    localStorage.setItem(FALLBACK_LOCALSTORAGE_KEY, JSON.stringify(remaining));
  } catch {
    // ignore
  }
}

/**
 * Barcha oflayn navbatni tozalash
 */
export async function clearOfflineQueue(roomId?: string): Promise<void> {
  try {
    const db = await openAuditDB();
    if (roomId) {
      const allScans = await getAllOfflineScans(roomId);
      const idsToDelete = allScans.map((s) => s.id);
      await removeOfflineScans(idsToDelete);
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB tozalashda xatolik:', err);
  }

  if (!roomId) {
    try {
      localStorage.removeItem(FALLBACK_LOCALSTORAGE_KEY);
    } catch {
      // ignore
    }
  } else {
    const fallback = getFromLocalStorageFallback();
    const remaining = fallback.filter((item) => item.roomId !== roomId);
    try {
      localStorage.setItem(FALLBACK_LOCALSTORAGE_KEY, JSON.stringify(remaining));
    } catch {
      // ignore
    }
  }
}

/**
 * Oflayn navbatdagi elementlar sonini hisoblash
 */
export async function countOfflineScans(roomId?: string): Promise<number> {
  const scans = await getAllOfflineScans(roomId);
  return scans.length;
}

// ==========================================
// LocalStorage Fallback Yordamchilari
// ==========================================

function getFromLocalStorageFallback(roomId?: string): OfflineScanRecord[] {
  try {
    const raw = localStorage.getItem(FALLBACK_LOCALSTORAGE_KEY);
    if (!raw) return [];
    const parsed: OfflineScanRecord[] = JSON.parse(raw);
    if (roomId) {
      return parsed.filter((item) => item.roomId === roomId);
    }
    return parsed;
  } catch {
    return [];
  }
}

function saveToLocalStorageFallback(record: OfflineScanRecord): void {
  try {
    const list = getFromLocalStorageFallback();
    const existingIndex = list.findIndex((item) => item.id === record.id);
    if (existingIndex >= 0) {
      list[existingIndex] = record;
    } else {
      list.push(record);
    }
    localStorage.setItem(FALLBACK_LOCALSTORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('LocalStorage saqlashda xato:', e);
  }
}

function removeFromLocalStorageFallback(id: string): void {
  try {
    const list = getFromLocalStorageFallback();
    const filtered = list.filter((item) => item.id !== id);
    localStorage.setItem(FALLBACK_LOCALSTORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // ignore
  }
}
