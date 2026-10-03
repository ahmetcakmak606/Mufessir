import nodemailer from "nodemailer";

export interface MailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendMail(options: MailOptions): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT
    ? Number(process.env.SMTP_PORT)
    : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || "no-reply@mufessir.local";

  if (!host || !port || !user || !pass) {
    // Plan 1B.4 (SEC-08): a production misconfiguration must fail loudly —
    // never log email content (which includes password reset codes) to the
    // console. The [DEV EMAIL] fallback stays development-only.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SMTP is not configured: email delivery is disabled and mail content is never logged in production",
      );
    }
    console.log("[DEV EMAIL] →", {
      from,
      ...options,
    });
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({ from, ...options });
}
