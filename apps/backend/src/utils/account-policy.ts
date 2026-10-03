// Account-security policy switches (plan 1B.8 — interim mitigations until
// the permanent fixes in Faz 3 land).

/**
 * SEC-02 interim: linking an SSO identity into a locally pre-registered
 * (unverified) account is blocked by default. Reason: anyone can open a
 * local account with someone else's email; auto-merging on later SSO login
 * keeps the pre-registrant's password valid. Already-verified accounts are
 * SSO-created in this codebase, so normal SSO re-login is unaffected.
 * Explicit opt-in via SSO_ALLOW_EMAIL_LINKING=1 is a rollback switch, not a
 * supported mode; the real fix is the ExternalIdentity model (3.4).
 */
export function shouldAllowEmailLinking(
  user: { emailVerified: boolean },
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (user.emailVerified) return true;
  return env.SSO_ALLOW_EMAIL_LINKING === "1";
}

/**
 * Plan 1B.8: without an email-verification flow, unverified local accounts
 * (trivially mass-created — SEC-05) must not consume generation quota in
 * production. REQUIRE_VERIFIED_EMAIL overrides explicitly (0/1);
 * non-production environments stay open so development and tests are
 * unaffected.
 */
export function requiresVerifiedEmailForQuota(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.REQUIRE_VERIFIED_EMAIL !== undefined) {
    return env.REQUIRE_VERIFIED_EMAIL === "1";
  }
  return env.NODE_ENV === "production";
}
