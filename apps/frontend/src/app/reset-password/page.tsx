"use client";
import { useState } from "react";
import type React from "react";
import { authApi } from "@/lib/auth";

export default function ResetPasswordPage() {
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await authApi.requestPasswordReset(email);
      setMessage("If the email exists, a reset code has been sent.");
      setStep("confirm");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Failed to request reset");
    } finally {
      setLoading(false);
    }
  };

  const onConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (newPassword !== newPassword2) throw new Error("Passwords do not match");
      await authApi.confirmPasswordReset(email, code, newPassword);
      setMessage("Password updated. You can now log in.");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Reset Password</h1>
      {message && <p className="mb-3 text-sm">{message}</p>}

      {step === "request" && (
        <form onSubmit={onRequest} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border px-3 py-2"
            required
          />
          <button disabled={loading} className="w-full bg-black text-white py-2">
            {loading ? "Sending..." : "Send Reset Code"}
          </button>
        </form>
      )}

      {step === "confirm" && (
        <form onSubmit={onConfirm} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border px-3 py-2"
            required
          />
          <input
            type="text"
            placeholder="Reset code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full border px-3 py-2"
            required
          />
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border px-3 py-2"
            required
          />
          <input
            type="password"
            placeholder="Repeat new password"
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
            className="w-full border px-3 py-2"
            required
          />
          <button disabled={loading} className="w-full bg-black text-white py-2">
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      )}
    </div>
  );
}


