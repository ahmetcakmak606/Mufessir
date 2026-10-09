import { describe, it, expect, vi } from "vitest";
import {
  shouldAllowEmailLinking,
  requiresVerifiedEmailForQuota,
} from "../src/utils/account-policy.js";
import { sendMail } from "../src/utils/email.js";
import { getClientIp } from "../src/middleware/rate-limit.js";
import type { Request } from "express";

function fakeReq(headers: Record<string, string>, remoteAddress = "9.9.9.9"): Request {
  return {
    headers,
    socket: { remoteAddress },
  } as unknown as Request;
}

describe("client IP resolution (1B.8, control finding 2)", () => {
  const prev = process.env.TRUST_PROXY;

  it("with one trusted proxy, uses the RIGHTMOST XFF entry (client-set prefixes ignored)", () => {
    process.env.TRUST_PROXY = "1";
    try {
      const ip = getClientIp(
        fakeReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }),
      );
      expect(ip).toBe("5.6.7.8");
    } finally {
      if (prev === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = prev;
    }
  });

  it("a single-entry XFF is taken as the proxy-written client IP (replace model)", () => {
    // With TRUST_PROXY=1 and one entry, the value is assumed to be written
    // by our own proxy. This is only safe while the app is NOT directly
    // reachable bypassing the proxy — that exposure must be prevented at
    // the network level (Railway internal service).
    process.env.TRUST_PROXY = "1";
    try {
      const ip = getClientIp(fakeReq({ "x-forwarded-for": "5.6.7.8" }));
      expect(ip).toBe("5.6.7.8");
    } finally {
      if (prev === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = prev;
    }
  });

  it("without TRUST_PROXY the header is ignored entirely", () => {
    delete process.env.TRUST_PROXY;
    try {
      const ip = getClientIp(fakeReq({ "x-forwarded-for": "1.2.3.4" }));
      expect(ip).toBe("9.9.9.9");
    } finally {
      if (prev !== undefined) process.env.TRUST_PROXY = prev;
    }
  });

  it("honors a multi-hop trusted chain", () => {
    process.env.TRUST_PROXY = "2";
    try {
      const ip = getClientIp(
        fakeReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 10.0.0.1" }),
      );
      expect(ip).toBe("5.6.7.8");
    } finally {
      if (prev === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = prev;
    }
  });
});

describe("account policy switches (1B.8)", () => {
  it("blocks linking an SSO identity into an unverified local account", () => {
    expect(shouldAllowEmailLinking({ emailVerified: false }, {})).toBe(false);
  });

  it("allows linking only with the explicit rollback flag", () => {
    expect(
      shouldAllowEmailLinking(
        { emailVerified: false },
        { SSO_ALLOW_EMAIL_LINKING: "1" },
      ),
    ).toBe(true);
  });

  it("never blocks sign-in to already-verified (SSO-created) accounts", () => {
    expect(shouldAllowEmailLinking({ emailVerified: true }, {})).toBe(true);
  });

  it("keeps the verification gate OFF by default in every environment", () => {
    // 2026-10-09 kararı: kodda doğrulama akışı yok ve hiçbir mevcut kullanıcı
    // doğrulanmış değil — varsayılan açık, dağıtımı kilitleyen ayak tabancasıydı.
    // Kapı 3.x'te akışla birlikte REQUIRE_VERIFIED_EMAIL=1 ile açılacak.
    expect(
      requiresVerifiedEmailForQuota({ NODE_ENV: "production" }),
    ).toBe(false);
    expect(requiresVerifiedEmailForQuota({ NODE_ENV: "test" })).toBe(false);
  });

  it("honors the explicit REQUIRE_VERIFIED_EMAIL override", () => {
    expect(
      requiresVerifiedEmailForQuota({
        NODE_ENV: "production",
        REQUIRE_VERIFIED_EMAIL: "1",
      }),
    ).toBe(true);
    expect(
      requiresVerifiedEmailForQuota({ REQUIRE_VERIFIED_EMAIL: "1" }),
    ).toBe(true);
  });
});

describe("email helper (1B.4 / SEC-08)", () => {
  it("throws in production when SMTP is missing and never logs mail content", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const smtpKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
    const saved = smtpKeys.map((k) => [k, process.env[k]] as const);
    smtpKeys.forEach((k) => delete process.env[k]);
    process.env.NODE_ENV = "production";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await expect(
        sendMail({ to: "user@example.com", subject: "s", text: "CODE-123456" }),
      ).rejects.toThrow(/SMTP is not configured/);
      expect(logSpy).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      saved.forEach(([k, v]) => {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      });
      logSpy.mockRestore();
    }
  });
});
