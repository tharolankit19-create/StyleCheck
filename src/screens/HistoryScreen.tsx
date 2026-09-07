import { useStore } from "@/state/store";
import { formatDuration } from "@/wallet/wallet";
import { EXERCISES } from "@/exercises/registry";

export function HistoryScreen() {
  const sessions = useStore((s) => s.sessions);
  const wallet = useStore((s) => s.wallet);
  const settings = useStore((s) => s.settings);

  const totalReps = sessions.reduce((sum, s) => sum + s.verifiedReps, 0);
  const totalEarned = wallet.earnedSeconds;

  return (
    <div className="page">
      <div className="card">
        <h2>Today's activity</h2>
        <div className="stat-grid" style={{ marginTop: 10 }}>
          <div className="stat">
            <div className="label">Total earned</div>
            <div className="value">{formatDuration(totalEarned)}</div>
          </div>
          <div className="stat">
            <div className="label">Total reps</div>
            <div className="value">{totalReps}</div>
          </div>
          <div className="stat">
            <div className="label">Sessions</div>
            <div className="value">{sessions.length}</div>
          </div>
          <div className="stat">
            <div className="label">Streak</div>
            <div className="value">{settings.streakCount} days</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Recent workouts</h2>
        {sessions.length === 0 ? (
          <div className="empty">
            No workouts yet. Tap <span className="kbd">Earn</span> to begin.
          </div>
        ) : (
          <div className="list" style={{ marginTop: 10 }}>
            {sessions.slice(0, 25).map((s) => (
              <div key={s.id} className="session-row">
                <div>
                  <div className="rep">{s.verifiedReps} reps</div>
                  <div className="meta">
                    {EXERCISES[s.exercise]?.displayName ?? s.exercise} ·{" "}
                    {new Date(s.startedAt).toLocaleString()}
                  </div>
                </div>
                <div className="meta">
                  +{formatDuration(s.earnedSeconds)}
                  {s.rejectedReps > 0 && (
                    <>
                      <br />
                      <span className="tag warn">
                        {s.rejectedReps} rejected
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}