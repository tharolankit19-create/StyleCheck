/**
 * RevenueCat webhook — the source of truth for entitlements.
 *
 * RevenueCat calls this endpoint on purchase/renewal/expiration events. We
 * verify the shared Authorization header, then mirror the premium entitlement
 * onto the user's Firestore doc so analyzeOutfit / generateBetterOutfit can gate
 * on it server-side.
 *
 * The client subscribes and restores through the RevenueCat SDK; it never
 * grants itself premium.
 */

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { REVENUECAT_WEBHOOK_AUTH, PREMIUM_ENTITLEMENT } from "./config";

const ACTIVE_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
]);
const INACTIVE_TYPES = new Set(["EXPIRATION", "CANCELLATION", "SUBSCRIPTION_PAUSED", "REFUND"]);

export const revenuecatWebhook = onRequest(
  { region: "us-central1", secrets: [REVENUECAT_WEBHOOK_AUTH] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }
    const expected = REVENUECAT_WEBHOOK_AUTH.value();
    if (expected && req.get("Authorization") !== expected) {
      logger.warn("RevenueCat webhook auth mismatch");
      res.status(401).send("Unauthorized");
      return;
    }

    const event = req.body?.event;
    if (!event) {
      res.status(400).send("No event");
      return;
    }

    // app_user_id is the Firebase uid we set on the client via Purchases.logIn.
    const uid: string | undefined = event.app_user_id;
    if (!uid) {
      res.status(200).send("No app_user_id; ignored");
      return;
    }

    const type: string = event.type;
    const entitlementIds: string[] = event.entitlement_ids ?? [
      event.entitlement_id,
    ].filter(Boolean);
    const grantsPremium = entitlementIds.includes(PREMIUM_ENTITLEMENT) || entitlementIds.length === 0;

    let active: boolean | null = null;
    if (ACTIVE_TYPES.has(type)) active = true;
    else if (INACTIVE_TYPES.has(type)) active = false;

    if (active === null || !grantsPremium) {
      logger.info("RevenueCat event ignored", { type, uid });
      res.status(200).send("ok");
      return;
    }

    await getFirestore()
      .collection("users")
      .doc(uid)
      .set(
        {
          premium: active,
          entitlements: { [PREMIUM_ENTITLEMENT]: active },
          rcLastEvent: type,
          rcUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    logger.info("RevenueCat entitlement synced", { uid, type, active });
    res.status(200).send("ok");
  },
);
