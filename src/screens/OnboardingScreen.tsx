import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/state/store";
import type { DistractingApp, EarningRule } from "@/lib/types";
import { EXERCISES } from "@/exercises/registry";

interface Permissions {
  camera: boolean;
  notifications: boolean;
}

export function OnboardingScreen() {
  const settings = useStore((s) => s.settings);
  const setApps = useStore((s) => s.setApps);
  const setRules = useStore((s) => s.setRules);
  const upsertRule = useStore((s) => s.upsertRule);
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const nav = useNavigate();

  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [apps, setLocalApps] = useState<DistractingApp[]>(settings.apps);
  const [rules, setLocalRules] = useState<EarningRule[]>(settings.rules);
  const [perms, setPerms] = useState<Permissions>({
    camera: false,
    notifications: false,
  });
  const [customReps, setCustomReps] = useState(15);
  const [customMinutes, setCustomMinutes] = useState(15);
  const [customExercise, setCustomExercise] =
    useState<EarningRule["exercise"]>("pushup");

  async function next() {
    if (step === 1) {
      await setApps(apps);
    }
    if (step === 2) {
      await setRules(rules);
    }
    if (step === 3) {
      await requestPermissions();
    }
    if (step === 4) {
      await completeOnboarding();
      nav("/dashboard");
      return;
    }
    setStep((step + 1) as 0 | 1 | 2 | 3 | 4);
  }

  async function requestPermissions() {
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        stream.getTracks().forEach((t) => t.stop());
        setPerms((p) => ({ ...p, camera: true }));
      }
    } catch (e) {
      console.warn("camera denied or unavailable", e);
    }
    if ("Notification" in window) {
      try {
        const r = await Notification.requestPermission();
        setPerms((p) => ({ ...p, notifications: r === "granted" }));
      } catch {
        setPerms((p) => ({ ...p, notifications: false }));
      }
    }
  }

  function toggleApp(id: string) {
    setLocalApps((a) =>
      a.map((x) => (x.id === id ? { ...x, blocked: !x.blocked } : x)),
    );
  }

  function toggleRule(id: string) {
    setLocalRules((rs) =>
      rs.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    );
  }

  async function addCustomRule() {
    const id = `rule-custom-${Date.now()}`;
    const rule: EarningRule = {
      id,
      exercise: customExercise,
      reps: customReps,
      minutes: customMinutes,
      label: `${customReps} ${customExercise}s = ${customMinutes} min`,
      enabled: true,
      createdAt: Date.now(),
    };
    await upsertRule(rule);
    setLocalRules((rs) => [...rs.filter((r) => r.id !== id), rule]);
  }

  return (
    <div className="page">
      {step === 0 && (
        <div className="hero">
          <div style={{ fontSize: "2.4rem", marginBottom: 8 }}>⏱️</div>
          <h1>Your screen time is no longer free.</h1>
          <p>Earn it.</p>
          <p style={{ marginTop: 14 }}>
            Pick the apps you want controlled. Pick an exchange rate. Sweat.
            Get the minutes you actually want.
          </p>
        </div>
      )}

      {step === 1 && (
        <>
          <div className="card">
            <h2>1. Choose apps to control</h2>
            <p className="sub">
              We can never block apps on your behalf unless your OS supports
              it. On Android we surface usage access and use the lock-screen
              intervention. The list is yours to configure.
            </p>
          </div>
          <div className="list">
            {apps.map((a) => (
              <div key={a.id} className="row">
                <div>
                  <div className="title">{a.displayName}</div>
                  <div className="sub">{a.blocked ? "Locked" : "Free"}</div>
                </div>
                <div
                  className={`toggle ${a.blocked ? "on" : ""}`}
                  onClick={() => toggleApp(a.id)}
                  role="switch"
                  aria-checked={a.blocked}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="card">
            <h2>2. Pick an earning rate</h2>
            <p className="sub">
              Toggle the rules you want. Add a custom one if you don't see your
              rate.
            </p>
          </div>
          <div className="list">
            {rules.map((r) => (
              <div key={r.id} className="row">
                <div>
                  <div className="title">{r.label}</div>
                  <div className="sub">
                    {EXERCISES[r.exercise]?.displayName}
                  </div>
                </div>
                <div
                  className={`toggle ${r.enabled ? "on" : ""}`}
                  onClick={() => toggleRule(r.id)}
                  role="switch"
                  aria-checked={r.enabled}
                />
              </div>
            ))}
          </div>

          <div className="card">
            <h2>Add a custom rule</h2>
            <label className="label">Exercise</label>
            <select
              className="select"
              value={customExercise}
              onChange={(e) =>
                setCustomExercise(e.target.value as EarningRule["exercise"])
              }
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
              value={customReps}
              onChange={(e) => setCustomReps(parseInt(e.target.value || "1"))}
            />
            <label className="label">Minutes earned</label>
            <input
              className="input"
              type="number"
              min={1}
              value={customMinutes}
              onChange={(e) =>
                setCustomMinutes(parseInt(e.target.value || "1"))
              }
            />
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={addCustomRule}>
                Add rule
              </button>
            </div>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="card">
            <h2>3. Permissions</h2>
            <p className="sub">
              We will only ask for permissions when they're necessary and we'll
              always tell you why.
            </p>
          </div>
          <div className="step">
            <span className="num">📷</span>
            <div className="body">
              <h3>Camera</h3>
              <p>
                <strong>Why:</strong> on-device pose detection to count reps.
                Frames are processed locally; nothing is uploaded.
              </p>
              <p>
                Status:{" "}
                <span className={`tag ${perms.camera ? "success" : "warn"}`}>
                  {perms.camera ? "granted" : "needs permission"}
                </span>
              </p>
            </div>
          </div>
          <div className="step">
            <span className="num">🔔</span>
            <div className="body">
              <h3>Notifications</h3>
              <p>
                <strong>Why:</strong> remind you to keep your streak when your
                balance is running out.
              </p>
              <p>
                Status:{" "}
                <span
                  className={`tag ${perms.notifications ? "success" : "warn"}`}
                >
                  {perms.notifications ? "granted" : "skipped"}
                </span>
              </p>
            </div>
          </div>
        </>
      )}

      {step === 4 && (
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.4rem" }}>🏁</div>
          <h2>You're set.</h2>
          <p className="sub">
            Tap "Earn screen time" to start your first workout. Every verified
            rep pays into your wallet.
          </p>
        </div>
      )}

      <div className="btn-row">
        <button className="btn btn-primary" onClick={next}>
          {step === 0 && "Get started"}
          {step === 1 && "Next"}
          {step === 2 && "Next"}
          {step === 3 && "Continue"}
          {step === 4 && "Open dashboard"}
        </button>
      </div>
    </div>
  );
}