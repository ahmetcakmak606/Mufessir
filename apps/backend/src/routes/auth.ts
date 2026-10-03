import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { hashPassword, verifyPassword } from "../utils/hash.js";
import crypto, { type JsonWebKey as CryptoJsonWebKey } from "crypto";
import { sendMail } from "../utils/email.js";
import fetch from "node-fetch";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  requireEmail,
  requireString,
  requirePassword,
  requireResetCode,
} from "../utils/input-policy.js";
import { shouldAllowEmailLinking } from "../utils/account-policy.js";
import { rateLimit, recordRateEvent, isRateLimited, getClientIp } from "../middleware/rate-limit.js";

const router: Router = Router();

// Plan 1B.8: interim abuse limits for auth endpoints. In-memory, single
// instance; the permanent, shared counters land with plan 3.1.
const HOUR_MS = 60 * 60 * 1000;
const FIVE_MIN_MS = 5 * 60 * 1000;

// Counter keys use the SAME normalization as account lookup (lowercase,
// trimmed) — otherwise "USER@x.com " variants open fresh counters and bypass
// the limits (2026-10-03 control finding 3).
function emailKeyPart(req: Request): string {
  const email = (req.body as Record<string, unknown> | undefined)?.email;
  return typeof email === "string" ? email.trim().toLowerCase() : "unknown";
}

const registerLimiter = rateLimit({
  windowMs: HOUR_MS,
  max: 15,
  key: (req) => `register:${getClientIp(req)}`,
  message: "Too many registrations from this address",
});

const loginLimiter = rateLimit({
  windowMs: FIVE_MIN_MS,
  max: 5,
  key: (req) => `login:${emailKeyPart(req)}:${getClientIp(req)}`,
  message: "Too many login attempts, please try again later",
});

const ssoLimiter = rateLimit({
  windowMs: FIVE_MIN_MS,
  max: 10,
  key: (req) => `sso:${getClientIp(req)}`,
  message: "Too many sign-in attempts, please try again later",
});

const resetRequestEmailLimiter = rateLimit({
  windowMs: HOUR_MS,
  max: 5,
  key: (req) => `reset-req-email:${emailKeyPart(req)}`,
  message: "Too many password reset requests for this account",
});

const resetRequestIpLimiter = rateLimit({
  windowMs: HOUR_MS,
  max: 20,
  key: (req) => `reset-req-ip:${getClientIp(req)}`,
  message: "Too many password reset requests, please try again later",
});

const resetConfirmLimiter = rateLimit({
  windowMs: HOUR_MS,
  max: 20,
  key: (req) => `reset-confirm:${emailKeyPart(req)}:${getClientIp(req)}`,
  message: "Too many reset confirmations, please try again later",
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getConfiguredGoogleClientIds(): string[] {
  const single = process.env.GOOGLE_CLIENT_ID?.trim();
  const multipleRaw = process.env.GOOGLE_CLIENT_IDS?.trim();
  const multiple = multipleRaw
    ? multipleRaw
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];
  return [...new Set([...(single ? [single] : []), ...multiple])];
}

function getConfiguredAppleClientIds(): string[] {
  const single = process.env.APPLE_CLIENT_ID?.trim();
  const multipleRaw = process.env.APPLE_CLIENT_IDS?.trim();
  const multiple = multipleRaw
    ? multipleRaw
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];
  return [...new Set([...(single ? [single] : []), ...multiple])];
}

function decodeBase64Url(value: string): Buffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function parseJwtParts<THeader, TPayload>(
  token: string,
): {
  encodedHeader: string;
  encodedPayload: string;
  encodedSignature: string;
  header: THeader;
  payload: TPayload;
} | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const encodedHeader = parts[0];
  const encodedPayload = parts[1];
  const encodedSignature = parts[2];
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;
  try {
    const header = JSON.parse(
      decodeBase64Url(encodedHeader).toString("utf8"),
    ) as THeader;
    const payload = JSON.parse(
      decodeBase64Url(encodedPayload).toString("utf8"),
    ) as TPayload;
    return { encodedHeader, encodedPayload, encodedSignature, header, payload };
  } catch {
    return null;
  }
}

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  exp?: string;
  iss?: string;
  name?: string;
  picture?: string;
  sub?: string;
};

type AppleTokenHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type AppleTokenPayload = {
  iss?: string;
  aud?: string;
  exp?: number | string;
  iat?: number | string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  is_private_email?: string | boolean;
};

