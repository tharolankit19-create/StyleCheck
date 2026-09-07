import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "@/state/store";
import { EXERCISES } from "@/exercises/registry";
import type { ExerciseType } from "@/lib/types";
import {
  createPoseDetector,
  isMediaPipeAvailable,
  type PoseDetector,
} from "@/pose/detector";
import {
  createRepEngine,
  detectPushup,
  detectSquat,
  processFrame,
  type ExerciseDetection,
  type RepEngineState,
} from "@/pose/repEngine";
import { applyRule, formatDuration } from "@/wallet/wallet";
import type { PushupThresholds, WorkoutSession } from "@/lib/types";

interface DebugInfo {
  angle: number;
  confidence: number;
  state: string;
  alignment: number;
  message?: string;
}

export function ExerciseScreen() {
  const { exercise: exerciseParam } = useParams<{ exercise: string }>();
  const exercise = (exerciseParam as ExerciseType) || "pushup";
  const ex = EXERCISES[exercise];
  const settings = useStore((s) => s.settings);
  const finishWorkout = useStore((s) => s.finishWorkout);
  const nav = useNavigate();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<PoseDetector | null>(null);
  const engineRef = useRef<RepEngineState>(createRepEngine());
  const startedAtRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const pausedRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediapipeReady, setMediapipeReady] = useState<boolean | null>(null);
  const [repsLive, setRepsLive] = useState(0);
  const [rejectedLive, setRejectedLive] = useState(0);
  const [earnedLive, setEarnedLive] = useState(0);
  const [ruleLabelLive, setRuleLabelLive] = useState<string | null>(null);
  const [finalSummary, setFinalSummary] = useState<{
    reps: number;
    rejected: number;
    earnedSeconds: number;
    ruleLabel: string | null;
  } | null>(null);

  const thresholds: PushupThresholds = settings.thresholds;

  useEffect(() => {
    let cancelled = false;
    isMediaPipeAvailable()
      .then((ok) => {
        if (!cancelled) setMediapipeReady(ok);
      })
      .catch(() => {
        if (!cancelled) setMediapipeReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const matcher = useMemo(
    () => applyRule.bind(null, settings.rules, exercise),
    [settings.rules, exercise],
  );

  function drawSkeleton(
    landmarks: { x: number; y: number; visibility?: number }[],
    w: number,
    h: number,
  ) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,77,109,0.65)";
    ctx.lineWidth = 3;
    const pairs: [number, number][] = [
      [11, 12], [11, 13], [13, 15],
      [12, 14], [14, 16],
      [11, 23], [12, 24],
      [23, 24], [23, 25], [25, 27],
      [24, 26], [26, 28],
    ];
    for (const [a, b] of pairs) {
      const pa = landmarks[a];
      const pb = landmarks[b];
      if (!pa || !pb) continue;
      const va = pa.visibility ?? 0;
      const vb = pb.visibility ?? 0;
      if (va < 0.4 || vb < 0.4) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x * w, pa.y * h);
      ctx.lineTo(pb.x * w, pb.y * h);
      ctx.stroke();
    }
    for (let i = 0; i < landmarks.length; i++) {
      const p = landmarks[i];
      if (!p || (p.visibility ?? 0) < 0.4) continue;
      ctx.beginPath();
      ctx.fillStyle = "rgba(255,184,77,0.95)";
      ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  async function start() {
    setError(null);
    setFinalSummary(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await new Promise<void>((res) => {
        v.onloadedmetadata = () => res();
      });
      await v.play();
      startedAtRef.current = Date.now();
      engineRef.current = createRepEngine();
      setRepsLive(0);
      setRejectedLive(0);
      setEarnedLive(0);
      setRuleLabelLive(null);
      const detector = await createPoseDetector();
      detectorRef.current = detector;
      setRunning(true);
      setPaused(false);
      pausedRef.current = false;
      await detector.start(v, (frame) => {
        if (pausedRef.current) return;
        const engine = engineRef.current;
        const detection: ExerciseDetection | null =
          exercise === "pushup" ? detectPushup(frame) : detectSquat(frame);
        if (!detection) return;
        const w = frame.imageWidth > 1 ? frame.imageWidth : v.videoWidth || 540;
        const h = frame.imageHeight > 1 ? frame.imageHeight : v.videoHeight || 720;
        if (frame.landmarks.length > 0) drawSkeleton(frame.landmarks, w, h);
        const next = processFrame(
          engine,
          {
            landmarks: frame.landmarks,
            timestamp: performance.now(),
            imageWidth: w,
            imageHeight: h,
          },
          { thresholds },
          detection,
        );
        engineRef.current = next;
        const ev = next.lastEvent;
        let message: string | undefined;
        if (ev?.type === "rep-rejected") message = `rejected: ${ev.reason}`;
        if (ev?.type === "rep-counted") message = "rep ✓";
        const liveMatch = matcher(next.reps);
        setRepsLive(next.reps);
        setRejectedLive(next.rejectedReps);
        setEarnedLive(liveMatch.earnedSeconds);
        setRuleLabelLive(liveMatch.matchedRule?.label ?? null);
        setDebug({
          angle: detection.primaryAngle,
          confidence: detection.confidence,
          state: next.state,
          alignment: detection.shoulderHipAlignment,
          message,
        });
      });
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : "Unable to start camera. Make sure you granted camera permission.",
      );
    }
  }

  function pause() {
    setPaused((p) => {
      const next = !p;
      pausedRef.current = next;
      return next;
    });
  }

  async function stop() {
    setRunning(false);
    pausedRef.current = false;
    detectorRef.current?.stop();
    detectorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
    const engine = engineRef.current;
    const match = matcher(engine.reps);
    const summary = {
      reps: engine.reps,
      rejected: engine.rejectedReps,
      earnedSeconds: match.earnedSeconds,
      ruleLabel: match.matchedRule?.label ?? null,
    };
    setFinalSummary(summary);
    const session: WorkoutSession = {
      id: `ws-${Date.now().toString(36)}`,
      exercise,
      startedAt: startedAtRef.current || Date.now(),
      endedAt: Date.now(),
      verifiedReps: engine.reps,
      rejectedReps: engine.rejectedReps,
      earnedSeconds: match.earnedSeconds,
      configSnapshot: thresholds,
    };
    if (engine.reps > 0) {
      await finishWorkout(session);
    }
  }

  useEffect(() => {
    return () => {
      detectorRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="page">
      <div className="card">
        <h2>
          {ex.emoji} {ex.displayName}
        </h2>
        <p className="sub">{ex.description}</p>
      </div>

      {!running && !finalSummary && (
        <div className="card">
          {mediapipeReady === false && (
            <p className="tag warn" style={{ display: "inline-block" }}>
              Pose model failed to load — check your internet connection.
            </p>
          )}
          <p className="sub" style={{ marginTop: 8 }}>
            Place the phone so your full body is in frame, sideways to the
            camera. We'll watch for {ex.displayName.toLowerCase()}s.
          </p>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={start}>
              Start camera
            </button>
            <button className="btn btn-ghost" onClick={() => nav(-1)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {running && (
        <div className="exercise-screen">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
          />
          <canvas ref={canvasRef} />
          <div className="exercise-overlay">
            <div className="row" style={{ background: "rgba(0,0,0,0.4)" }}>
              <span className="pill">
                {debug?.state ?? "READY"} · {Math.round(debug?.angle ?? 0)}°
              </span>
              <span className="pill">
                conf {Math.round((debug?.confidence ?? 0) * 100)}%
              </span>
            </div>
            <div className="rep-counter">
              <div>
                <div className="big">{repsLive}</div>
                <p className="label">{ex.displayName}</p>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div className="big" style={{ fontSize: "2rem", color: "#ffb84d" }}>
                  {formatDuration(earnedLive)}
                </div>
                <p className="label">Earned</p>
              </div>
            </div>
            <div className="controls">
              <button className="btn btn-secondary" onClick={pause}>
                {paused ? "Resume" : "Pause"}
              </button>
              <button className="btn btn-danger" onClick={stop}>
                Finish
              </button>
            </div>
          </div>
        </div>
      )}

      {running && ruleLabelLive && (
        <div className="card">
          <p className="sub">Active rule: {ruleLabelLive}</p>
          <p className="sub">Rejected: {rejectedLive}</p>
        </div>
      )}

      {debug?.message && (
        <div className="card">
          <p className="sub">Last event: {debug.message}</p>
        </div>
      )}

      {error && (
        <div className="card">
          <p className="tag danger" style={{ display: "inline-block" }}>
            {error}
          </p>
        </div>
      )}

      {finalSummary && (
        <div className="card">
          <h2>Workout complete</h2>
          <div className="stat-grid" style={{ marginTop: 10 }}>
            <div className="stat">
              <div className="label">Verified reps</div>
              <div className="value">{finalSummary.reps}</div>
            </div>
            <div className="stat">
              <div className="label">Rejected</div>
              <div className="value">{finalSummary.rejected}</div>
            </div>
            <div className="stat">
              <div className="label">Earned</div>
              <div className="value">{formatDuration(finalSummary.earnedSeconds)}</div>
            </div>
            <div className="stat">
              <div className="label">Rule</div>
              <div className="value" style={{ fontSize: "0.9rem" }}>
                {finalSummary.ruleLabel ?? "no rule matched"}
              </div>
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => nav("/dashboard")}>
              Back to dashboard
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setFinalSummary(null);
                start();
              }}
            >
              Another set
            </button>
          </div>
        </div>
      )}
    </div>
  );
}