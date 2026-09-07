import { useState } from "react";
import { useStore } from "@/state/store";
import type { EarningRule, ExerciseType } from "@/lib/types";
import { EXERCISES } from "@/exercises/registry";

export function RulesScreen() {
  const rules = useStore((s) => s.settings.rules);
  const upsertRule = useStore((s) => s.upsertRule);
  const deleteRule = useStore((s) => s.deleteRule);
  const toggleRule = useStore((s) => s.toggleRule);
  const [draft, setDraft] = useState<{ reps: number; minutes: number; exercise: ExerciseType }>({
    reps: 5,
    minutes: 5,
    exercise: "pushup",
  });

  function add() {
    const id = `rule-${Date.now().toString(36)}`;
    const rule: EarningRule = {
      id,
      exercise: draft.exercise,
      reps: draft.reps,
      minutes: draft.minutes,
      label: `${draft.reps} ${draft.exercise}s = ${draft.minutes} min`,
      enabled: true,
      createdAt: Date.now(),
    };
    upsertRule(rule);
  }

  return (
    <div className="page">
      <div className="card">
        <h2>Earning rules</h2>
        <p className="sub">
          Toggle rules on/off. The highest matching rule for each rep is used.
        </p>
      </div>

      <div className="list">
        {rules.map((r) => (
          <div key={r.id} className="row">
            <div>
              <div className="title">{r.label}</div>
              <div className="sub">{EXERCISES[r.exercise]?.displayName}</div>
            </div>
            <div className="actions">
              <div
                className={`toggle ${r.enabled ? "on" : ""}`}
                onClick={() => toggleRule(r.id)}
                role="switch"
                aria-checked={r.enabled}
              />
              <button className="btn btn-ghost" onClick={() => deleteRule(r.id)}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Add a rule</h2>
        <label className="label">Exercise</label>
        <select
          className="select"
          value={draft.exercise}
          onChange={(e) => setDraft((d) => ({ ...d, exercise: e.target.value as ExerciseType }))}
        >
          {Object.values(EXERCISES).map((ex) => (
            <option key={ex.type} value={ex.type}>
              {ex.displayName}
            </option>
          ))}
        </select>
        <label className="label">Reps</label>
        <input
          className="input"
          type="number"
          min={1}
          value={draft.reps}
          onChange={(e) => setDraft((d) => ({ ...d, reps: parseInt(e.target.value || "1") }))}
        />
        <label className="label">Minutes</label>
        <input
          className="input"
          type="number"
          min={1}
          value={draft.minutes}
          onChange={(e) => setDraft((d) => ({ ...d, minutes: parseInt(e.target.value || "1") }))}
        />
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={add}>
            Add rule
          </button>
        </div>
      </div>
    </div>
  );
}