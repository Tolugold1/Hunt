import { google } from "googleapis";
import nodemailer from "nodemailer";
import type { Mailbox } from "@prisma/client";

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

export async function sendJobApplicationEmail({
  mailbox,
  to,
  subject,
  body,
  applicantName,
  resumeBuffer,
  resumeFilename,
}: {
  mailbox: Mailbox;
  to: string;
  subject: string;
  body: string;
  applicantName: string;
  resumeBuffer: Buffer;
  resumeFilename: string;
}) {
  const auth = getOAuth2ClientForMailbox(mailbox);

  // Refresh token if close to expiry
  if (mailbox.expiresAt && mailbox.expiresAt.getTime() < Date.now() + 60_000) {
    const { credentials } = await auth.refreshAccessToken();
    auth.setCredentials(credentials);
  }

  const accessToken = (await auth.getAccessToken()).token;

  const transporter = nodemailer.createTransport({
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

  const fullBody = `${body}

--
${applicantName}`;

  const info = await transporter.sendMail({
    from: `"${applicantName}" <${mailbox.email}>`,
    to,
    subject,
    text: fullBody,
    attachments: [
      {
        filename: resumeFilename,
        content: resumeBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return { messageId: info.messageId };
}

export async function getGmailProfile(mailbox: Mailbox) {
  const auth = getOAuth2ClientForMailbox(mailbox);
  const gmail = google.gmail({ version: "v1", auth });
  const profile = await gmail.users.getProfile({ userId: "me" });
  return profile.data;
}
