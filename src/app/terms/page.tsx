import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Hunt",
  description: "The terms that govern your use of Hunt.",
};

// TODO: replace with your legal entity name, support address, and governing law
// before submitting the OAuth consent screen for verification.
const COMPANY = "Hunt";
const CONTACT_EMAIL = "support@yourdomain.com";
const EFFECTIVE_DATE = "July 12, 2026";
const GOVERNING_LAW = "the laws of your jurisdiction";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-gray-400">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="space-y-2">
          <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            ← Back to Hunt
          </Link>
          <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
          <p className="text-sm text-gray-500">Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <p className="text-sm leading-relaxed text-gray-400">
          These Terms of Service (&ldquo;Terms&rdquo;) govern your use of {COMPANY} (the &ldquo;Service&rdquo;).
          By creating an account or using the Service, you agree to these Terms. If you do not agree, do not
          use the Service.
        </p>

        <Section title="1. What the Service does">
          <p>
            {COMPANY} helps you discover jobs, generate tailored cover letters and résumés, and send
            applications from your own connected email account. It also helps prefill fields for jobs that
            require applying on an external site.
          </p>
        </Section>

        <Section title="2. Your account">
          <p>
            You sign in with Google. You are responsible for your account and for keeping your login secure.
            You must provide accurate information and be at least the age of majority in your location.
          </p>
        </Section>

        <Section title="3. Acceptable use">
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Send spam, bulk unsolicited messages, or anything deceptive or fraudulent.</li>
            <li>Misrepresent your identity, experience, or qualifications in applications.</li>
            <li>Violate the terms of any job board, employer site, or third-party service you apply through.</li>
            <li>Break any applicable law or infringe anyone&rsquo;s rights.</li>
          </ul>
          <p>
            You are responsible for the applications you send and for reviewing content before it is sent.
            You control the volume and targeting of your applications.
          </p>
        </Section>

        <Section title="4. AI-generated content">
          <p>
            Cover letters and tailored résumés are generated with the help of AI and may contain errors or
            inaccuracies. You are responsible for reviewing all content for accuracy and truthfulness before
            sending. The Service does not guarantee any job, interview, or response.
          </p>
        </Section>

        <Section title="5. Email sending">
          <p>
            When you approve or enable sending, the Service sends emails from your connected mailbox on your
            behalf. You are responsible for complying with your email provider&rsquo;s policies and any
            anti-spam laws. Excessive sending may be limited by your email provider.
          </p>
        </Section>

        <Section title="6. Your content">
          <p>
            You retain ownership of your résumé and the content you provide. You grant us a limited license to
            process it solely to operate the Service for you (for example, to generate cover letters and send
            applications). See our{" "}
            <Link href="/privacy" className="text-blue-400 hover:text-blue-300 underline">Privacy Policy</Link>{" "}
            for how we handle data.
          </p>
        </Section>

        <Section title="7. Third-party services">
          <p>
            The Service integrates with third parties (e.g. Google, AI providers, job boards). Your use of
            those services is subject to their own terms, and we are not responsible for them.
          </p>
        </Section>

        <Section title="8. Disclaimers">
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any
            kind, express or implied. We do not warrant that the Service will be uninterrupted, error-free, or
            that it will result in any employment outcome.
          </p>
        </Section>

        <Section title="9. Limitation of liability">
          <p>
            To the maximum extent permitted by law, {COMPANY} will not be liable for any indirect, incidental,
            special, consequential, or punitive damages, or any loss of data, opportunities, or profits arising
            from your use of the Service.
          </p>
        </Section>

        <Section title="10. Termination">
          <p>
            You may stop using the Service and delete your account at any time. We may suspend or terminate
            access if you violate these Terms or misuse the Service.
          </p>
        </Section>

        <Section title="11. Changes to these Terms">
          <p>
            We may update these Terms from time to time. Material changes will be reflected by updating the
            effective date above. Continued use after changes means you accept the updated Terms.
          </p>
        </Section>

        <Section title="12. Governing law">
          <p>These Terms are governed by {GOVERNING_LAW}.</p>
        </Section>

        <Section title="13. Contact">
          <p>
            Questions about these Terms? Email us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-400 hover:text-blue-300 underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <div className="pt-4 border-t border-gray-800 text-sm text-gray-600">
          <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </main>
  );
}