type AppleSigningKey = CryptoJsonWebKey & {
  kid?: string;
  alg?: string;
  use?: string;
  kty?: string;
};

let appleKeysCache: { keys: AppleSigningKey[]; expiresAt: number } | null =
  null;

async function verifyGoogleIdToken(
  idToken: string,
  allowedClientIds: string[],
): Promise<GoogleTokenInfo | null> {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as GoogleTokenInfo;
  if (!payload.aud || !allowedClientIds.includes(payload.aud)) {
    return null;
  }
  if (
    !payload.iss ||
    !["https://accounts.google.com", "accounts.google.com"].includes(
      payload.iss,
    )
  ) {
    return null;
  }
  const nowUnix = Math.floor(Date.now() / 1000);
  const expUnix = payload.exp ? Number(payload.exp) : 0;
  if (!Number.isFinite(expUnix) || expUnix <= nowUnix) {
    return null;
  }
  const emailVerified =
    payload.email_verified === true || payload.email_verified === "true";
  if (!emailVerified) {
    return null;
  }
  return payload;
}

async function getAppleSigningKeys(): Promise<AppleSigningKey[]> {
  const now = Date.now();
  if (appleKeysCache && appleKeysCache.expiresAt > now) {
    return appleKeysCache.keys;
  }

  const response = await fetch("https://appleid.apple.com/auth/keys");
  if (!response.ok) {
    throw new Error("Failed to fetch Apple signing keys");
  }
  const body = (await response.json()) as { keys?: AppleSigningKey[] };
  const keys = Array.isArray(body.keys) ? body.keys : [];

  appleKeysCache = {
    keys,
    expiresAt: now + 60 * 60 * 1000,
  };
  return keys;
}

function verifyRs256JwtSignature(
  encodedHeader: string,
  encodedPayload: string,
  encodedSignature: string,
  jwk: AppleSigningKey,
): boolean {
  if (!jwk.kty || !jwk.n || !jwk.e) return false;
  const publicKey = crypto.createPublicKey({
    key: jwk as CryptoJsonWebKey,
    format: "jwk",
  });
  const data = Buffer.from(`${encodedHeader}.${encodedPayload}`);
  const signature = decodeBase64Url(encodedSignature);
  return crypto.verify("RSA-SHA256", data, publicKey, signature);
}

async function verifyAppleIdToken(
  idToken: string,
  allowedClientIds: string[],
): Promise<AppleTokenPayload | null> {
  const parsed = parseJwtParts<AppleTokenHeader, AppleTokenPayload>(idToken);
  if (!parsed) return null;

  const { encodedHeader, encodedPayload, encodedSignature, header, payload } =
    parsed;
  if (!header.kid || header.alg !== "RS256") return null;

  const keys = await getAppleSigningKeys();
  const key = keys.find((k) => k.kid === header.kid && k.kty === "RSA");
  if (!key) return null;

  const signatureOk = verifyRs256JwtSignature(
    encodedHeader,
    encodedPayload,
    encodedSignature,
    key,
  );
  if (!signatureOk) return null;

  if (payload.iss !== "https://appleid.apple.com") return null;
  if (!payload.aud || !allowedClientIds.includes(payload.aud)) return null;
  if (!payload.sub || !payload.sub.trim()) return null;

  const nowUnix = Math.floor(Date.now() / 1000);
  const expUnix =
    typeof payload.exp === "string" ? Number(payload.exp) : payload.exp;
  if (!expUnix || expUnix <= nowUnix) return null;

  if (
    payload.email &&
    payload.email_verified !== undefined &&
    !(payload.email_verified === true || payload.email_verified === "true")
  ) {
    return null;
  }

  return payload;
}

router.post(
  "/register",
  registerLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = (req.body ?? {}) as Record<string, unknown>;
    // Plan 1B.1/1B.5: wrong types are 400s, never process crashes; the same
    // password policy applies here and in password reset.
    const normalizedEmail = requireEmail(email);
    const normalizedPassword = requirePassword(password);
    const displayName =
      name === undefined || name === null
        ? undefined
        : requireString("name", name, { min: 1, max: 120 });

    try {
      const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existing) return res.status(409).json({ error: "User already exists" });

      const passwordHash = await hashPassword(normalizedPassword);
      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name: displayName,
          dailyQuota: Number(process.env.FREE_DAILY_QUOTA) || 10,
          quotaResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const token = signJwt(user);
      return res.status(201).json({ token });
    } catch {
      return res.status(500).json({ error: "Registration failed" });
    }
  }),
);

