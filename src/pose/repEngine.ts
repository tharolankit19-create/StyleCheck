export interface Point {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
}

export interface PoseFrame {
  landmarks: Point[];
  timestamp: number;
  imageWidth: number;
  imageHeight: number;
}

export type ExerciseEvent =
  | { type: "rep-counted"; reps: number; repDurationMs: number; confidence: number }
  | { type: "rep-rejected"; reason: RejectReason }
  | { type: "state"; state: ExerciseState };

export type ExerciseState = "READY" | "DOWN" | "UP";

export type RejectReason =
  | "low-confidence"
  | "body-not-visible"
  | "too-fast"
  | "too-slow"
  | "misalignment"
  | "incomplete"
  | "cooldown";

export interface ExerciseConfig {
  thresholds: import("@/lib/types").PushupThresholds;
}

export function angleAt(p1: Point, p2: Point, p3: Point): number {
  const v1x = p1.x - p2.x;
  const v1y = p1.y - p2.y;
  const v2x = p3.x - p2.x;
  const v2y = p3.y - p2.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 === 0 || m2 === 0) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function lineAngle(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.atan2(dy, dx);
}

export interface RepEngineState {
  state: ExerciseState;
  reps: number;
  rejectedReps: number;
  stateEnteredAt: number;
  repStartedAt: number;
  lastRepAt: number;
  visibleFrames: number;
  lastEvent: ExerciseEvent | null;
}

export function createRepEngine(): RepEngineState {
  return {
    state: "READY",
    reps: 0,
    rejectedReps: 0,
    stateEnteredAt: 0,
    repStartedAt: 0,
    lastRepAt: 0,
    visibleFrames: 0,
    lastEvent: null,
  };
}

function pushEvent(state: RepEngineState, ev: ExerciseEvent) {
  state.lastEvent = ev;
}

export function processFrame(
  state: RepEngineState,
  frame: PoseFrame,
  cfg: ExerciseConfig,
  detection: ExerciseDetection,
): RepEngineState {
  const now = frame.timestamp;
  const t = cfg.thresholds;

  if (detection.visibleFrames >= t.bodyVisibilityFramesRequired) {
    state.visibleFrames = Math.min(state.visibleFrames + 1, 100);
  } else {
    state.visibleFrames = Math.max(0, state.visibleFrames - 1);
  }

  const aligned =
    detection.shoulderHipAlignment >= t.minShoulderHipAlignment &&
    detection.shoulderHipAlignment <= t.maxShoulderHipAlignment;
  const conf = detection.confidence;

  if (state.visibleFrames < t.bodyVisibilityFramesRequired || conf < t.minConfidence || !aligned) {
    if (state.state !== "READY") {
      pushEvent(state, { type: "rep-rejected", reason: "body-not-visible" });
      state.state = "READY";
      state.stateEnteredAt = now;
      state.repStartedAt = 0;
    }
    pushEvent(state, { type: "state", state: state.state });
    return state;
  }

  const isDown = detection.primaryAngle <= t.downAngleDeg;
  const isUp = detection.primaryAngle >= t.upAngleDeg;

  if (state.state === "READY") {
    if (isDown) {
      state.state = "DOWN";
      state.stateEnteredAt = now;
      state.repStartedAt = now;
      pushEvent(state, { type: "state", state: state.state });
    } else if (isUp) {
      state.state = "UP";
      state.stateEnteredAt = now;
      state.repStartedAt = now;
      pushEvent(state, { type: "state", state: state.state });
    }
    return state;
  }

  if (state.state === "UP") {
    if (isDown) {
      state.state = "DOWN";
      state.stateEnteredAt = now;
      pushEvent(state, { type: "state", state: state.state });
    } else if (now - state.stateEnteredAt > t.maxRepMs && !isUp) {
      pushEvent(state, { type: "rep-rejected", reason: "incomplete" });
      state.state = "READY";
      state.stateEnteredAt = now;
      state.repStartedAt = 0;
      pushEvent(state, { type: "state", state: state.state });
    }
    return state;
  }

  if (state.state === "DOWN") {
    if (isUp) {
      const duration = now - state.repStartedAt;
      if (now - state.lastRepAt < t.cooldownMs) {
        pushEvent(state, { type: "rep-rejected", reason: "cooldown" });
      } else if (duration < t.minRepMs) {
        pushEvent(state, { type: "rep-rejected", reason: "too-fast" });
        state.rejectedReps += 1;
      } else if (duration > t.maxRepMs) {
        pushEvent(state, { type: "rep-rejected", reason: "too-slow" });
        state.rejectedReps += 1;
      } else {
        state.reps += 1;
        state.lastRepAt = now;
        pushEvent(state, {
          type: "rep-counted",
          reps: state.reps,
          repDurationMs: duration,
          confidence: conf,
        });
      }
      state.state = "UP";
      state.stateEnteredAt = now;
      pushEvent(state, { type: "state", state: state.state });
    }
    return state;
  }

  return state;
}

