/**
 * Server-side premium check that is robust to how the entitlement reached us.
 *
 * Two supported sources of truth, checked together so gating works no matter
 * which the project uses:
 *   1. The Firestore `users/{uid}` doc written by our `revenuecatWebhook`.
 *   2. Firebase Auth custom claims set by the RevenueCat Firebase Extension
 *      (which mirrors active entitlements onto the auth token).
 *
 * The client can never forge either: custom claims are signed by Firebase and
 * the user doc is server-write-only per Firestore rules.
 */

import { PREMIUM_ENTITLEMENT } from "../config";

/** Claims we might see on the decoded auth token. */
interface AuthLikeToken {
  [key: string]: unknown;
  revenueCatEntitlements?: unknown;
  entitlements?: unknown;
  premium?: unknown;
}

function claimGrantsPremium(token: AuthLikeToken | undefined): boolean {
  if (!token) return false;

  // Direct boolean claim (e.g. token["StyleCheck Pro"] === true or premium).
  if (token[PREMIUM_ENTITLEMENT] === true) return true;
  if (token.premium === true) return true;

  // Array-of-active-entitlements claim (RevenueCat Firebase Extension style).
  for (const key of ["revenueCatEntitlements", "entitlements"] as const) {
    const value = token[key];
    if (Array.isArray(value) && value.includes(PREMIUM_ENTITLEMENT)) return true;
  }
  return false;
}

function docGrantsPremium(
  userDoc: FirebaseFirestore.DocumentData | undefined,
): boolean {
  if (!userDoc) return false;
  const ent = userDoc.entitlements as Record<string, boolean> | undefined;
  return Boolean(ent?.[PREMIUM_ENTITLEMENT]) || Boolean(userDoc.premium);
}

export function isPremium(args: {
  userDoc?: FirebaseFirestore.DocumentData;
  token?: Record<string, unknown>;
}): boolean {
  return (
    docGrantsPremium(args.userDoc) ||
    claimGrantsPremium(args.token as AuthLikeToken | undefined)
  );
}
