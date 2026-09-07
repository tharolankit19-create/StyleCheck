import { Link } from "react-router-dom";
import { useStore } from "@/state/store";
import { formatDuration } from "@/wallet/wallet";
import { useNow, useWalletTicker } from "@/lib/hooks";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DashboardScreen() {
  useWalletTicker();
  const now = useNow(1000);
  const settings = useStore((s) => s.settings);
  const wallet = useStore((s) => s.wallet);
  const sessions = useStore((s) => s.sessions);

  const today = todayKey();
  const todayEarnedSeconds = wallet.ledger
    .filter((e) => e.type === "earn" && new Date(e.timestamp).toISOString().slice(0, 10) === today)
    .reduce((sum, e) => sum + e.seconds, 0);
  const todaySpentSeconds = wallet.ledger
    .filter((e) => e.type === "spend" && new Date(e.timestamp).toISOString().slice(0, 10) === today)
    .reduce((sum, e) => sum + e.seconds, 0);
  const todayReps = sessions
    .filter((s) => new Date(s.startedAt).toISOString().slice(0, 10) === today)
    .reduce((sum, s) => sum + s.verifiedReps, 0);

  const elapsed = Math.max(0, Math.floor((now - wallet.lastTickAt) / 1000));
  const liveAvailable = Math.max(0, wallet.availableSeconds - elapsed);

  const blockedApps = settings.apps.filter((a) => a.blocked).length;

  return (
    <div className="page">
      <div className="card balance-card">
        <div className="balance-label">Screen time balance</div>
        <div className="balance-amount">
          {formatDuration(liveAvailable)}
        </div>
        <div className="balance-sub">
          {blockedApps} app{blockedApps === 1 ? "" : "s"} locked ·{" "}
          {wallet.earnedSeconds > 0
            ? `${Math.round(
                (wallet.spentSeconds / wallet.earnedSeconds) * 100,
              )}% used`
            : "0% used"}
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <Link className="btn btn-primary" to="/earn">
            EARN SCREEN TIME
          </Link>
          <Link className="btn btn-ghost" to="/use">
            Use time
          </Link>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="label">Earned today</div>
          <div className="value">{formatDuration(todayEarnedSeconds)}</div>
        </div>
        <div className="stat">
          <div className="label">Used today</div>
          <div className="value">{formatDuration(todaySpentSeconds)}</div>
        </div>
        <div className="stat">
          <div className="label">Reps today</div>
          <div className="value">{todayReps}</div>
        </div>
        <div className="stat">
          <div className="label">Streak</div>
          <div className="value">
            {settings.streakCount} {settings.streakCount === 1 ? "day" : "days"}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Active apps</h2>
        <p className="sub">Tap a card to enable/disable.</p>
        <div className="list" style={{ marginTop: 10 }}>
          {settings.apps.slice(0, 5).map((a) => (
            <div key={a.id} className="row">
              <div>
                <div className="title">{a.displayName}</div>
                <div className="sub">
                  {a.blocked ? "Locked" : "Free"} ·{" "}
                  {a.packageName ?? "package unknown"}
                </div>
              </div>
              <span className={`tag ${a.blocked ? "danger" : "success"}`}>
                {a.blocked ? "🔒 locked" : "free"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}