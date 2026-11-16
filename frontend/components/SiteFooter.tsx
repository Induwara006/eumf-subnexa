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
      { label: "How it works", href: "/guide" },
      { label: "Glossary", href: "/#sn-features" },
      { label: "Sign in", href: `${API}/subnexa-auth/login` },
      { label: "Fair use", href: "/guide" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "About", href: "/#sn-platform" },
      { label: "Vision", href: "/#sn-features" },
      { label: "Careers", href: "mailto:eunitymoviefamily@gmail.com?subject=Careers%20at%20SubNexa", badge: "HIRING" },
      { label: "Privacy policy", href: "/privacy" },
      { label: "Cookie policy", href: "/cookies" },
      { label: "Contact Us", href: "mailto:eunitymoviefamily@gmail.com?subject=SubNexa%20inquiry" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="scroll-edge-top bg-background py-14 text-ink md:py-20">
      <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
        <div className="grid grid-cols-1 gap-8 md:gap-16 lg:grid-cols-6">
          <div className="space-y-6 lg:col-span-3">
            <Link href="/" className="inline-flex items-center" aria-label="SubNexa home">
              <img src="/SubNexa_Logo_Transparent.png" alt="SubNexa" className="h-7 w-auto" />
            </Link>
            <p className="text-sm text-body md:text-base">Ready to translate your first subtitle?</p>
            <Link href="/guide" className="inline-flex rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              Explore the guide
            </Link>
          </div>

          <div className="grid grid-cols-2 items-start gap-8 md:grid-cols-3 md:gap-12 lg:col-span-3 lg:gap-28">
            {columns.map((column) => (
              <div key={column.title} className={column.title === "Legal" ? "col-span-2 md:col-span-1" : undefined}>
                <h3 className="mb-4 text-sm font-semibold tracking-[-0.01em] text-ink md:mb-6">{column.title}</h3>
                <ul className="space-y-3 text-sm text-body md:space-y-4">
                  {column.links.map((link) => (
                    <li key={link.label} className="flex items-center gap-2">
                      {link.href.startsWith("/") ? (
                        <Link href={link.href} className="hover:text-ink">{link.label}</Link>
                      ) : (
                        <a href={link.href} className="hover:text-ink">{link.label}</a>
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
        </div>
      </div>
    </footer>
  );
}
