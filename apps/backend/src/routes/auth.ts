import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { hashPassword, verifyPassword } from "../utils/hash.js";
import { PrismaClient } from "@prisma/client";
import crypto, { type JsonWebKey as CryptoJsonWebKey } from "crypto";
import { sendMail } from "../utils/email.js";
import fetch from "node-fetch";

const router: Router = Router();

const prisma: PrismaClient = (global as any).prisma || new PrismaClient();
if (!(global as any).prisma) (global as any).prisma = prisma;

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

function parseJwtParts<THeader, TPayload>(token: string): {
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
    const header = JSON.parse(decodeBase64Url(encodedHeader).toString("utf8")) as THeader;
    const payload = JSON.parse(decodeBase64Url(encodedPayload).toString("utf8")) as TPayload;
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

let appleKeysCache: { keys: AppleSigningKey[]; expiresAt: number } | null = null;

async function verifyGoogleIdToken(
  idToken: string,
  allowedClientIds: string[]
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
  if (!payload.iss || !["https://accounts.google.com", "accounts.google.com"].includes(payload.iss)) {
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
  jwk: AppleSigningKey
): boolean {
  if (!jwk.kty || !jwk.n || !jwk.e) return false;
  const publicKey = crypto.createPublicKey({ key: jwk as CryptoJsonWebKey, format: "jwk" });
  const data = Buffer.from(`${encodedHeader}.${encodedPayload}`);
  const signature = decodeBase64Url(encodedSignature);
  return crypto.verify("RSA-SHA256", data, publicKey, signature);
}

async function verifyAppleIdToken(
  idToken: string,
  allowedClientIds: string[]
): Promise<AppleTokenPayload | null> {
  const parsed = parseJwtParts<AppleTokenHeader, AppleTokenPayload>(idToken);
  if (!parsed) return null;

  const { encodedHeader, encodedPayload, encodedSignature, header, payload } = parsed;
  if (!header.kid || header.alg !== "RS256") return null;

  const keys = await getAppleSigningKeys();
  const key = keys.find((k) => k.kid === header.kid && k.kty === "RSA");
  if (!key) return null;

  const signatureOk = verifyRs256JwtSignature(
    encodedHeader,
    encodedPayload,
    encodedSignature,
    key
  );
  if (!signatureOk) return null;

  if (payload.iss !== "https://appleid.apple.com") return null;
  if (!payload.aud || !allowedClientIds.includes(payload.aud)) return null;
  if (!payload.sub || !payload.sub.trim()) return null;

  const nowUnix = Math.floor(Date.now() / 1000);
  const expUnix = typeof payload.exp === "string" ? Number(payload.exp) : payload.exp;
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

router.post("/register", async (req: Request, res: Response) => {
  const { email, password, name } = req.body as { email: string; password: string; name?: string };
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  try {
    const normalizedEmail = normalizeEmail(email);
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ error: "User already exists" });

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name,
        dailyQuota: Number(process.env.FREE_DAILY_QUOTA) || 10,
        quotaResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const token = signJwt(user);
    return res.status(201).json({ token });
  } catch (e) {
    return res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  try {
    const startedAt = Date.now();
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        passwordHash: true,
      },
    });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = signJwt(user);
    const durationMs = Date.now() - startedAt;
    res.setHeader("x-auth-latency-ms", String(durationMs));
    return res.json({ token });
  } catch {
    return res.status(500).json({ error: "Login failed" });
  }
});

router.post("/sso/google", async (req: Request, res: Response) => {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken || !idToken.trim()) {
    return res.status(400).json({ error: "Google idToken is required" });
  }

  const allowedClientIds = getConfiguredGoogleClientIds();
  if (!allowedClientIds.length) {
    return res.status(503).json({ error: "Google SSO is not configured" });
  }

  try {
    const payload = await verifyGoogleIdToken(idToken, allowedClientIds);
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
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, name: user.name ?? payload.name ?? undefined },
      });
    }

    const token = signJwt(user);
    return res.json({
      token,
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
});

router.post("/sso/apple", async (req: Request, res: Response) => {
  const { idToken, name } = req.body as { idToken?: string; name?: string };
  if (!idToken || !idToken.trim()) {
    return res.status(400).json({ error: "Apple idToken is required" });
  }

  const allowedClientIds = getConfiguredAppleClientIds();
  if (!allowedClientIds.length) {
    return res.status(503).json({ error: "Apple SSO is not configured" });
  }

  try {
    const payload = await verifyAppleIdToken(idToken, allowedClientIds);
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
          name: name || payload.email || "Apple User",
          dailyQuota: Number(process.env.FREE_DAILY_QUOTA) || 10,
          quotaResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          emailVerified: true,
        },
      });
    } else if (!user.emailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, name: user.name ?? name ?? payload.email ?? undefined },
      });
    }

    const token = signJwt(user);
    return res.json({
      token,
      provider: "apple",
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? name ?? null,
      },
    });
  } catch (error) {
    console.error("Apple SSO error:", error);
    return res.status(500).json({ error: "Apple SSO failed" });
  }
});

router.get("/me", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const secret = process.env.JWT_SECRET as string;
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.sub as string } });
    if (!user) return res.status(401).json({ error: "Invalid token" });
    res.json({ id: user.id, email: user.email, name: user.name, dailyQuota: user.dailyQuota, quotaResetAt: user.quotaResetAt });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

function signJwt(user: { id: string; email: string }) {
  const secret = process.env.JWT_SECRET as string;
  return jwt.sign({ email: user.email }, secret, { subject: user.id, expiresIn: "7d" });
}

// Request password reset: generates a 6-digit code and emails it
router.post("/password/reset/request", async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  if (!email) return res.status(400).json({ error: "Email required" });

  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  if (!user) {
    // Do not leak user existence
    return res.json({ ok: true });
  }

  // Generate 6-digit numeric code
  const code = (Math.floor(100000 + Math.random() * 900000)).toString();
  const codeHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      codeHash,
      expiresAt,
    },
  });

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  await sendMail({
    to: email,
    subject: "Your Mufessir password reset code",
    text: `Your reset code is ${code}. It expires in 15 minutes.\n\nIf you didn't request this, ignore this email.\n\nYou can also reset at: ${appUrl}/reset-password`,
  });

  return res.json({ ok: true });
});

// Confirm reset with code and set new password
router.post("/password/reset/confirm", async (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body as { email: string; code: string; newPassword: string };
  if (!email || !code || !newPassword) return res.status(400).json({ error: "Missing fields" });

  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  if (!user) return res.status(400).json({ error: "Invalid code" });

  const rec = await prisma.passwordReset.findFirst({
    where: { userId: user.id, used: false },
    orderBy: { createdAt: "desc" },
  });
  if (!rec || rec.expiresAt < new Date()) return res.status(400).json({ error: "Invalid or expired code" });

  const ok = await verifyPassword(code, rec.codeHash);
  if (!ok) return res.status(400).json({ error: "Invalid or expired code" });

  // Update password
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await prisma.passwordReset.update({ where: { id: rec.id }, data: { used: true } });

  return res.json({ ok: true });
});

export default router; 
