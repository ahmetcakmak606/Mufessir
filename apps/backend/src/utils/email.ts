import nodemailer from "nodemailer";

export interface MailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendMail(options: MailOptions): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || "no-reply@mufessir.local";

  if (!host || !port || !user || !pass) {
    // Fallback to console for local/dev
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


