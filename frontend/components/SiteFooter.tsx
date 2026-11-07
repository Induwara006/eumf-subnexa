import Link from "next/link";

const API = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL || (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")).replace(/\/$/, "");

type FooterLink = { label: string; href: string; badge?: string };
type FooterColumn = { title: string; links: FooterLink[] };

const columns: FooterColumn[] = [
  {
    title: "Products",
    links: [
      { label: "Studio", href: "/#sn-platform" },
      { label: "Library", href: "/library" },
      { label: "Guide", href: "/guide" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "How it works", href: "/#sn-features" },
      { label: "Glossary", href: "/#sn-features" },
      { label: "Sign in", href: `${API}/subnexa-auth/login` },
      { label: "Fair use", href: "/guide" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Vision", href: "#" },
      { label: "Careers", href: "#", badge: "HIRING" },
      { label: "Privacy policy", href: "#" },
      { label: "Contact Us", href: "#" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="bg-background py-12 text-ink md:py-16">
      <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
        <div className="grid grid-cols-1 gap-8 md:gap-16 lg:grid-cols-6">
          <div className="space-y-6 lg:col-span-3">
            <Link href="/" className="inline-flex items-center" aria-label="SubNexa home">
              <img src="/SubNexa_Logo_Transparent.png" alt="SubNexa" className="h-7 w-auto" />
            </Link>
            <p className="text-sm text-body md:text-base">Join our newsletter for regular updates.</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <input
                type="email"
                placeholder="example@email.com"
                className="w-full rounded-md border border-border bg-white/[0.03] px-3 py-3 text-ink placeholder:text-sm placeholder:font-light placeholder:text-content-tertiary focus:outline-none focus:ring-1 focus:ring-primary sm:max-w-xs sm:flex-1"
              />
              <button className="rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                Subscribe
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 items-start gap-8 md:grid-cols-3 md:gap-12 lg:col-span-3 lg:gap-28">
            {columns.map((column) => (
              <div key={column.title} className={column.title === "Company" ? "col-span-2 md:col-span-1" : undefined}>
                <h3 className="mb-4 text-sm font-medium text-ink md:mb-6">{column.title}</h3>
                <ul className="space-y-3 text-sm text-body md:space-y-4">
                  {column.links.map((link) => (
                    <li key={link.label} className="flex items-center gap-2">
                      {link.href.startsWith("http") ? (
                        <a href={link.href} className="hover:text-ink">{link.label}</a>
                      ) : (
                        <Link href={link.href} className="hover:text-ink">{link.label}</Link>
                      )}
                      {link.badge ? (
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{link.badge}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-border pt-6 md:mt-16 md:flex-row">
          <p className="order-2 text-xs text-content-tertiary sm:text-sm md:order-1">© {new Date().getFullYear()} SubNexa. All rights reserved.</p>
          <div className="order-1 flex gap-5 md:order-2 md:gap-6">
            <a href="#" aria-label="X" className="text-body transition-colors hover:text-ink">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
              </svg>
            </a>
            <a href="#" aria-label="GitHub" className="text-body transition-colors hover:text-ink">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
            </a>
            <a href="#" aria-label="LinkedIn" className="text-body transition-colors hover:text-ink">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect width="4" height="12" x="2" y="9" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>
            <a href="#" aria-label="YouTube" className="text-body transition-colors hover:text-ink">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
                <path d="m10 15 5-3-5-3z" />
              </svg>
            </a>
            <a href="#" aria-label="Instagram" className="text-body transition-colors hover:text-ink">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
