import type {
  UserSettings,
  WalletLedgerEntry,
  WalletState,
  WorkoutSession,
} from "@/lib/types";
import {
  DEFAULT_SETTINGS,
  DEFAULT_WALLET,
  type Store,
} from "./contract";

const DB_NAME = "earnyst";
const DB_VERSION = 1;

const STORES = {
  settings: "settings",
  wallet: "wallet",
  ledger: "ledger",
  sessions: "sessions",
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings);
      }
      if (!db.objectStoreNames.contains(STORES.wallet)) {
        db.createObjectStore(STORES.wallet);
      }
      if (!db.objectStoreNames.contains(STORES.ledger)) {
        const s = db.createObjectStore(STORES.ledger, { keyPath: "id" });
        s.createIndex("ts", "timestamp");
      }
      if (!db.objectStoreNames.contains(STORES.sessions)) {
        const s = db.createObjectStore(STORES.sessions, { keyPath: "id" });
        s.createIndex("startedAt", "startedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(
  stores: string | string[],
  mode: IDBTransactionMode,
): Promise<IDBTransaction> {
  return openDb().then(
    (db) =>
      new Promise<IDBTransaction>((resolve, reject) => {
        const t = db.transaction(stores, mode);
        t.oncomplete = () => resolve(t);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class IndexedDbStore implements Store {
  async init(): Promise<void> {
    await openDb();
  }

  async getSettings(): Promise<UserSettings> {
    const t = await tx(STORES.settings, "readonly");
    const v = await reqAsPromise(t.objectStore(STORES.settings).get("me"));
    return (v as UserSettings | undefined) ?? DEFAULT_SETTINGS;
  }

  async saveSettings(s: UserSettings): Promise<void> {
    const t = await tx(STORES.settings, "readwrite");
    await reqAsPromise(
      t.objectStore(STORES.settings).put(s, "me"),
    );
  }

  async getWallet(): Promise<WalletState> {
    const t = await tx(STORES.wallet, "readonly");
    const v = await reqAsPromise(t.objectStore(STORES.wallet).get("me"));
    return (v as WalletState | undefined) ?? { ...DEFAULT_WALLET, lastTickAt: Date.now() };
  }

  async saveWallet(w: WalletState): Promise<void> {
    const t = await tx(STORES.wallet, "readwrite");
    await reqAsPromise(t.objectStore(STORES.wallet).put(w, "me"));
  }

  async appendLedger(e: WalletLedgerEntry): Promise<void> {
    const t = await tx(STORES.ledger, "readwrite");
    await reqAsPromise(t.objectStore(STORES.ledger).put(e));
  }

  async appendSession(s: WorkoutSession): Promise<void> {
    const t = await tx(STORES.sessions, "readwrite");
    await reqAsPromise(t.objectStore(STORES.sessions).put(s));
  }

  async listSessions(limit = 50): Promise<WorkoutSession[]> {
    const t = await tx(STORES.sessions, "readonly");
    const all = (await reqAsPromise(
      t.objectStore(STORES.sessions).getAll(),
    )) as WorkoutSession[];
    return all.sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
  }

  async clear(): Promise<void> {
    const t = await tx(
      [
        STORES.settings,
        STORES.wallet,
        STORES.ledger,
        STORES.sessions,
      ],
      "readwrite",
    );
    await Promise.all([
      reqAsPromise(t.objectStore(STORES.settings).clear()),
      reqAsPromise(t.objectStore(STORES.wallet).clear()),
      reqAsPromise(t.objectStore(STORES.ledger).clear()),
      reqAsPromise(t.objectStore(STORES.sessions).clear()),
    ]);
  }
}