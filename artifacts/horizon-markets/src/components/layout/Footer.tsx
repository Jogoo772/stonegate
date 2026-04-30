import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-[#050505] border-t border-border/40 pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center text-primary-foreground font-black text-xl">
                H
              </div>
              <span className="font-bold text-xl tracking-tight">
                Stonegate<span className="text-primary">.</span>
              </span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              The professional's choice for cryptocurrency trading. Advanced execution, deep liquidity, and enterprise-grade security.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4 text-foreground">Platform</h4>
            <ul className="space-y-3">
              <li><Link href="#" className="text-muted-foreground hover:text-primary text-sm transition-colors">Spot Trading</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-primary text-sm transition-colors">Margin Trading</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-primary text-sm transition-colors">Derivatives</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-primary text-sm transition-colors">API Documentation</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-foreground">Support</h4>
            <ul className="space-y-3">
              <li><Link href="#" className="text-muted-foreground hover:text-primary text-sm transition-colors">Help Center</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-primary text-sm transition-colors">Fee Schedule</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-primary text-sm transition-colors">System Status</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-primary text-sm transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-foreground">Legal</h4>
            <ul className="space-y-3">
              <li><Link href="#" className="text-muted-foreground hover:text-primary text-sm transition-colors">Terms of Service</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-primary text-sm transition-colors">Privacy Policy</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-primary text-sm transition-colors">Risk Disclosure</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-primary text-sm transition-colors">Law Enforcement Requests</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 text-xs text-muted-foreground leading-relaxed space-y-4">
          <p>
            <strong className="text-foreground/80">Risk Warning:</strong> Trading cryptocurrencies involves significant risk and can result in the loss of your capital. You should not invest more than you can afford to lose and you should ensure that you fully understand the risks involved. Before trading, please take into consideration your level of experience, investment objectives, and seek independent financial advice if necessary.
          </p>
          <p>
            Stonegate operates through various entities globally. "Stonegate (SC) Ltd" is incorporated in the Seychelles. "Stonegate B.V." is registered in Curaçao. "Stonegate (VG) Ltd" is registered in the British Virgin Islands. Services are not intended for distribution to, or use by, any person in any country or jurisdiction where such distribution or use would be contrary to local law or regulation.
          </p>
          <p className="pt-4 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <span>&copy; {new Date().getFullYear()} Stonegate. All rights reserved.</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              All Systems Operational
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