router.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = (req.body ?? {}) as Record<string, unknown>;
    const normalizedEmail = requireEmail(email);
    const normalizedPassword = requireString("password", password, {
      min: 1,
      max: 200,
      trim: false,
    });

    try {
      const startedAt = Date.now();
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          email: true,
          passwordHash: true,
        },
      });
      if (!user) return res.status(401).json({ error: "Invalid credentials" });

      const valid = await verifyPassword(normalizedPassword, user.passwordHash);
      if (!valid) return res.status(401).json({ error: "Invalid credentials" });

      const token = signJwt(user);
      const durationMs = Date.now() - startedAt;
      res.setHeader("x-auth-latency-ms", String(durationMs));
      return res.json({ token });
    } catch {
      return res.status(500).json({ error: "Login failed" });
    }
  }),
);

router.post(
  "/sso/google",
  ssoLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { idToken } = (req.body ?? {}) as Record<string, unknown>;
    // Plan 1B.1 (SEC-01): a non-string idToken used to crash the process
    // before this point. Wrong types are 400s now.
    const token = requireString("idToken", idToken, { min: 1, max: 4096 });
    if (!token.trim()) {
      return res.status(400).json({ error: "Google idToken is required" });
    }

    const allowedClientIds = getConfiguredGoogleClientIds();
    if (!allowedClientIds.length) {
      return res.status(503).json({ error: "Google SSO is not configured" });
    }

    try {
      const payload = await verifyGoogleIdToken(token, allowedClientIds);
      if (!payload || !payload.email) {
        return res.status(401).json({ error: "Invalid Google token" });
      }

      const email = normalizeEmail(payload.email);
      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        // Create a random local password hash for SSO-only accounts.
        const randomPassword = crypto.randomBytes(32).toString("hex");
        const passwordHash = await hashPassword(randomPassword);
        user = await prisma.user.create({
          data: {
            email,
            passwordHash,
            name: payload.name || undefined,
            dailyQuota: Number(process.env.FREE_DAILY_QUOTA) || 10,
            quotaResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            emailVerified: true,
          },
        });
      } else if (!user.emailVerified) {
        // Plan 1B.8 (SEC-02): never merge an SSO identity into a locally
        // pre-registered (unverified) account by email equality alone.
        if (!shouldAllowEmailLinking(user)) {
          return res.status(409).json({
            error:
              "An account with this email already exists. Sign in with your password instead; provider linking will be available after account verification.",
          });
        }
        await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            name: user.name ?? payload.name ?? undefined,
          },
        });
      }

      const token2 = signJwt(user);
      return res.json({
        token: token2,
        provider: "google",
        user: {
          id: user.id,
          email: user.email,
          name: user.name ?? payload.name ?? null,
          picture: payload.picture ?? null,
        },
      });
    } catch (error) {
      console.error("Google SSO error:", error);
      return res.status(500).json({ error: "Google SSO failed" });
    }
  }),
);

router.post(
  "/sso/apple",
  ssoLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { idToken, name } = (req.body ?? {}) as Record<string, unknown>;
    const token = requireString("idToken", idToken, { min: 1, max: 4096 });
    if (!token.trim()) {
      return res.status(400).json({ error: "Apple idToken is required" });
    }
    const displayName =
      name === undefined || name === null
        ? undefined
        : requireString("name", name, { min: 1, max: 120 });

    const allowedClientIds = getConfiguredAppleClientIds();
    if (!allowedClientIds.length) {
      return res.status(503).json({ error: "Apple SSO is not configured" });
    }

    try {
      const payload = await verifyAppleIdToken(token, allowedClientIds);
      if (!payload || !payload.sub) {
        return res.status(401).json({ error: "Invalid Apple token" });
      }

      const syntheticEmail = `apple-${payload.sub}@appleid.local`;
      const email = normalizeEmail(payload.email || syntheticEmail);
      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        const randomPassword = crypto.randomBytes(32).toString("hex");
        const passwordHash = await hashPassword(randomPassword);
        user = await prisma.user.create({
          data: {
            email,
            passwordHash,
            name: displayName || payload.email || "Apple User",
            dailyQuota: Number(process.env.FREE_DAILY_QUOTA) || 10,
            quotaResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            emailVerified: true,
          },
        });
      } else if (!user.emailVerified) {
        // Plan 1B.8 (SEC-02): same linking gate as Google.
        if (!shouldAllowEmailLinking(user)) {
          return res.status(409).json({
            error:
              "An account with this email already exists. Sign in with your password instead; provider linking will be available after account verification.",
          });
        }
        await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            name: user.name ?? displayName ?? payload.email ?? undefined,
          },
        });
    }

    const jwtToken = signJwt(user);
    return res.json({
      token: jwtToken,
      provider: "apple",
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? displayName ?? null,
      },
    });
  } catch (error) {
    console.error("Apple SSO error:", error);
    return res.status(500).json({ error: "Apple SSO failed" });
  }
  }),
);

