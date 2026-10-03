// Shared server-side input policy for auth endpoints (plan 1B.5).
// Frontend restrictions do not constrain direct API calls; the same rules
// apply to register and password reset. bcrypt hashes at most 72 input
// bytes and SILENTLY truncates beyond that — the policy rejects instead.

export class InputPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputPolicyError";
  }
}

export interface StringOptions {
  min?: number;
  max?: number;
  /** Trim surrounding whitespace (default true). Disable for passwords. */
  trim?: boolean;
}

export function requireString(
  field: string,
  value: unknown,
  options: StringOptions = {},
): string {
  const { min = 1, max = 1000, trim = true } = options;
  if (typeof value !== "string") {
    throw new InputPolicyError(`${field} must be a string`);
  }
  const normalized = trim ? value.trim() : value;
  if (normalized.length < min) {
    throw new InputPolicyError(
      min === 1
        ? `${field} is required`
        : `${field} must be at least ${min} characters`,
    );
  }
  if (normalized.length > max) {
    throw new InputPolicyError(`${field} must be at most ${max} characters`);
  }
  return normalized;
}

export function requireEmail(value: unknown): string {
  const email = requireString("email", value, { min: 3, max: 254 });
  // One local part, one @, a dot inside the domain. Deliberately simple:
  // the goal is rejecting junk and non-emails, not RFC completeness.
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) {
    throw new InputPolicyError("email must be a valid email address");
  }
  const domain = email.slice(at + 1);
  if (!/^[A-Za-z0-9.-]+$/.test(domain) || !domain.includes(".")) {
    throw new InputPolicyError("email must be a valid email address");
  }
  return email.toLowerCase();
}

export const PASSWORD_MIN_LENGTH = 10;
// bcryptjs truncates input beyond 72 bytes without erroring.
const BCRYPT_MAX_BYTES = 72;

export function requirePassword(value: unknown): string {
  const password = requireString("password", value, {
    min: PASSWORD_MIN_LENGTH,
    max: 200,
    trim: false,
  });
  const bytes = Buffer.byteLength(password, "utf8");
  if (bytes > BCRYPT_MAX_BYTES) {
    throw new InputPolicyError(
      `password must be at most ${BCRYPT_MAX_BYTES} bytes (bcrypt input limit)`,
    );
  }
  return password;
}

export function requireResetCode(value: unknown): string {
  const code = requireString("code", value, { min: 6, max: 6, trim: false });
  if (!/^\d{6}$/.test(code)) {
    throw new InputPolicyError("code must be 6 digits");
  }
  return code;
}
