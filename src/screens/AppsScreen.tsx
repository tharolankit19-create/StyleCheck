import { useState } from "react";
import { useStore } from "@/state/store";
import type { DistractingApp } from "@/lib/types";

export function AppsScreen() {
  const apps = useStore((s) => s.settings.apps);
  const setApps = useStore((s) => s.setApps);
  const [draft, setDraft] = useState({ displayName: "", packageName: "" });

  function toggle(id: string) {
    setApps(apps.map((a) => (a.id === id ? { ...a, blocked: !a.blocked } : a)));
  }

  function remove(id: string) {
    setApps(apps.filter((a) => a.id !== id));
  }

  function add() {
    if (!draft.displayName) return;
    const id = `app-${Date.now().toString(36)}`;
    const next: DistractingApp = {
      id,
      displayName: draft.displayName,
      packageName: draft.packageName || undefined,
      blocked: true,
    };
    setApps([...apps, next]);
    setDraft({ displayName: "", packageName: "" });
  }

  return (
    <div className="page">
      <div className="card">
        <h2>Apps</h2>
        <p className="sub">
          Toggle which apps count as "distracting". On Android we use
          foreground detection so we can show a block screen when your wallet
          balance is empty.
        </p>
      </div>

      <div className="list">
        {apps.map((a) => (
          <div key={a.id} className="row">
            <div>
              <div className="title">{a.displayName}</div>
              <div className="sub">
                {a.packageName ?? "no package yet"} ·{" "}
                {a.blocked ? "locked" : "free"}
              </div>
            </div>
            <div className="actions">
              <div
                className={`toggle ${a.blocked ? "on" : ""}`}
                onClick={() => toggle(a.id)}
                role="switch"
                aria-checked={a.blocked}
              />
              <button className="btn btn-ghost" onClick={() => remove(a.id)}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Add an app</h2>
        <label className="label">Display name</label>
        <input
          className="input"
          value={draft.displayName}
          onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
          placeholder="e.g. BeReal"
        />
        <label className="label">Android package (optional)</label>
        <input
          className="input"
          value={draft.packageName}
          onChange={(e) => setDraft((d) => ({ ...d, packageName: e.target.value }))}
          placeholder="com.example.app"
        />
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={add}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}