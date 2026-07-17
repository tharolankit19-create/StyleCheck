/**
 * Centralized access to server-side secrets and config.
 *
 * SECURITY: every third-party key lives here, sourced from the Functions
 * runtime environment / Secret Manager. None of these values are ever returned
 * to the client. The client only ever calls our callable functions.
 */

import { defineSecret, defineString } from "firebase-functions/params";

// Secrets — provisioned via `firebase functions:secrets:set` (see README).
export const REPLICATE_API_TOKEN = defineSecret("REPLICATE_API_TOKEN");
export const REVENUECAT_WEBHOOK_AUTH = defineSecret("REVENUECAT_WEBHOOK_AUTH");
// Vision uses Application Default Credentials (the Functions service account),
// so no API key is needed when deployed. A key is only used for local emulation.
export const VISION_API_KEY = defineSecret("VISION_API_KEY");

// Non-secret, environment-tunable parameters.
export const REPLICATE_MODEL = defineString("REPLICATE_MODEL", {
  default:
    "black-forest-labs/flux-kontext-pro",
});

export const FREE_ANALYSES_PER_DAY = defineString("FREE_ANALYSES_PER_DAY", {
  default: "3",
});

/**
 * RevenueCat entitlement identifier that unlocks premium features.
 * MUST match the entitlement identifier in the RevenueCat dashboard AND the
 * client's `AppConfig.premiumEntitlement`.
 */
export const PREMIUM_ENTITLEMENT = "StyleCheck Pro";
