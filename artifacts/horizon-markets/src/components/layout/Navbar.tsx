import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";

export function Navbar() {
  return (
    <header className="fixed top-0 w-full z-50 glass border-b border-border/40">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center text-primary-foreground font-black text-xl">
            H
          </div>
          <span className="font-bold text-xl tracking-tight">
            Horizon<span className="text-primary">.</span>
          </span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-8">
          <Link href="#markets" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Markets</Link>
          <Link href="#platform" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Platform</Link>
          <Link href="#about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">About</Link>
          <Link href="#support" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Support</Link>
        </nav>

        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
            Sign In
          </Link>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-[0_0_15px_rgba(0,255,136,0.3)]">
            Create Free Account
          </Button>
        </div>
      </div>
    </header>
  );
}
