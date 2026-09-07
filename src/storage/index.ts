import type {
  UserSettings,
  WalletLedgerEntry,
  WalletState,
  WorkoutSession,
} from "@/lib/types";
import { DEFAULT_SETTINGS, DEFAULT_WALLET, type Store } from "./contract";

let store: Store | null = null;

export function setStore(s: Store) {
  store = s;
}

export function getStore(): Store {
  if (!store) throw new Error("Store not initialized");
  return store;
}

export async function initStorage(): Promise<Store> {
  if (store) return store;
  const idb = (await import("./indexedDb")).IndexedDbStore;
  const s = new idb();
  await s.init();
  store = s;
  return s;
}

export type { Store } from "./contract";
export {
  DEFAULT_SETTINGS,
  DEFAULT_WALLET,
  DEFAULT_THRESHOLDS,
  DEFAULT_RULES,
  DEFAULT_APPS,
} from "./contract";
export type {
  UserSettings,
  WalletState,
  WalletLedgerEntry,
  WorkoutSession,
  EarningRule,
  DistractingApp,
  PushupThresholds,
  ExerciseType,
  ExerciseConfig,
} from "@/lib/types";