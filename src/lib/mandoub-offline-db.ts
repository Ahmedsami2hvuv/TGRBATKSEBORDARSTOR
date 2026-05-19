/**
 * إدارة قاعدة البيانات المحلية للمندوب (IndexedDB)
 * لدعم العمل دون اتصال (Offline-first)
 */

export interface PendingWalletAction {
  id: string; // معرف فريد للعملية محلياً
  actionType: 'submit_misc' | 'delete_misc' | 'delete_event' | 'transfer' | 'pickup' | 'delivery' | 'edit_customer' | 'set_location' | 'clear_location' | 'upload_shop_door' | 'upload_customer_door' | 'upload_order_image' | 'bulk_status';
  formData: Record<string, string>;
  fileData?: { name: string; type: string; blob: Blob } | null; // لدعم رفع الصور أوفلاين
  timestamp: number;
  retryCount: number;
}

const DB_NAME = 'MandoubOfflineDB';
const STORE_NAME = 'pendingActions';
const DB_VERSION = 1;

export async function openMandoubDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function savePendingAction(action: PendingWalletAction): Promise<void> {
  const db = await openMandoubDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(action);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingActions(): Promise<PendingWalletAction[]> {
  const db = await openMandoubDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deletePendingAction(id: string): Promise<void> {
  const db = await openMandoubDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
