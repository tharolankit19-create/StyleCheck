import { useStore } from "@/state/store";
import { formatDuration } from "@/wallet/wallet";

export function AppHeader() {
  const wallet = useStore((s) => s.wallet);
  const settings = useStore((s) => s.settings);
  const totalApps = settings.apps.filter((a) => a.blocked).length;
  return (
    <header className="appbar">
      <h1>Earn Your Screen Time</h1>
      <span className="pill">
        {formatDuration(wallet.availableSeconds)} · 🔒 {totalApps}
      </span>
    </header>
  );
}