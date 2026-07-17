/**
 * Replicate integration for generating the "better-coordinated outfit" image.
 *
 * We use an image-conditioned model (FLUX Kontext by default) so the output
 * preserves the same person/pose while restyling the outfit. The API token is
 * server-side only.
 *
 * Includes bounded polling with exponential backoff and a hard timeout.
 */

import { withRetry } from "../util/retry";

const REPLICATE_BASE = "https://api.replicate.com/v1";

interface PredictionResponse {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[];
  error?: string;
  urls?: { get: string; cancel: string };
}

async function replicateFetch(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${REPLICATE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export interface GenerateArgs {
  token: string;
  model: string; // "owner/name" or "owner/name:version"
  imageUrl: string; // publicly-readable or signed URL of the source photo
  prompt: string;
  timeoutMs?: number;
}

export async function generateBetterOutfitImage(args: GenerateArgs): Promise<string> {
  const { token, model, imageUrl, prompt, timeoutMs = 90_000 } = args;

  // Kick off the prediction. Support both "owner/model" and pinned versions.
  const [ownerModel, version] = model.split(":");
  const createBody = version
    ? { version, input: { input_image: imageUrl, prompt } }
    : { input: { input_image: imageUrl, prompt } };
  const createPath = version
    ? "/predictions"
    : `/models/${ownerModel}/predictions`;

  const created = await withRetry(
    async () => {
      const res = await replicateFetch(createPath, token, {
        method: "POST",
        body: JSON.stringify(createBody),
      });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`Replicate transient ${res.status}`);
      }
      if (!res.ok) {
        throw Object.assign(new Error(`Replicate create failed: ${res.status}`), {
          fatal: true,
        });
      }
      return (await res.json()) as PredictionResponse;
    },
    { retries: 3, baseDelayMs: 800 },
  );

  const getUrl = created.urls?.get ?? `${REPLICATE_BASE}/predictions/${created.id}`;
  const deadline = Date.now() + timeoutMs;
  let delay = 1000;

  // Poll until terminal state or timeout.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() > deadline) {
      throw new Error("Replicate generation timed out");
    }
    await sleep(delay);
    delay = Math.min(delay * 1.5, 5000);

    const res = await replicateFetch(getUrl.replace(REPLICATE_BASE, ""), token);
    if (!res.ok) continue; // transient read error, keep polling
    const pred = (await res.json()) as PredictionResponse;

    if (pred.status === "succeeded") {
      const out = pred.output;
      const url = Array.isArray(out) ? out[out.length - 1] : out;
      if (!url) throw new Error("Replicate returned no output");
      return url;
    }
    if (pred.status === "failed" || pred.status === "canceled") {
      throw new Error(`Replicate ${pred.status}: ${pred.error ?? "unknown"}`);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
