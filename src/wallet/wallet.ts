import type {
  EarningRule,
  WalletLedgerEntry,
  WalletState,
  ExerciseType,
} from "@/lib/types";
import { getStore } from "@/storage";

let monotonic = 0;

function makeId(): string {
  monotonic += 1;
  return `${Date.now().toString(36)}-${monotonic.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
  return `${sec}s`;
}

export async function loadWallet(): Promise<WalletState> {
  const w = await getStore().getWallet();
  return w;
}

export function computeAvailable(w: WalletState, now: number): number {
  if (w.lastTickAt <= 0) return w.availableSeconds;
  const elapsedSec = Math.max(0, Math.floor((now - w.lastTickAt) / 1000));
  return Math.max(0, w.availableSeconds - elapsedSec);
}

export async function tickWallet(): Promise<WalletState> {
  const w = await getStore().getWallet();
  const now = Date.now();
  const available = computeAvailable(w, now);
  const next: WalletState = { ...w, availableSeconds: available, lastTickAt: now };
  await getStore().saveWallet(next);
  return next;
}

export async function creditSeconds(
  seconds: number,
  source: string,
  note?: string,
): Promise<WalletLedgerEntry> {
  if (seconds <= 0) throw new Error("credit must be positive");
  const w = await tickWallet();
  const entry: WalletLedgerEntry = {
    id: makeId(),
    type: "earn",
    seconds,
    timestamp: Date.now(),
    source,
    note,
  };
  const next: WalletState = {
    ...w,
    earnedSeconds: w.earnedSeconds + seconds,
    availableSeconds: w.availableSeconds + seconds,
    lastTickAt: Date.now(),
    ledger: [...w.ledger, entry].slice(-500),
  };
  await getStore().saveWallet(next);
  await getStore().appendLedger(entry);
  return entry;
}

export async function spendSeconds(seconds: number, note?: string): Promise<WalletLedgerEntry | null> {
  if (seconds <= 0) throw new Error("spend must be positive");
  const w = await tickWallet();
  if (w.availableSeconds <= 0) return null;
  const take = Math.min(seconds, w.availableSeconds);
  const entry: WalletLedgerEntry = {
    id: makeId(),
    type: "spend",
    seconds: take,
    timestamp: Date.now(),
    source: "spend",
    note,
  };
  const next: WalletState = {
    ...w,
    spentSeconds: w.spentSeconds + take,
    availableSeconds: w.availableSeconds - take,
    lastTickAt: Date.now(),
    ledger: [...w.ledger, entry].slice(-500),
  };
  await getStore().saveWallet(next);
  await getStore().appendLedger(entry);
  return entry;
}

export interface MatchedRule {
  rule: EarningRule;
  minutesPerRep: number;
}

export function matchRule(
  rules: EarningRule[],
  exercise: ExerciseType,
  reps: number,
): MatchedRule | null {
  const eligible = rules
    .filter((r) => r.enabled && r.exercise === exercise && reps >= r.reps)
    .sort((a, b) => b.reps - a.reps);
  return eligible[0]
    ? { rule: eligible[0], minutesPerRep: eligible[0].minutes / eligible[0].reps }
    : null;
}

export function applyRule(
  rules: EarningRule[],
  exercise: ExerciseType,
  reps: number,
): { matchedRule: EarningRule | null; earnedSeconds: number } {
  const m = matchRule(rules, exercise, reps);
  if (!m) return { matchedRule: null, earnedSeconds: 0 };
  return {
    matchedRule: m.rule,
    earnedSeconds: Math.round(m.minutesPerRep * reps * 60),
  };
}