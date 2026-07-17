/**
 * StyleCheck Cloud Functions entrypoint.
 *
 * All third-party vendor calls (Google Cloud Vision, Replicate, RevenueCat)
 * happen here, server-side. The Flutter client only ever invokes these
 * functions — it never holds a vendor key.
 */

import { initializeApp } from "firebase-admin/app";

initializeApp();

export { analyzeOutfit } from "./analyzeOutfit";
export { generateBetterOutfit } from "./generateBetterOutfit";
export { revenuecatWebhook } from "./revenuecatWebhook";
