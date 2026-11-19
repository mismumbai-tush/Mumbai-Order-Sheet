import { ProductOrderRow } from '../types/fms';

const DB_NAME = 'ginza_fms_db_v16_query_locked';
const DB_VERSION = 1;
const STORE_NAME = 'product_orders';

// Legacy keys that may hold stale Delhi dummy data
export const LEGACY_STORAGE_KEYS = [
  'ginza_fms_sheet_orders_v13',
  'ginza_fms_sheet_orders_v12',
  'ginza_fms_sheet_orders_v11',
  'ginza_fms_sheet_orders_v10',
  'fms_simulated_orders',
  'fms_orders_v1'
];

// Open or initialize IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check if a dataset contains legacy Delhi dummy orders
 */
export function hasDelhiDummyData(orders: ProductOrderRow[]): boolean {
  if (!Array.isArray(orders) || orders.length === 0) return false;
  return orders.some((r) => {
    const cust = (r.customerName || '').toLowerCase();
    const sales = (r.salesPerson || '').toLowerCase();
    const addr = (r.billingAddress || '').toLowerCase() + (r.deliveryAddress || '').toLowerCase();
    return (
      cust.includes('fashion dupatta') ||
      cust.includes('(delhi)') ||
      cust.includes('m g enterprises') ||
      sales.includes('lalit maroo') ||
      addr.includes('khajuri khas')
    );
  });
}

/**
 * Purge all legacy localStorage keys and IndexedDB databases containing stale Delhi data
 */
export async function purgeAllLegacyStorageAndCaches(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      LEGACY_STORAGE_KEYS.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {}
      });
    }
    if (typeof window !== 'undefined' && window.indexedDB) {
      try {
        window.indexedDB.deleteDatabase('ginza_fms_db_v13');
        window.indexedDB.deleteDatabase('ginza_fms_db_v12');
        window.indexedDB.deleteDatabase('ginza_fms_db_v10');
      } catch (e) {}
    }
  } catch (err) {
    console.warn('Error purging legacy caches:', err);
  }
}

/**
 * Save all product order rows (supports 10,000+ rows with zero quota error)
 */
export async function saveOrdersToStorage(orders: ProductOrderRow[]): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      // Store under fixed key 'current_dataset'
      store.put({ id: 'current_dataset', data: orders, updatedAt: Date.now() });

      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('IndexedDB save failed, falling back to localStorage if size allows', err);
    try {
      if (orders.length <= 1500) {
        localStorage.setItem('ginza_fms_query_orders_v16_locked', JSON.stringify(orders));
      }
    } catch (e) {}
    return false;
  }
}

/**
 * Load all product order rows from IndexedDB, filtering out any legacy Delhi data
 */
export async function loadOrdersFromStorage(): Promise<ProductOrderRow[] | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('current_dataset');

      req.onsuccess = () => {
        db.close();
        if (req.result && Array.isArray(req.result.data) && req.result.data.length > 0) {
          // If dataset contains old Delhi dummy data, discard it immediately
          if (hasDelhiDummyData(req.result.data)) {
            console.info('Detected legacy Delhi dummy data in cache — purging.');
            clearOrdersFromStorage();
            resolve(null);
            return;
          }
          resolve(req.result.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch (err) {
    return null;
  }
}

/**
 * Save all Product Automation / Closed Order rows (Col A to AQ)
 */
export async function saveAutomationOrdersToStorage(orders: ProductOrderRow[]): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ id: 'automation_dataset', data: orders, updatedAt: Date.now() });

      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch (err) {
    return false;
  }
}

/**
 * Load all Product Automation / Closed Order rows from IndexedDB
 */
export async function loadAutomationOrdersFromStorage(): Promise<ProductOrderRow[] | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('automation_dataset');

      req.onsuccess = () => {
        db.close();
        if (req.result && Array.isArray(req.result.data) && req.result.data.length > 0) {
          resolve(req.result.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch (err) {
    return null;
  }
}

/**
 * Wipe/clear all orders from storage
 */
export async function clearOrdersFromStorage(): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete('current_dataset');
      store.delete('automation_dataset');

      tx.oncomplete = () => {
        db.close();
        try {
          localStorage.removeItem('ginza_fms_query_orders_v16_locked');
          purgeAllLegacyStorageAndCaches();
        } catch (e) {}
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch (err) {
    try {
      localStorage.removeItem('ginza_fms_query_orders_v16_locked');
      purgeAllLegacyStorageAndCaches();
    } catch (e) {}
    return false;
  }
}
