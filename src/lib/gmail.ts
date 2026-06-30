import { google } from "googleapis";
import nodemailer from "nodemailer";
import type { Mailbox } from "@prisma/client";

// ─── OAuth2 helpers ───────────────────────────────────────────────────────────

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
    `${process.env.AUTH_URL}/api/auth/callback/google`
  );
}

function getOAuth2ClientForMailbox(mailbox: Mailbox) {
  const client = createOAuth2Client();
  client.setCredentials({
    access_token: mailbox.accessToken,
    refresh_token: mailbox.refreshToken ?? undefined,
    expiry_date: mailbox.expiresAt?.getTime(),
  });
  return client;
}

// ─── Transporter factory ──────────────────────────────────────────────────────

async function createTransporter(mailbox: Mailbox) {
  if (mailbox.provider === "gmail-smtp") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      family: 4,
      auth: { user: mailbox.email, pass: mailbox.accessToken },
    } as any);
  }

  if (mailbox.provider === "smtp") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return nodemailer.createTransport({
      host: mailbox.smtpHost ?? "smtp.gmail.com",
      port: mailbox.smtpPort ?? 587,
      secure: (mailbox.smtpPort ?? 587) === 465,
      family: 4,
      auth: { user: mailbox.email, pass: mailbox.accessToken },
    } as any);
  }

  // gmail-oauth (default)
  const auth = getOAuth2ClientForMailbox(mailbox);
  if (mailbox.expiresAt && mailbox.expiresAt.getTime() < Date.now() + 60_000) {
    const { credentials } = await auth.refreshAccessToken();
    auth.setCredentials(credentials);
  }
  const accessToken = (await auth.getAccessToken()).token;

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: mailbox.email,
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      refreshToken: mailbox.refreshToken ?? undefined,
      accessToken: accessToken ?? undefined,
    },
  });
}

// ─── Build the plain-text signature block ─────────────────────────────────────

interface ContactInfo {
  name: string;
  location?: string | null;
  phone?: string | null;
  email: string;
  linkedInUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
}

function buildSignature(contact: ContactInfo): string {
  const lines: string[] = [contact.name];
  if (contact.location) lines.push(contact.location);
  if (contact.phone) lines.push(contact.phone);
  lines.push(contact.email);
  if (contact.linkedInUrl) lines.push(`LinkedIn: ${contact.linkedInUrl}`);
  if (contact.githubUrl) lines.push(`GitHub: ${contact.githubUrl}`);
  if (contact.portfolioUrl) lines.push(`Portfolio: ${contact.portfolioUrl}`);
  return lines.join("\n");
}

// ─── Send email ───────────────────────────────────────────────────────────────

export async function sendJobApplicationEmail({
  mailbox,
  to,
  subject,
  body,
  contact,
  resumeBuffer,
  resumeFilename,
}: {
  mailbox: Mailbox;
  to: string;
  subject: string;
  body: string;
  contact: ContactInfo;
  resumeBuffer: Buffer;
  resumeFilename: string;
}) {
  const transporter = await createTransporter(mailbox);

  // Append full contact signature after the letter body
  const signature = buildSignature(contact);
  const fullBody = body.trimEnd().endsWith(`Kind regards,\n\n${contact.name}`)
    ? `${body}\n${contact.location ?? ""}\n${contact.phone ?? ""}\n${contact.email}${contact.linkedInUrl ? `\nLinkedIn: ${contact.linkedInUrl}` : ""}${contact.githubUrl ? `\nGitHub: ${contact.githubUrl}` : ""}${contact.portfolioUrl ? `\nPortfolio: ${contact.portfolioUrl}` : ""}`
    : `${body}\n\n${signature}`;

  const info = await transporter.sendMail({
    from: `"${contact.name}" <${mailbox.email}>`,
    to,
    subject,
    text: fullBody,
    attachments: resumeBuffer.length
      ? [{ filename: resumeFilename, content: resumeBuffer, contentType: "application/pdf" }]
      : [],
  });

  return { messageId: info.messageId };
}

export async function getGmailProfile(mailbox: Mailbox) {
  const auth = getOAuth2ClientForMailbox(mailbox);
  const gmail = google.gmail({ version: "v1", auth });
  const profile = await gmail.users.getProfile({ userId: "me" });
  return profile.data;
}
