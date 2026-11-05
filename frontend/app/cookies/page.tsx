import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie Policy | SubNexa",
  description: "The cookies and browser storage SubNexa uses and what they do.",
};

const cookies = [
  {
    name: "subnexa_session",
    purpose: "Keeps you signed in to SubNexa after Google verifies your account.",
    lifetime: "Up to 7 days",
    type: "Essential · HTTP-only",
  },
  {
    name: "subnexa_oauth_state",
    purpose: "Temporarily protects the Google sign-in and account-connection flow.",
    lifetime: "Up to 10 minutes; removed after the callback",
    type: "Essential · HTTP-only",
  },
  {
    name: "subnexa_admin_v3",
    purpose: "Maintains a verified administrator session for protected library tools.",
    lifetime: "Up to 15 minutes",
    type: "Essential · HTTP-only · scoped to /api/library",
  },
];

const storage = [
  {
    name: "subnexa-theme",
    purpose: "Remembers your light or dark theme preference.",
  },
  {
    name: "subnexa-glossary-groups-v2",
    purpose: "Remembers glossary groups and terms in your browser.",
  },
  {
    name: "subnexa-glossary-v1",
    purpose: "Legacy glossary settings that may be read to migrate older preferences.",
  },
  {
    name: "subnexa-background-dim",
    purpose: "Remembers the studio background dim setting.",
  },
];

export default function CookiePolicyPage() {
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
          <h1 className="mt-3 text-4xl tracking-tight sm:text-5xl">Cookie Policy</h1>
          <p className="mt-4 text-sm text-content-tertiary">
            Effective date: November 5, 2026
          </p>
          <p className="mt-5 text-base leading-7 text-body">
            This page describes the cookies and browser storage SubNexa uses
            for sign-in, security, and your saved preferences.
          </p>
        </header>

        <section className="border-b border-border py-7">
          <h2 className="text-xl font-medium tracking-tight text-ink">
            Cookies used by SubNexa
          </h2>
          <p className="mt-3 text-sm leading-7 text-body">
            These cookies support account sign-in and protected features. Their
            exact Secure and SameSite settings depend on the site deployment.
            The session and sign-in cookies are HTTP-only, which means page
            scripts cannot read them.
          </p>
          <div className="mt-5 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="bg-card text-xs uppercase tracking-wide text-content-tertiary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Cookie</th>
                  <th scope="col" className="px-4 py-3 font-medium">Purpose</th>
                  <th scope="col" className="px-4 py-3 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-body">
                {cookies.map((cookie) => (
                  <tr key={cookie.name} className="align-top">
                    <th scope="row" className="px-4 py-4 font-mono text-xs text-ink">
                      {cookie.name}
                      <span className="mt-1 block font-sans font-normal text-content-tertiary">
                        {cookie.type}
                      </span>
                    </th>
                    <td className="px-4 py-4 leading-6">{cookie.purpose}</td>
                    <td className="px-4 py-4 leading-6">{cookie.lifetime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border-b border-border py-7">
          <h2 className="text-xl font-medium tracking-tight text-ink">
            Browser local storage
          </h2>
          <p className="mt-3 text-sm leading-7 text-body">
            Local storage is separate from cookies and stays in this browser
            until you clear it. SubNexa uses it for these preferences:
          </p>
          <ul className="mt-4 space-y-3">
            {storage.map((item) => (
              <li key={item.name} className="text-sm leading-6 text-body">
                <code className="rounded bg-card px-1.5 py-0.5 text-xs text-ink">
                  {item.name}
                </code>{" "}
                — {item.purpose}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-b border-border py-7">
          <h2 className="text-xl font-medium tracking-tight text-ink">
            Analytics and third-party cookies
          </h2>
          <p className="mt-3 text-sm leading-7 text-body">
            SubNexa does not currently configure advertising or analytics
            cookies. When you continue to Google to sign in, Google may use its
            own cookies under Google&apos;s privacy and cookie policies. The
            browser may also receive necessary technical cookies from the
            hosting providers used to deliver the website.
          </p>
        </section>

        <section className="py-7">
          <h2 className="text-xl font-medium tracking-tight text-ink">
            Managing cookies
          </h2>
          <p className="mt-3 text-sm leading-7 text-body">
            You can review or delete cookies and local storage through your
            browser settings. Blocking essential cookies may prevent Google
            sign-in, account connections, or protected administrator features
            from working. Clearing local storage removes saved preferences and
            glossary settings from that browser.
          </p>
        </section>

        <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border py-6 text-sm text-body">
          <Link href="/privacy" className="transition-colors hover:text-ink">
            Privacy Policy
          </Link>
          <Link href="/" className="transition-colors hover:text-ink">
            SubNexa home
          </Link>
        </footer>
      </article>
    </main>
  );
}
