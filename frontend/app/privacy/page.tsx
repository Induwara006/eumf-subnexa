import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | SubNexa",
  description: "How SubNexa handles account information, subtitle files, and translation data.",
};

const sections = [
  {
    title: "Information we handle",
    paragraphs: [
      "When you sign in with Google, SubNexa receives your Google account name, email address, and Google account identifier to verify your identity and maintain your session. SubNexa does not receive your Google password.",
      "When you use the subtitle studio, the subtitle file and text, translation output, chosen options, and glossary terms you provide are processed to deliver the service. Translation progress may be saved on the backend so a job can resume. The current service does not automatically delete saved translation progress on a published schedule.",
      "If you use account or administrator features, SubNexa may process information needed to authenticate you and provide those features. Hosting and infrastructure providers may also process technical information such as IP address, request time, and error logs to operate and protect the service.",
    ],
  },
  {
    title: "How we use information",
    paragraphs: [
      "We use information to sign you in, provide subtitle translation and library features, save and resume translation progress, send sign-in confirmation emails when configured, and maintain and protect SubNexa.",
      "We do not sell personal information or use subtitle content for advertising.",
    ],
  },
  {
    title: "Translation providers",
    paragraphs: [
      "Subtitle text and glossary content are sent to the AI provider configured for the service. Depending on the active configuration, that provider may be Google Gemini, Cloudflare Workers AI, or CodeCraft. Those providers process data under their own privacy policies and service terms.",
      "Google provides account sign-in and may provide Gemini translation. Resend sends a sign-in notice to your verified email address when email delivery is configured. SubNexa's hosting, database, and storage providers may process information to run the site and its features.",
    ],
  },
  {
    title: "Google sign-in and connected projects",
    paragraphs: [
      "A signed-in session is maintained using an HTTP-only cookie and normally expires after seven days. A short-lived cookie is used to protect the Google sign-in flow.",
      "If you choose to connect a Google Cloud project, SubNexa uses the permission you grant to create and store a Gemini API key for your account. The key is encrypted before it is stored by the backend. You are responsible for ensuring that you are authorized to connect the project and for any charges incurred through it.",
    ],
  },
  {
    title: "Storage and retention",
    paragraphs: [
      "Some interface preferences and glossary settings are stored in your browser's local storage. Authentication and administrator session cookies expire as described in the Cookie Policy.",
      "Translation progress and connected-project records may remain in backend storage while retained by the service operator. The retention period can depend on the backend hosting and storage configuration; there is currently no self-service deletion tool for these records.",
    ],
  },
  {
    title: "Your choices and requests",
    paragraphs: [
      "You can stop using SubNexa, sign out, or review and revoke SubNexa's Google access in your Google Account settings. Revoking access may prevent you from signing in or using connected Google Cloud features.",
      "You may request access to, correction of, or deletion of information associated with your account by emailing eunitymoviefamily@gmail.com, subject to applicable law and technical or legal retention requirements.",
    ],
  },
  {
    title: "Security and policy updates",
    paragraphs: [
      "We use safeguards such as server-side credential handling, HTTP-only session cookies, and encryption for connected API keys. No internet service can guarantee absolute security.",
      "This policy may be updated when SubNexa's features or data practices change. The latest version will be posted on this page with its effective date.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground sm:px-8 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-body transition-colors hover:text-ink">
          ← Back to SubNexa
        </Link>
        <header className="mt-10 border-b border-border pb-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-alarmalade">
            subnexa.lk
          </p>
          <h1 className="mt-3 text-4xl tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="mt-4 text-sm text-content-tertiary">
            Effective date: November 5, 2026
          </p>
          <p className="mt-5 text-base leading-7 text-body">
            This policy explains how SubNexa handles information when you visit
            the website, sign in, or use its subtitle and library features.
          </p>
        </header>

        <div className="divide-y divide-border">
          {sections.map((section) => (
            <section key={section.title} className="py-7">
              <h2 className="text-xl font-medium tracking-tight text-ink">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-body">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border py-6 text-sm text-body">
          <Link href="/cookies" className="transition-colors hover:text-ink">
            Cookie Policy
          </Link>
          <Link href="/" className="transition-colors hover:text-ink">
            SubNexa home
          </Link>
        </footer>
      </article>
    </main>
  );
}
