import { useState } from "react";
import { useStore } from "@/state/store";
import { formatDuration } from "@/wallet/wallet";
import { useNow, useWalletTicker } from "@/lib/hooks";
import { ForegroundApp, isNativePlatform } from "@/native/plugins";

export function SpendScreen() {
  useWalletTicker();
  const now = useNow(1000);
  const wallet = useStore((s) => s.wallet);
  const apps = useStore((s) => s.settings.apps);
  const spend = useStore((s) => s.spend);
  const [picked, setPicked] = useState<string | null>(null);
  const [amount, setAmount] = useState(10);

  const elapsed = Math.max(0, Math.floor((now - wallet.lastTickAt) / 1000));
  const liveAvailable = Math.max(0, wallet.availableSeconds - elapsed);
  const native = isNativePlatform();

  async function startSpend() {
    const ok = await spend(amount * 60, picked ?? "manual");
    if (!ok) {
      alert("Not enough time in your wallet.");
      return;
    }
    if (native) {
      try {
        const fg = await ForegroundApp.getForegroundPackage();
        if (fg.packageName === "browser" || fg.packageName === "unknown") return;
      } catch {
        return;
      }
    }
  }

  return (
    <div className="page">
      <div className="card balance-card">
        <div className="balance-label">Available</div>
        <div className="balance-amount">{formatDuration(liveAvailable)}</div>
        <div className="balance-sub">Earn more from the dashboard.</div>
      </div>

      <div className="card">
        <h2>Use time</h2>
        <p className="sub">
          Pick the app you want to unlock and how long you want.
        </p>
        <div className="list" style={{ marginTop: 10 }}>
          {apps
            .filter((a) => a.blocked)
            .map((a) => (
              <div
                key={a.id}
                className="row"
                onClick={() => setPicked(a.id)}
                style={{
                  borderColor:
                    picked === a.id ? "var(--accent)" : undefined,
                }}
              >
                <div>
                  <div className="title">{a.displayName}</div>
                  <div className="sub">{a.packageName ?? "package unknown"}</div>
                </div>
                <span className="tag">🔒</span>
              </div>
            ))}
        </div>
        <label className="label">Minutes</label>
        <input
          className="input"
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(parseInt(e.target.value || "1"))}
        />
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={startSpend} disabled={!picked}>
            Unlock for {amount} min
          </button>
        </div>
        <p className="sub" style={{ marginTop: 8 }}>
          When the timer ends, your wallet is debited and the app is locked
          again.
        </p>
      </div>
    </div>
  );
}