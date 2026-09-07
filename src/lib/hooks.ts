import { useEffect, useState } from "react";
import { useStore } from "@/state/store";

export function useWalletTicker(intervalMs = 1000) {
  const tick = useStore((s) => s.tick);
  useEffect(() => {
    const id = setInterval(() => {
      tick();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, tick]);
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}