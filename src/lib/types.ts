export type ExerciseType = "pushup" | "squat";

export interface EarningRule {
  id: string;
  exercise: ExerciseType;
  reps: number;
  minutes: number;
  label?: string;
  enabled: boolean;
  createdAt: number;
}

export interface DistractingApp {
  id: string;
  packageName?: string;
  displayName: string;
  blocked: boolean;
  perDayBudgetMinutes?: number;
}

export interface WorkoutSession {
  id: string;
  exercise: ExerciseType;
  startedAt: number;
  endedAt: number;
  verifiedReps: number;
  rejectedReps: number;
  earnedSeconds: number;
  configSnapshot: PushupThresholds;
}

export interface WalletLedgerEntry {
  id: string;
  type: "earn" | "spend";
  seconds: number;
  timestamp: number;
  source: string;
  note?: string;
}

export interface WalletState {
  earnedSeconds: number;
  spentSeconds: number;
  availableSeconds: number;
  lastTickAt: number;
  ledger: WalletLedgerEntry[];
}

export interface PushupThresholds {
  upAngleDeg: number;
  downAngleDeg: number;
  minConfidence: number;
  minRepMs: number;
  maxRepMs: number;
  minShoulderHipAlignment: number;
  maxShoulderHipAlignment: number;
  bodyVisibilityFramesRequired: number;
  cooldownMs: number;
}

export interface UserSettings {
  onboarded: boolean;
  rules: EarningRule[];
  apps: DistractingApp[];
  thresholds: PushupThresholds;
  streakLastDay: string | null;
  streakCount: number;
  preferredExercise: ExerciseType;
}

export interface ExerciseConfig {
  type: ExerciseType;
  displayName: string;
  description: string;
  emoji: string;
}