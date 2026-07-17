/**
 * analyzeOutfit — the core callable.
 *
 * Flow:
 *   1. Require an authenticated (anonymous) caller.
 *   2. Enforce a per-day free-analysis quota for non-premium users.
 *   3. Dedupe on the image SHA-256 → guarantees "same image = same score".
 *   4. Run Vision → extract features → deterministic score → critique.
 *   5. Persist the full analysis; return free fields to everyone and the
 *      premium breakdown only to entitled users.
 *
 * The client never receives a vendor key and never computes the score.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { VISION_API_KEY, FREE_ANALYSES_PER_DAY, ENFORCE_APP_CHECK } from "./config";
import { annotateImage } from "./services/vision";
import { extractFeatures, classifyCategory } from "./scoring/features";
import { scoreOutfit } from "./scoring/scoreEngine";
import { buildCritique } from "./scoring/critique";
import { withRetry } from "./util/retry";
import { isPremium } from "./util/entitlement";

interface AnalyzeRequest {
  /** Storage object path, e.g. "uploads/<uid>/<sha>.jpg". */
  storagePath: string;
  /** Client-computed SHA-256 of the raw image bytes (hex). */
  imageSha256: string;
}

export const analyzeOutfit = onCall(
  {
    region: "us-central1",
    secrets: [VISION_API_KEY],
    memory: "512MiB",
    timeoutSeconds: 60,
    // App Check blocks calls from anything but genuine app builds. Enable it in
    // production by setting ENFORCE_APP_CHECK=true (see README / PRODUCTION.md).
    enforceAppCheck: ENFORCE_APP_CHECK,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }

    const { storagePath, imageSha256 } = (request.data ?? {}) as AnalyzeRequest;
    if (!storagePath || !imageSha256 || !/^[a-f0-9]{64}$/.test(imageSha256)) {
      throw new HttpsError("invalid-argument", "storagePath and imageSha256 are required.");
    }
    // Guard against reading arbitrary paths: uploads must be namespaced to the caller.
    if (!storagePath.startsWith(`uploads/${uid}/`)) {
      throw new HttpsError("permission-denied", "Invalid upload path.");
    }

    const db = getFirestore();
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const premium = isPremium({
      userDoc: userSnap.data(),
      token: request.auth?.token as Record<string, unknown> | undefined,
    });

    // 1) Determinism + cost control: return the cached analysis for this image.
    const analysisRef = db.collection("analyses").doc(imageSha256);
    const cached = await analysisRef.get();
    if (cached.exists) {
      logger.info("analyzeOutfit cache hit", { uid, imageSha256 });
      return shape(cached.data()!, premium);
    }

    // 2) Quota for non-premium users (deterministic day bucket, UTC).
    if (!premium) {
      const limit = parseInt(FREE_ANALYSES_PER_DAY.value(), 10) || 3;
      const day = new Date().toISOString().slice(0, 10);
      const quotaRef = userRef.collection("quota").doc(day);
      const used = await db.runTransaction(async (tx) => {
        const q = await tx.get(quotaRef);
        const count = (q.data()?.count ?? 0) as number;
        if (count >= limit) return -1;
        tx.set(quotaRef, { count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return count + 1;
      });
      if (used === -1) {
        throw new HttpsError(
          "resource-exhausted",
          `Free limit reached (${limit}/day). Upgrade for unlimited checks.`,
        );
      }
    }

    // 3) Vision → features → score. Wrapped in retry for transient vendor errors.
    const bucket = process.env.STORAGE_BUCKET || `${process.env.GCLOUD_PROJECT}.appspot.com`;
    const gcsUri = `gs://${bucket}/${storagePath}`;

    let raw;
    try {
      raw = await withRetry(() => annotateImage({ gcsUri }), { retries: 2, baseDelayMs: 700 });
    } catch (err) {
      logger.error("Vision failed", { uid, err: String(err) });
      throw new HttpsError("unavailable", "Could not analyze the photo. Try another shot.");
    }

    const features = extractFeatures(raw);
    const result = scoreOutfit(features);
    const category = classifyCategory(features);
    const critique = buildCritique(features, result);

    const doc = {
      score: result.score,
      critique,
      category,
      breakdown: result.detail,
      weakestDimension: result.weakestDimension,
      // Persist enough to regenerate the "better outfit" prompt later.
      features: {
        dominantColors: features.dominantColors,
        garments: features.garments,
        meanFormality: features.meanFormality,
        neutralRatio: features.neutralRatio,
      },
      storagePath,
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
    };

    await analysisRef.set(doc);
    // Lightweight per-user history entry.
    await userRef
      .collection("history")
      .doc(imageSha256)
      .set(
        { imageSha256, score: result.score, category, storagePath, createdAt: FieldValue.serverTimestamp() },
        { merge: true },
      );

    logger.info("analyzeOutfit computed", { uid, imageSha256, score: result.score, category });
    return shape(doc, premium);
  },
);

/** Return free fields to everyone; premium breakdown only to entitled users. */
function shape(data: FirebaseFirestore.DocumentData, premium: boolean) {
  const base = {
    imageSha256: data.storagePath?.split("/").pop()?.split(".")[0],
    score: data.score,
    critique: data.critique,
    category: data.category,
    isPremiumUnlocked: premium,
  };
  if (!premium) return base;
  return {
    ...base,
    breakdown: data.breakdown,
    weakestDimension: data.weakestDimension,
  };
}