router.get(
  "/me",
  asyncHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : undefined;
    if (!token) return res.status(401).json({ error: "Missing token" });
    try {
      const secret = process.env.JWT_SECRET as string;
      const payload = jwt.verify(token, secret) as jwt.JwtPayload;
      const user = await prisma.user.findUnique({
        where: { id: payload.sub as string },
      });
      if (!user) return res.status(401).json({ error: "Invalid token" });
      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        dailyQuota: user.dailyQuota,
        quotaResetAt: user.quotaResetAt,
      });
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  }),
);

function signJwt(user: { id: string; email: string }) {
  const secret = process.env.JWT_SECRET as string;
  return jwt.sign({ email: user.email }, secret, {
    subject: user.id,
    expiresIn: "7d",
  });
}

// Request password reset: generates a 6-digit code and emails it
router.post(
  "/password/reset/request",
  resetRequestEmailLimiter,
  resetRequestIpLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = (req.body ?? {}) as Record<string, unknown>;
    const normalizedEmail = requireEmail(email);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) {
      // Do not leak user existence
      return res.json({ ok: true });
    }

    // Plan 1B.2 (SEC-05): cryptographically random code; single active
    // code — a new request invalidates all previous unused codes, so an
    // older code cannot "revive" after the newest one is consumed (SEC-04's
    // quick half; the atomic permanent fix is 3.1).
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = await hashPassword(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.passwordReset.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt,
      },
  });

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  await sendMail({
    to: normalizedEmail,
    subject: "Your Mufessir password reset code",
    text: `Your reset code is ${code}. It expires in 15 minutes.\n\nIf you didn't request this, ignore this email.\n\nYou can also reset at: ${appUrl}/reset-password`,
  });

  return res.json({ ok: true });
  }),
);

// Confirm reset with code and set new password
router.post(
  "/password/reset/confirm",
  resetConfirmLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email, code, newPassword } = (req.body ?? {}) as Record<string, unknown>;
    const normalizedEmail = requireEmail(email);
    const normalizedCode = requireResetCode(code);
    const normalizedPassword = requirePassword(newPassword);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) return res.status(400).json({ error: "Invalid code" });

    const rec = await prisma.passwordReset.findFirst({
      where: { userId: user.id, used: false },
      orderBy: { createdAt: "desc" },
    });
    if (!rec || rec.expiresAt < new Date())
      return res.status(400).json({ error: "Invalid or expired code" });

    // Plan 1B.8: the lockout must apply BEFORE the code comparison — a
    // correct code after repeated failures must not reset the password
    // (2026-10-03 control finding 1).
    if (isRateLimited(`reset-fail:${normalizedEmail}`, HOUR_MS, 5)) {
      return res
        .status(429)
        .json({ error: "Too many failed attempts, please try again later" });
    }

    const ok = await verifyPassword(normalizedCode, rec.codeHash);
    if (!ok) {
      // Plan 1B.8: temporary failed-attempt counter per account until the
      // permanent PasswordReset.failedAttempts lock (3.1) lands.
      const { limited } = recordRateEvent(
        `reset-fail:${normalizedEmail}`,
        HOUR_MS,
        5,
      );
      return res
        .status(limited ? 429 : 400)
        .json({
          error: limited
            ? "Too many failed attempts, please try again later"
            : "Invalid or expired code",
        });
    }

    // Conditional consumption: only this request can flip used=false → true,
    // so concurrent confirmations cannot both succeed (SEC-04 interim).
    const consumed = await prisma.passwordReset.updateMany({
      where: { id: rec.id, used: false },
      data: { used: true },
    });
    if (consumed.count !== 1) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    const passwordHash = await hashPassword(normalizedPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    return res.json({ ok: true });
  }),
);

export default router;