export interface ExerciseDetection {
  primaryAngle: number;
  secondaryAngle: number;
  shoulderHipAlignment: number;
  confidence: number;
  visibleFrames: number;
}

export function detectPushup(frame: PoseFrame): ExerciseDetection | null {
  const lm = frame.landmarks;
  const req = [11, 12, 13, 14, 15, 16, 23, 24];
  const confs = req.map((i) => visibilityOf(lm[i]));
  const minConf = Math.min(...confs);
  if (lm.length < 25) return null;
  const leftShoulder = lm[11];
  const rightShoulder = lm[12];
  const leftElbow = lm[13];
  const rightElbow = lm[14];
  const leftWrist = lm[15];
  const rightWrist = lm[16];
  const leftHip = lm[23];
  const rightHip = lm[24];

  const leftElbowAngle = angleAt(leftShoulder, leftElbow, leftWrist);
  const rightElbowAngle = angleAt(rightShoulder, rightElbow, rightWrist);

  const primaryAngle = (leftElbowAngle + rightElbowAngle) / 2;

  const shoulderMid = mid(leftShoulder, rightShoulder);
  const hipMid = mid(leftHip, rightHip);
  const bodyAngle = Math.abs(lineAngle(shoulderMid, hipMid)) * (180 / Math.PI);
  const shoulderHipAlignment =
    Math.hypot(shoulderMid.x - hipMid.x, shoulderMid.y - hipMid.y) /
    Math.max(
      0.0001,
      Math.hypot(rightShoulder.x - leftShoulder.x, rightShoulder.y - leftShoulder.y),
    );

  const visibleFrames = confs.filter((c) => c >= 0.4).length;

  return {
    primaryAngle,
    secondaryAngle: bodyAngle,
    shoulderHipAlignment,
    confidence: minConf,
    visibleFrames,
  };
}

export function detectSquat(frame: PoseFrame): ExerciseDetection | null {
  const lm = frame.landmarks;
  if (lm.length < 25) return null;
  const leftHip = lm[23];
  const rightHip = lm[24];
  const leftKnee = lm[25];
  const rightKnee = lm[26];
  const leftAnkle = lm[27];
  const rightAnkle = lm[28];
  const leftShoulder = lm[11];
  const rightShoulder = lm[12];
  const confs = [
    visibilityOf(leftHip),
    visibilityOf(rightHip),
    visibilityOf(leftKnee),
    visibilityOf(rightKnee),
    visibilityOf(leftAnkle),
    visibilityOf(rightAnkle),
    visibilityOf(leftShoulder),
    visibilityOf(rightShoulder),
  ];
  const minConf = Math.min(...confs);

  const leftKneeAngle = angleAt(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = angleAt(rightHip, rightKnee, rightAnkle);
  const primaryAngle = (leftKneeAngle + rightKneeAngle) / 2;

  const shoulderMid = mid(leftShoulder, rightShoulder);
  const hipMid = mid(leftHip, rightHip);
  const shoulderHipAlignment =
    Math.hypot(shoulderMid.x - hipMid.x, shoulderMid.y - hipMid.y) /
    Math.max(
      0.0001,
      Math.hypot(rightShoulder.x - leftShoulder.x, rightShoulder.y - leftShoulder.y),
    );

  return {
    primaryAngle,
    secondaryAngle: 0,
    shoulderHipAlignment,
    confidence: minConf,
    visibleFrames: confs.filter((c) => c >= 0.4).length,
  };
}

function visibilityOf(p: Point | undefined): number {
  if (!p) return 0;
  return (p.visibility ?? p.presence ?? 0);
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}