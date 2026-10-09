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
 * Plan 1B.8 (güncelleme 2026-10-09): kodda henüz doğrulama e-postası akışı
 * YOK (tek sendMail şifre sıfırlamada) ve mevcut kullanıcıların hiçbirinin
 * e-postası doğrulanmış değil. Varsayılanı üretimde açık bırakmak, akışı
 * olmayan bir kapı demek — dağıtımı tek bir env değişkenine bağlamak bir
 * ayak tabancasıydı. Bu nedenle kapı varsayılan KAPALI; 3.x'te doğrulama
 * akışı geldiğinde REQUIRE_VERIFIED_EMAIL=1 ile bilinçli açılacak (dağıtım
 * değişkeniyle, kod değişikliği olmadan). "0" açık yazılımında bir şey
 * değiştirmez.
 */
export function requiresVerifiedEmailForQuota(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.REQUIRE_VERIFIED_EMAIL === "1";
}
