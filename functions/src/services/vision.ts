/**
 * Google Cloud Vision integration.
 *
 * We request the three features the scoring engine needs in a single annotate
 * call: image properties (dominant colors), object localization (garments &
 * framing) and label detection (style/formality signals).
 *
 * When deployed to Cloud Functions this authenticates with the function's
 * service account via Application Default Credentials — no API key in the client,
 * ever.
 */

import { ImageAnnotatorClient } from "@google-cloud/vision";
import { DominantColor } from "../scoring/color";
import { RawVision, VisionLabel, VisionObject } from "../scoring/features";

let client: ImageAnnotatorClient | null = null;
function getClient(): ImageAnnotatorClient {
  if (!client) client = new ImageAnnotatorClient();
  return client;
}

/**
 * Annotate an image stored in Cloud Storage (gs:// URI) — preferred, avoids
 * shuttling bytes — or raw bytes as a fallback.
 */
export async function annotateImage(input: {
  gcsUri?: string;
  content?: Buffer;
}): Promise<RawVision> {
  const image = input.gcsUri
    ? { source: { imageUri: input.gcsUri } }
    : { content: input.content!.toString("base64") };

  const [result] = await getClient().annotateImage({
    image,
    features: [
      { type: "IMAGE_PROPERTIES" },
      { type: "OBJECT_LOCALIZATION", maxResults: 30 },
      { type: "LABEL_DETECTION", maxResults: 30 },
      { type: "FACE_DETECTION", maxResults: 5 },
    ],
  });

  if (result.error?.message) {
    throw new Error(`Vision error: ${result.error.message}`);
  }

  const colors: DominantColor[] =
    result.imagePropertiesAnnotation?.dominantColors?.colors?.map((c) => ({
      rgb: {
        r: Math.round(c.color?.red ?? 0),
        g: Math.round(c.color?.green ?? 0),
        b: Math.round(c.color?.blue ?? 0),
      },
      fraction: c.pixelFraction ?? 0,
    })) ?? [];

  const labels: VisionLabel[] =
    result.labelAnnotations?.map((l) => ({
      description: l.description ?? "",
      score: l.score ?? 0,
    })) ?? [];

  const objects: VisionObject[] =
    result.localizedObjectAnnotations?.map((o) => {
      const verts = o.boundingPoly?.normalizedVertices ?? [];
      const xs = verts.map((v) => v.x ?? 0);
      const ys = verts.map((v) => v.y ?? 0);
      const x = Math.min(...xs, 1);
      const y = Math.min(...ys, 1);
      return {
        name: o.name ?? "",
        score: o.score ?? 0,
        box: {
          x,
          y,
          w: Math.max(...xs, 0) - x,
          h: Math.max(...ys, 0) - y,
        },
      };
    }) ?? [];

  const faceCount = result.faceAnnotations?.length ?? 0;

  return { labels, objects, colors, faceCount };
}
