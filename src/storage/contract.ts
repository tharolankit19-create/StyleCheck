import type {
  DistractingApp,
  EarningRule,
  PushupThresholds,
  UserSettings,
  WalletLedgerEntry,
  WalletState,
  WorkoutSession,
} from "@/lib/types";

export const DEFAULT_THRESHOLDS: PushupThresholds = {
  upAngleDeg: 155,
  downAngleDeg: 95,
  minConfidence: 0.55,
  minRepMs: 700,
  maxRepMs: 5000,
  minShoulderHipAlignment: 0.5,
  maxShoulderHipAlignment: 1.4,
  bodyVisibilityFramesRequired: 6,
  cooldownMs: 250,
};

export const DEFAULT_RULES: EarningRule[] = [
  {
    id: "rule-1-1",
    exercise: "pushup",
    reps: 1,
    minutes: 1,
    label: "1 push-up = 1 min",
    enabled: true,
    createdAt: Date.now(),
  },
  {
    id: "rule-10-15",
    exercise: "pushup",
    reps: 10,
    minutes: 15,
    label: "10 push-ups = 15 min",
    enabled: true,
    createdAt: Date.now(),
  },
  {
    id: "rule-20-20",
    exercise: "squat",
    reps: 20,
    minutes: 20,
    label: "20 squats = 20 min",
    enabled: true,
    createdAt: Date.now(),
  },
];

export const DEFAULT_APPS: DistractingApp[] = [
  { id: "instagram", displayName: "Instagram", blocked: true },
  { id: "youtube", displayName: "YouTube", blocked: true },
  { id: "x", displayName: "X (Twitter)", blocked: true },
  { id: "tiktok", displayName: "TikTok", blocked: true },
  { id: "reddit", displayName: "Reddit", blocked: true },
  { id: "facebook", displayName: "Facebook", blocked: false },
  { id: "snapchat", displayName: "Snapchat", blocked: false },
];

export const DEFAULT_SETTINGS: UserSettings = {
  onboarded: false,
  rules: DEFAULT_RULES,
  apps: DEFAULT_APPS,
  thresholds: DEFAULT_THRESHOLDS,
  streakLastDay: null,
  streakCount: 0,
  preferredExercise: "pushup",
};

export const DEFAULT_WALLET: WalletState = {
  earnedSeconds: 0,
  spentSeconds: 0,
  availableSeconds: 0,
  lastTickAt: 0,
  ledger: [],
};

export interface Store {
  init(): Promise<void>;
  getSettings(): Promise<UserSettings>;
  saveSettings(s: UserSettings): Promise<void>;
  getWallet(): Promise<WalletState>;
  saveWallet(w: WalletState): Promise<void>;
  appendLedger(e: WalletLedgerEntry): Promise<void>;
  appendSession(s: WorkoutSession): Promise<void>;
  listSessions(limit?: number): Promise<WorkoutSession[]>;
  clear(): Promise<void>;
}