import { registerPlugin } from "@capacitor/core";
import type { Plugin } from "@capacitor/core";

export interface ScreenTimeGuardPlugin extends Plugin {
  getElapsedRealtime(): Promise<{ elapsedRealtime: number; uptime: number }>;
  listInstalledApps(): Promise<{ apps: { packageName: string; label: string }[] }>;
  openUsageAccessSettings(): Promise<void>;
}

export interface ForegroundAppPlugin extends Plugin {
  getForegroundPackage(): Promise<{ packageName: string; timestamp: number }>;
  hasUsagePermission(): Promise<{ granted: boolean }>;
}

export const ScreenTimeGuard = registerPlugin<ScreenTimeGuardPlugin>(
  "ScreenTimeGuard",
  {
    web: () => ({
      async getElapsedRealtime() {
        const t = performance.now();
        return { elapsedRealtime: Date.now() - t, uptime: t };
      },
      async listInstalledApps() {
        return { apps: [] };
      },
      async openUsageAccessSettings() {
        return;
      },
    }),
  },
);

export const ForegroundApp = registerPlugin<ForegroundAppPlugin>(
  "ForegroundApp",
  {
    web: () => ({
      async getForegroundPackage() {
        return { packageName: "browser", timestamp: Date.now() };
      },
      async hasUsagePermission() {
        return { granted: false };
      },
    }),
  },
);

export function isNativePlatform(): boolean {
  return typeof (window as any).Capacitor?.isNativePlatform === "function"
    ? (window as any).Capacitor.isNativePlatform()
    : false;
}

export function getPlatform(): string {
  return (window as any).Capacitor?.getPlatform?.() ?? "web";
}