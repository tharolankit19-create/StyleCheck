import { Link } from "react-router-dom";
import { useStore } from "@/state/store";
import {
  ScreenTimeGuard,
  ForegroundApp,
  isNativePlatform,
  getPlatform,
} from "@/native/plugins";
import { useEffect, useState } from "react";

export function SettingsScreen() {
  const settings = useStore((s) => s.settings);
  const platform = getPlatform();
  const native = isNativePlatform();
  const [usageGranted, setUsageGranted] = useState<boolean | null>(null);
  const [fg, setFg] = useState<{ packageName: string; timestamp: number } | null>(null);

  useEffect(() => {
    if (!native) return;
    ForegroundApp.hasUsagePermission()
      .then((r) => setUsageGranted(r.granted))
      .catch(() => setUsageGranted(false));
    const id = setInterval(() => {
      ForegroundApp.getForegroundPackage()
        .then(setFg)
        .catch(() => undefined);
    }, 4000);
    return () => clearInterval(id);
  }, [native]);

  return (
    <div className="page">
      <div className="card">
        <h2>Settings</h2>
        <p className="sub">Platform: {platform}{native ? " · native build" : " · web build"}</p>
      </div>
      <Link className="row" to="/settings/apps">
        <div>
          <div className="title">Apps</div>
          <div className="sub">{settings.apps.filter((a) => a.blocked).length} locked</div>
        </div>
        <div className="actions">›</div>
      </Link>
      <Link className="row" to="/settings/rules">
        <div>
          <div className="title">Earning rules</div>
          <div className="sub">{settings.rules.filter((r) => r.enabled).length} active</div>
        </div>
        <div className="actions">›</div>
      </Link>

      {native && (
        <div className="card">
          <h2>Android enforcement</h2>
          <p className="sub">
            Real blocking requires the system "Usage data" permission. Tap to
            grant it; the OS will walk you through it.
          </p>
          <div className="row" style={{ marginTop: 8 }}>
            <div>
              <div className="title">Usage access</div>
              <div className="sub">
                {usageGranted === null
                  ? "checking…"
                  : usageGranted
                  ? "granted"
                  : "not granted"}
              </div>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => ScreenTimeGuard.openUsageAccessSettings()}
            >
              Open settings
            </button>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <div>
              <div className="title">Foreground app</div>
              <div className="sub">
                {fg?.packageName ?? "detecting…"} ·{" "}
                {fg?.timestamp ? new Date(fg.timestamp).toLocaleTimeString() : ""}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2>About</h2>
        <p className="sub">
          All processing is local. The camera is never uploaded. Counts come
          from on-device pose detection with multi-frame state-machine logic.
        </p>
      </div>
    </div>
  );
}