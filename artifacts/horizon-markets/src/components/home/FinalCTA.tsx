import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function FinalCTA() {
  return (
    <section className="py-32 relative overflow-hidden bg-background">
      <div className="absolute inset-0 z-0 opacity-20">
        <img 
          src="/images/blockchain-net.png" 
          alt="Network" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center glass-card p-12 rounded-3xl border border-primary/20 box-glow"
        >
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-6">
            Ready to Start Trading?
          </h2>
          <p className="text-xl text-muted-foreground mb-10">
            Join thousands of professional traders on Horizon Markets today. Setup takes less than 2 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto h-14 px-10 text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(0,255,136,0.4)]">
                Create Free Account
              </Button>
            </Link>
            <Link href="/sign-in" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-10 text-lg font-semibold border-white/20 hover:bg-white/5">
                Sign In
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
