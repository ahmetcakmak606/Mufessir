import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { hashPassword, verifyPassword } from "../utils/hash.js";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { sendMail } from "../utils/email.js";

const router: Router = Router();

const prisma: PrismaClient = (global as any).prisma || new PrismaClient();
if (!(global as any).prisma) (global as any).prisma = prisma;

router.post("/register", async (req: Request, res: Response) => {
  const { email, password, name } = req.body as { email: string; password: string; name?: string };
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "User already exists" });

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { email, passwordHash, name, dailyQuota: Number(process.env.FREE_DAILY_QUOTA) || 3, quotaResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });

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
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = signJwt(user);
    return res.json({ token });
  } catch {
    return res.status(500).json({ error: "Login failed" });
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

  const user = await prisma.user.findUnique({ where: { email } });
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

  const user = await prisma.user.findUnique({ where: { email } });
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