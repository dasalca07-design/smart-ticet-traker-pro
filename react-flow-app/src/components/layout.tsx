import { Link, useLocation } from "wouter";
import { TrendingUp, Home, List, PieChart, BarChart2 } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/expenses", label: "Journal", icon: List },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/categories", label: "Categories", icon: PieChart },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="h-dvh flex overflow-hidden bg-background">
      {/* ── Sidebar (desktop only) ── */}
      <aside className="hidden md:flex w-56 flex-shrink-0 border-r border-border bg-sidebar flex-col">
        <div className="p-5 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-primary-foreground">
            <TrendingUp className="w-4 h-4" />
          </div>
          <span className="font-serif font-bold text-lg text-foreground tracking-tight">Ledger</span>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          <p className="mb-2 mt-1 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Finance
          </p>
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all ${
                  active
                    ? "bg-primary/15 text-primary font-semibold border border-primary/20"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                }`}
                data-testid={`nav-${label.toLowerCase()}`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-primary" : ""}`} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2 px-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] text-muted-foreground font-medium">Live data</span>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 h-12 border-b border-border bg-sidebar flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <span className="font-serif font-bold text-base text-foreground">Ledger</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] text-muted-foreground">Live</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="h-full max-w-5xl mx-auto px-4 py-4 md:px-8 md:py-8">
            {children}
          </div>
        </main>

        {/* ── Bottom nav (mobile only) ── */}
        <nav className="md:hidden flex-shrink-0 flex border-t border-border bg-sidebar">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
                data-testid={`bottom-nav-${label.toLowerCase()}`}
              >
                <Icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : "stroke-[1.5]"}`} />
                <span className="text-[9px] font-semibold tracking-wide">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
