import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Activity } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center pt-24 pb-12 overflow-hidden">
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/images/hero-bg.png" 
          alt="Crypto Trading Visualization" 
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,136,0.05)_0%,transparent_50%)]"></div>
        {/* Animated grid lines */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'linear-gradient(to bottom, transparent, black, transparent)'
        }}></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            Professional Grade Trading Engine Live
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tighter mb-6 text-glow"
          >
            Trade Crypto <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">Like a Pro.</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            Institutional-grade liquidity, microsecond execution, and advanced charting tools. 
            The market never sleeps, and neither does your edge.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(0,255,136,0.4)] group">
              Create Free Account
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg font-semibold border-white/10 hover:bg-white/5">
              Sign In
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
