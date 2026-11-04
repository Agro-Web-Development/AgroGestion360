import type { OfflineCatalog } from "./catalog"
import type { OfflinePhoto, OfflineRecord } from "./queue"

/**
 * Almacenamiento local de la captura sin conexión (IndexedDB, por origen y por
 * perfil del navegador; nunca en cachés compartidos).
 *
 *   records  registros capturados (llave: id local)
 *   photos   fotografías pendientes de carga (Blob), ligadas a un registro
 *   meta     sesión y catálogos descargados, por usuario
 */
const DB_NAME = "agrogestion360-campo"
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

export function isSupported(): boolean {
  return typeof indexedDB !== "undefined"
}

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains("records")) {
        const records = db.createObjectStore("records", { keyPath: "localId" })
        records.createIndex("by_user", "userId")
      }
      if (!db.objectStoreNames.contains("photos")) {
        db.createObjectStore("photos", { keyPath: "id" }).createIndex("by_record", "recordId")
      }
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" })
    }
    request.onsuccess = () => {
      const db = request.result
      // Otra pestaña con una versión nueva de la BD: cerrar para no bloquearla.
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }
    request.onerror = () => {
      dbPromise = null
      reject(request.error)
    }
  })
  return dbPromise
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function tx<T>(
  stores: string[],
  mode: IDBTransactionMode,
  run: (t: IDBTransaction) => Promise<T> | T
): Promise<T> {
  const db = await openDb()
  const t = db.transaction(stores, mode)
  const done = new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error ?? new Error("Transacción cancelada"))
  })
  const result = await run(t)
  await done
  return result
}

// ----------------------------------------------------------------------------
// Registros
// ----------------------------------------------------------------------------
export function listRecords(userId: string): Promise<OfflineRecord[]> {
  return tx(["records"], "readonly", async (t) => {
    const rows = await promisify(t.objectStore("records").index("by_user").getAll(userId))
    return (rows as OfflineRecord[]).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
  })
}

export function getRecord(localId: string): Promise<OfflineRecord | undefined> {
  return tx(["records"], "readonly", (t) => promisify(t.objectStore("records").get(localId)))
}

/** Guarda el registro y sus fotografías en una sola transacción. */
export function saveRecord(record: OfflineRecord, photos: OfflinePhoto[] = []): Promise<void> {
  return tx(["records", "photos"], "readwrite", (t) => {
    t.objectStore("records").put(record)
    for (const photo of photos) t.objectStore("photos").put(photo)
  })
}

export function putRecord(record: OfflineRecord): Promise<void> {
  return tx(["records"], "readwrite", (t) => {
    t.objectStore("records").put(record)
  })
}

/** Actualiza un registro con una función sobre su estado actual (evita sobrescribir cambios de otra pestaña). */
export function updateRecord(localId: string, change: (record: OfflineRecord) => OfflineRecord): Promise<OfflineRecord | undefined> {
  return tx(["records"], "readwrite", async (t) => {
    const store = t.objectStore("records")
    const current = (await promisify(store.get(localId))) as OfflineRecord | undefined
    if (!current) return undefined
    const next = change(current)
    store.put(next)
    return next
  })
}

export function deleteRecord(localId: string): Promise<void> {
  return tx(["records", "photos"], "readwrite", async (t) => {
    t.objectStore("records").delete(localId)
    const keys = await promisify(t.objectStore("photos").index("by_record").getAllKeys(localId))
    for (const key of keys) t.objectStore("photos").delete(key)
  })
}

// ----------------------------------------------------------------------------
// Fotografías
// ----------------------------------------------------------------------------
export function listPhotos(recordId: string): Promise<OfflinePhoto[]> {
  return tx(["photos"], "readonly", (t) => promisify(t.objectStore("photos").index("by_record").getAll(recordId)))
}

export function putPhoto(photo: OfflinePhoto): Promise<void> {
  return tx(["photos"], "readwrite", (t) => {
    t.objectStore("photos").put(photo)
  })
}

export function deletePhoto(id: string): Promise<void> {
  return tx(["photos"], "readwrite", (t) => {
    t.objectStore("photos").delete(id)
  })
}

// ----------------------------------------------------------------------------
// Sesión y catálogos
// ----------------------------------------------------------------------------
export type StoredContext = { key: "context"; catalog: OfflineCatalog; savedAt: string }

export async function getContext(): Promise<OfflineCatalog | null> {
  const row = await tx(["meta"], "readonly", (t) => promisify(t.objectStore("meta").get("context")))
  return (row as StoredContext | undefined)?.catalog ?? null
}

export function saveContext(catalog: OfflineCatalog): Promise<void> {
  return tx(["meta"], "readwrite", (t) => {
    t.objectStore("meta").put({ key: "context", catalog, savedAt: new Date().toISOString() } satisfies StoredContext)
  })
}

/**
 * Al cerrar sesión se borran la sesión y los catálogos del dispositivo. Los
 * registros sin sincronizar se conservan (son datos capturados que no deben
 * perderse) y solo se muestran y envían cuando vuelve a entrar su autor.
 */
export function clearContext(): Promise<void> {
  if (!isSupported()) return Promise.resolve()
  return tx(["meta"], "readwrite", (t) => {
    t.objectStore("meta").delete("context")
  })
}
