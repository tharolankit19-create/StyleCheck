import { create } from "zustand";
import type {
  DistractingApp,
  EarningRule,
  PushupThresholds,
  UserSettings,
  WalletState,
  WorkoutSession,
} from "@/lib/types";
import {
  DEFAULT_SETTINGS,
  getStore,
  initStorage,
  setStore,
} from "@/storage";
import { creditSeconds, tickWallet, spendSeconds } from "@/wallet/wallet";

interface State {
  ready: boolean;
  settings: UserSettings;
  wallet: WalletState;
  sessions: WorkoutSession[];
  refresh: () => Promise<void>;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  setRules: (rules: EarningRule[]) => Promise<void>;
  upsertRule: (rule: EarningRule) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  toggleRule: (id: string) => Promise<void>;
  setApps: (apps: DistractingApp[]) => Promise<void>;
  toggleAppBlocked: (id: string) => Promise<void>;
  setThresholds: (t: PushupThresholds) => Promise<void>;
  setPreferredExercise: (e: UserSettings["preferredExercise"]) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  finishWorkout: (s: WorkoutSession) => Promise<void>;
  spend: (seconds: number, note?: string) => Promise<boolean>;
  tick: () => Promise<void>;
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  settings: DEFAULT_SETTINGS,
  wallet: { earnedSeconds: 0, spentSeconds: 0, availableSeconds: 0, lastTickAt: 0, ledger: [] },
  sessions: [],

  async refresh() {
    const s = getStore();
    const settings = await s.getSettings();
    const wallet = await tickWallet();
    const sessions = await s.listSessions(100);
    set({ settings, wallet, sessions, ready: true });
  },

  async updateSettings(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    await getStore().saveSettings(settings);
  },

  async setRules(rules) {
    await get().updateSettings({ rules });
  },

  async upsertRule(rule) {
    const rules = get().settings.rules.slice();
    const idx = rules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) rules[idx] = rule;
    else rules.push(rule);
    await get().setRules(rules);
  },

  async deleteRule(id) {
    await get().setRules(get().settings.rules.filter((r) => r.id !== id));
  },

  async toggleRule(id) {
    const rules = get().settings.rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r,
    );
    await get().setRules(rules);
  },

  async setApps(apps) {
    await get().updateSettings({ apps });
  },

  async toggleAppBlocked(id) {
    const apps = get().settings.apps.map((a) =>
      a.id === id ? { ...a, blocked: !a.blocked } : a,
    );
    await get().setApps(apps);
  },

  async setThresholds(t) {
    await get().updateSettings({ thresholds: t });
  },

  async setPreferredExercise(e) {
    await get().updateSettings({ preferredExercise: e });
  },

  async completeOnboarding() {
    await get().updateSettings({ onboarded: true });
  },

  async finishWorkout(session) {
    const store = getStore();
    await store.appendSession(session);
    const { earnedSeconds } = session;
    if (earnedSeconds > 0) {
      await creditSeconds(
        earnedSeconds,
        `workout:${session.exercise}`,
        `${session.verifiedReps} ${session.exercise} reps`,
      );
    }
    const sessions = await store.listSessions(100);
    const wallet = await tickWallet();
    const settings = get().settings;
    const today = new Date().toISOString().slice(0, 10);
    let { streakCount, streakLastDay } = settings;
    if (streakLastDay !== today) {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      streakCount = streakLastDay === yesterday ? streakCount + 1 : 1;
      streakLastDay = today;
    }
    await get().updateSettings({ streakCount, streakLastDay });
    set({ sessions, wallet, settings: { ...settings, streakCount, streakLastDay } });
  },

  async spend(seconds, note) {
    const ok = await spendSeconds(seconds, note);
    if (ok) {
      const w = await tickWallet();
      set({ wallet: w });
    }
    return Boolean(ok);
  },

  async tick() {
    const w = await tickWallet();
    set({ wallet: w });
  },
}));

export async function bootstrap(): Promise<void> {
  const store = await initStorage();
  setStore(store);
  await useStore.getState().refresh();
}