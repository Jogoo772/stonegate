import { Link } from "wouter";
import { Show, useUser, useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard } from "lucide-react";

export function Navbar() {
  const { user } = useUser();
  const { signOut } = useClerk();

  const initials = user
    ? (
        (user.firstName?.[0] ?? "") +
        (user.lastName?.[0] ?? user.username?.[0] ?? "")
      )
        .toUpperCase()
        .slice(0, 2) || "T"
    : "T";

  return (
    <header className="fixed top-0 w-full z-50 glass border-b border-border/40">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center text-primary-foreground font-black text-xl">
            H
          </div>
          <span className="font-bold text-xl tracking-tight">
            HedgeGate<span className="text-primary">.</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <a
            href="#markets"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Markets
          </a>
          <a
            href="#platform"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Platform
          </a>
          <a
            href="#about"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            About
          </a>
          <a
            href="#support"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Support
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Sign In
            </Link>
            <Link href="/sign-up">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-[0_0_15px_rgba(255,179,0,0.3)]">
                Create Free Account
              </Button>
            </Link>
          </Show>
          <Show when="signed-in">
            <Link href="/dashboard">
              <Button
                variant="outline"
                size="sm"
                className="border-white/15 hover:bg-white/5 hidden sm:inline-flex"
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <div className="hidden md:flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                {initials}
              </div>
              <span className="text-sm font-medium text-foreground/90 max-w-[140px] truncate">
                {user?.primaryEmailAddress?.emailAddress ??
                  user?.username ??
                  "Trader"}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ redirectUrl: "/" })}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </Show>
        </div>
      </div>
    </header>
  );
}
