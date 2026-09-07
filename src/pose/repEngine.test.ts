import { describe, it, expect } from "vitest";
import {
  angleAt,
  createRepEngine,
  processFrame,
  detectPushup,
  type PoseFrame,
} from "@/pose/repEngine";

function pt(x: number, y: number, v = 0.9): any {
  return { x, y, z: 0, visibility: v };
}

function makeFrame(angleDeg: number, visibility = 0.9): PoseFrame {
  const shoulderL = pt(0.3, 0.3, visibility);
  const elbowL = pt(0.4, 0.3, visibility);
  const shoulderR = pt(0.6, 0.3, visibility);
  const elbowR = pt(0.7, 0.3, visibility);
  const armLen = 0.2;
  const dirL = atan2Safe(shoulderL.y - elbowL.y, shoulderL.x - elbowL.x) +
    (angleDeg * Math.PI) / 180;
  const dirR = atan2Safe(shoulderR.y - elbowR.y, shoulderR.x - elbowR.x) +
    (angleDeg * Math.PI) / 180;
  const wristL = pt(
    elbowL.x + Math.cos(dirL) * armLen,
    elbowL.y + Math.sin(dirL) * armLen,
    visibility,
  );
  const wristR = pt(
    elbowR.x + Math.cos(dirR) * armLen,
    elbowR.y + Math.sin(dirR) * armLen,
    visibility,
  );
  const lm: any[] = new Array(33).fill(null).map(() => pt(0.5, 0.5, 0));
  lm[11] = shoulderL;
  lm[12] = shoulderR;
  lm[13] = elbowL;
  lm[14] = elbowR;
  lm[15] = wristL;
  lm[16] = wristR;
  lm[23] = pt(0.3, 0.5, visibility);
  lm[24] = pt(0.6, 0.5, visibility);
  return {
    landmarks: lm,
    timestamp: 0,
    imageWidth: 540,
    imageHeight: 720,
  };
}

function atan2Safe(y: number, x: number): number {
  return Math.atan2(y, x);
}

describe("repEngine", () => {
  it("angleAt returns correct angles for a straight line", () => {
    const a = pt(0, 0);
    const b = pt(0.5, 0.5);
    const c = pt(1, 1);
    expect(Math.round(angleAt(a, b, c))).toBe(180);
  });

  it("angleAt returns 90 for a right angle", () => {
    const a = pt(0, 0);
    const b = pt(0.5, 0);
    const c = pt(0.5, 0.5);
    expect(Math.round(angleAt(a, b, c))).toBe(90);
  });

  it("counts a single valid push-up", () => {
    const engine = createRepEngine();
    const t = {
      upAngleDeg: 155,
      downAngleDeg: 95,
      minConfidence: 0.5,
      minRepMs: 700,
      maxRepMs: 5000,
      minShoulderHipAlignment: 0.5,
      maxShoulderHipAlignment: 1.4,
      bodyVisibilityFramesRequired: 1,
      cooldownMs: 0,
    };
    let ts = 0;
    const cfg = { thresholds: t };
    const dUp = detectPushup(makeFrame(170, 0.9))!;
    processFrame(engine, { ...makeFrame(170, 0.9), timestamp: ts }, cfg, dUp);
    ts += 1000;
    const dDown = detectPushup(makeFrame(80, 0.9))!;
    processFrame(engine, { ...makeFrame(80, 0.9), timestamp: ts }, cfg, dDown);
    ts += 1000;
    const dUp2 = detectPushup(makeFrame(170, 0.9))!;
    processFrame(engine, { ...makeFrame(170, 0.9), timestamp: ts }, cfg, dUp2);
    expect(engine.reps).toBe(1);
    expect(engine.rejectedReps).toBe(0);
  });

  it("rejects too-fast repetitions", () => {
    const engine = createRepEngine();
    const t = {
      upAngleDeg: 155,
      downAngleDeg: 95,
      minConfidence: 0.5,
      minRepMs: 700,
      maxRepMs: 5000,
      minShoulderHipAlignment: 0.5,
      maxShoulderHipAlignment: 1.4,
      bodyVisibilityFramesRequired: 1,
      cooldownMs: 0,
    };
    const cfg = { thresholds: t };
    let ts = 0;
    const dUp = detectPushup(makeFrame(170, 0.9))!;
    processFrame(engine, { ...makeFrame(170, 0.9), timestamp: ts }, cfg, dUp);
    ts += 100;
    const dDown = detectPushup(makeFrame(80, 0.9))!;
    processFrame(engine, { ...makeFrame(80, 0.9), timestamp: ts }, cfg, dDown);
    ts += 100;
    const dUp2 = detectPushup(makeFrame(170, 0.9))!;
    processFrame(engine, { ...makeFrame(170, 0.9), timestamp: ts }, cfg, dUp2);
    expect(engine.reps).toBe(0);
    expect(engine.rejectedReps).toBe(1);
  });

  it("rejects when confidence is low", () => {
    const engine = createRepEngine();
    const t = {
      upAngleDeg: 155,
      downAngleDeg: 95,
      minConfidence: 0.8,
      minRepMs: 700,
      maxRepMs: 5000,
      minShoulderHipAlignment: 0.5,
      maxShoulderHipAlignment: 1.4,
      bodyVisibilityFramesRequired: 1,
      cooldownMs: 0,
    };
    const cfg = { thresholds: t };
    let ts = 0;
    const dUp = detectPushup(makeFrame(170, 0.2))!;
    processFrame(engine, { ...makeFrame(170, 0.2), timestamp: ts }, cfg, dUp);
    ts += 1000;
    const dDown = detectPushup(makeFrame(80, 0.2))!;
    processFrame(engine, { ...makeFrame(80, 0.2), timestamp: ts }, cfg, dDown);
    ts += 1000;
    const dUp2 = detectPushup(makeFrame(170, 0.2))!;
    processFrame(engine, { ...makeFrame(170, 0.2), timestamp: ts }, cfg, dUp2);
    expect(engine.reps).toBe(0);
  });
});