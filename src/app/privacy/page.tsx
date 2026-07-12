import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Hunt",
  description: "How Hunt collects, uses, and protects your data.",
};

// TODO: replace with your legal entity name and support address before submitting
// the OAuth consent screen for verification.
const COMPANY = "Hunt";
const CONTACT_EMAIL = "support@yourdomain.com";
const EFFECTIVE_DATE = "July 12, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-gray-400">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="space-y-2">
          <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            ← Back to Hunt
          </Link>
          <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
          <p className="text-sm text-gray-500">Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <p className="text-sm leading-relaxed text-gray-400">
          {COMPANY} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) helps you find jobs, draft tailored cover letters
          and résumés, and send applications from your own email account. This policy explains what data we
          collect, how we use it, and the choices you have. By using {COMPANY}, you agree to this policy.
        </p>

        <Section title="Information we collect">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <span className="text-gray-300">Google account information.</span> When you sign in with Google,
              we receive your name, email address, and profile picture to create and identify your account.
            </li>
            <li>
              <span className="text-gray-300">Gmail access.</span> With your permission, we request the Gmail
              scopes below so the app can send your applications from your own address and track replies.
            </li>
            <li>
              <span className="text-gray-300">Résumé and profile data.</span> The résumé you upload and the
              details extracted from it (skills, experience, contact links, salary preferences).
            </li>
            <li>
              <span className="text-gray-300">Application data.</span> The jobs discovered for you, generated
              cover letters and tailored résumés, and the status of each application.
            </li>
          </ul>
        </Section>

        <Section title="Google user data & the scopes we request">
          <p>We only request the minimum scopes needed to provide the service:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <code className="text-gray-300">.../auth/userinfo.email</code>,{" "}
              <code className="text-gray-300">.../auth/userinfo.profile</code>, <code className="text-gray-300">openid</code> —
              to create your account and identify you.
            </li>
            <li>
              <code className="text-gray-300">.../auth/gmail.send</code> — to send job applications from your
              mailbox, only when you approve an application.
            </li>
            <li>
              <code className="text-gray-300">.../auth/gmail.readonly</code> — to detect replies to the
              applications you sent so we can update their status. We do not read unrelated messages.
            </li>
          </ul>
        </Section>

        <Section title="How we use your data">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>To generate cover letters and job-tailored résumés from your résumé and the job posting.</li>
            <li>To send applications from your connected mailbox, only for applications you approve or enable.</li>
            <li>To match jobs to your profile and track application outcomes.</li>
            <li>To operate, secure, and improve the service.</li>
          </ul>
          <p>We do not sell your personal data, and we do not use your Gmail content for advertising.</p>
        </Section>

        <Section title="Limited Use disclosure (Google API Services)">
          <p className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-gray-300">
            {COMPANY}&rsquo;s use and transfer of information received from Google APIs to any other app will
            adhere to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. We use Google user data only to provide and improve the
            user-facing features described here, do not transfer it except as necessary to provide those
            features or as required by law, do not use it for advertising, and do not allow humans to read it
            unless we have your consent, it is necessary for security or to comply with the law, or the data is
            aggregated and anonymized.
          </p>
        </Section>

        <Section title="Third-party services we share data with">
          <p>To provide the service, limited data is processed by:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <span className="text-gray-300">AI providers</span> (e.g. OpenAI, Anthropic, Google) — your
              résumé text and the job description are sent to generate cover letters and tailored résumés.
            </li>
            <li>
              <span className="text-gray-300">Cloudinary</span> — stores your uploaded résumé file.
            </li>
            <li>
              <span className="text-gray-300">Supabase / Vercel</span> — database and hosting.
            </li>
          </ul>
          <p>These providers process data only to perform services for us, under their own privacy terms.</p>
        </Section>

        <Section title="Data storage & security">
          <p>
            Your Google OAuth tokens are encrypted at rest. Data is stored on managed infrastructure with
            access controls. No method of transmission or storage is 100% secure, but we take reasonable
            measures to protect your data.
          </p>
        </Section>

        <Section title="Data retention & deletion">
          <p>
            We keep your data while your account is active. You can delete your résumé, applications, or your
            entire account at any time, which removes the associated data and revokes stored mailbox tokens.
            You can also revoke {COMPANY}&rsquo;s access from your{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Google Account permissions
            </a>
            . To request deletion, contact us at {CONTACT_EMAIL}.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Depending on where you live, you may have rights to access, correct, export, or delete your
            personal data. Contact us to exercise them.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We may update this policy from time to time. Material changes will be reflected by updating the
            effective date above.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy? Email us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-400 hover:text-blue-300 underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <div className="pt-4 border-t border-gray-800 text-sm text-gray-600">
          <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
        </div>
      </div>
    </main>
  );
}
