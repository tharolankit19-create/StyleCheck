import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { bootstrap } from "@/state/store";
import { useStore } from "@/state/store";
import { OnboardingScreen } from "@/screens/OnboardingScreen";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { ExerciseSelectScreen } from "@/screens/ExerciseSelectScreen";
import { ExerciseScreen } from "@/screens/ExerciseScreen";
import { HistoryScreen } from "@/screens/HistoryScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { AppsScreen } from "@/screens/AppsScreen";
import { RulesScreen } from "@/screens/RulesScreen";
import { NavBar } from "@/components/NavBar";
import { AppHeader } from "@/components/AppHeader";
import { SpendScreen } from "@/screens/SpendScreen";

export default function App() {
  const [booted, setBooted] = useState(false);
  const ready = useStore((s) => s.ready);
  const onboarded = useStore((s) => s.settings.onboarded);

  useEffect(() => {
    bootstrap()
      .catch((e) => {
        console.error("bootstrap failed", e);
      })
      .finally(() => setBooted(true));
  }, []);

  if (!booted || !ready) {
    return (
      <div className="app">
        <div className="page">
          <div className="empty">Loading…</div>
        </div>
      </div>
    );
  }

  if (!onboarded) {
    return (
      <div className="app">
        <AppHeader />
        <Routes>
          <Route path="*" element={<OnboardingScreen />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="app">
      <AppHeader />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardScreen />} />
        <Route path="/earn" element={<ExerciseSelectScreen />} />
        <Route path="/earn/:exercise" element={<ExerciseScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/settings/apps" element={<AppsScreen />} />
        <Route path="/settings/rules" element={<RulesScreen />} />
        <Route path="/use" element={<SpendScreen />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <NavBar />
    </div>
  );
}