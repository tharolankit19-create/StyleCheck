import type { PoseFrame } from "./repEngine";

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface MediapipeResults {
  poseLandmarks?: PoseLandmark[];
  image?: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement;
}

let poseInstance: unknown | null = null;
let poseLoading: Promise<unknown> | null = null;

async function loadMediaPipePose(): Promise<unknown> {
  if (poseInstance) return poseInstance;
  if (poseLoading) return poseLoading;
  poseLoading = (async () => {
    const mod: any = await import("@mediapipe/pose");
    const PoseCtor = mod.Pose ?? mod.default?.Pose;
    if (!PoseCtor) throw new Error("MediaPipe Pose not loadable");
    const pose = new PoseCtor({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${mod.VERSION ?? "0.5.1675469404"}/${file}`,
    });
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    poseInstance = pose;
    return pose;
  })();
  return poseLoading;
}

export async function isMediaPipeAvailable(): Promise<boolean> {
  try {
    await loadMediaPipePose();
    return true;
  } catch {
    return false;
  }
}

export interface PoseDetector {
  start: (
    video: HTMLVideoElement,
    onFrame: (frame: PoseFrame) => void,
  ) => Promise<void>;
  stop: () => void;
}

export async function createPoseDetector(): Promise<PoseDetector> {
  const pose = (await loadMediaPipePose()) as {
    send: (input: { image: HTMLVideoElement }) => Promise<MediapipeResults>;
    onResults: (cb: (r: MediapipeResults) => void) => void;
    close: () => Promise<void>;
    reset?: () => void;
  };

  let running = false;
  let raf = 0;
  let video: HTMLVideoElement | null = null;
  let onFrame: ((f: PoseFrame) => void) | null = null;

  pose.onResults((results: MediapipeResults) => {
    if (!onFrame) return;
    const lm = results.poseLandmarks;
    if (!lm || lm.length === 0) {
      onFrame({
        landmarks: [],
        timestamp: performance.now(),
        imageWidth: 0,
        imageHeight: 0,
      });
      return;
    }
    const normalized = lm.map((p) => ({
      x: p.x,
      y: p.y,
      z: p.z ?? 0,
      visibility: p.visibility ?? 0,
    }));
    onFrame({
      landmarks: normalized,
      timestamp: performance.now(),
      imageWidth: 1,
      imageHeight: 1,
    });
  });

  return {
    async start(v: HTMLVideoElement, cb: (f: PoseFrame) => void) {
      if (running) return;
      running = true;
      video = v;
      onFrame = cb;
      const loop = async () => {
        if (!running || !video) return;
        try {
          await pose.send({ image: video });
        } catch (e) {
          console.warn("pose.send failed", e);
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      video = null;
      onFrame = null;
    },
  };
}