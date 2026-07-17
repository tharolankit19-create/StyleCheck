/**
 * generateBetterOutfit — premium-only callable.
 *
 * Takes an existing analysis, builds a restyle prompt from its detected
 * features, calls Replicate to generate the same person in a better-coordinated
 * outfit, stores the result to Cloud Storage, and returns a download URL.
 *
 * Gated on the premium entitlement. Results are cached per analysis so repeat
 * requests don't re-bill Replicate.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { REPLICATE_API_TOKEN, REPLICATE_MODEL, ENFORCE_APP_CHECK } from "./config";
import { generateBetterOutfitImage } from "./services/replicate";
import { isPremium } from "./util/entitlement";

interface GenRequest {
  imageSha256: string;
}

export const generateBetterOutfit = onCall(
  {
    region: "us-central1",
    secrets: [REPLICATE_API_TOKEN],
    memory: "512MiB",
    timeoutSeconds: 120,
    enforceAppCheck: ENFORCE_APP_CHECK,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");

    const { imageSha256 } = (request.data ?? {}) as GenRequest;
    if (!imageSha256 || !/^[a-f0-9]{64}$/.test(imageSha256)) {
      throw new HttpsError("invalid-argument", "Valid imageSha256 required.");
    }

    const db = getFirestore();
    const userSnap = await db.collection("users").doc(uid).get();
    const premium = isPremium({
      userDoc: userSnap.data(),
      token: request.auth?.token as Record<string, unknown> | undefined,
    });
    if (!premium) {
      throw new HttpsError("permission-denied", "Premium required to generate a restyle.");
    }

    const analysisRef = db.collection("analyses").doc(imageSha256);
    const snap = await analysisRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Analysis not found.");
    const analysis = snap.data()!;

    // Return the cached restyle if we already generated one.
    if (analysis.restyleUrl) {
      return { imageUrl: analysis.restyleUrl as string, cached: true };
    }

    const bucket = getStorage().bucket();
    // Signed read URL for the source photo so Replicate can fetch it.
    const [sourceUrl] = await bucket
      .file(analysis.storagePath)
      .getSignedUrl({ action: "read", expires: Date.now() + 15 * 60 * 1000 });

    const prompt = buildRestylePrompt(analysis);

    let outputUrl: string;
    try {
      outputUrl = await generateBetterOutfitImage({
        token: REPLICATE_API_TOKEN.value(),
        model: REPLICATE_MODEL.value(),
        imageUrl: sourceUrl,
        prompt,
      });
    } catch (err) {
      logger.error("Replicate failed", { uid, imageSha256, err: String(err) });
      throw new HttpsError("unavailable", "Restyle generation failed. Please try again.");
    }

    // Persist the generated image into our own Storage so it survives Replicate's TTL.
    const destPath = `restyles/${uid}/${imageSha256}.png`;
    const dest = bucket.file(destPath);
    const imgRes = await fetch(outputUrl);
    if (!imgRes.ok) throw new HttpsError("unavailable", "Could not fetch generated image.");
    const buf = Buffer.from(await imgRes.arrayBuffer());
    await dest.save(buf, { contentType: "image/png", resumable: false });
    const [restyleUrl] = await dest.getSignedUrl({
      action: "read",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    await analysisRef.set(
      { restyleUrl, restyledAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    logger.info("generateBetterOutfit done", { uid, imageSha256 });
    return { imageUrl: restyleUrl, cached: false };
  },
);

/**
 * Compose a restyle prompt from detected features. We keep the person and pose,
 * and target the outfit's weakest dimension (color / formality coherence).
 */
function buildRestylePrompt(analysis: FirebaseFirestore.DocumentData): string {
  const category: string = analysis.category ?? "elevated casual";
  const meanFormality: number = analysis.features?.meanFormality ?? 0.5;
  const register =
    meanFormality >= 0.75 ? "polished formal" : meanFormality <= 0.3 ? "clean relaxed" : "sharp smart-casual";

  return [
    "Keep the same person, same face, same pose, same body and same background.",
    "Restyle only their clothing into a better-coordinated, more flattering outfit.",
    `Aim for a ${register}, ${category.toLowerCase()} look with a cohesive, harmonious color palette,`,
    "well-fitted tailoring and intentional proportions.",
    "Photorealistic, full-body, natural lighting, high fashion editorial quality.",
  ].join(" ");
}
