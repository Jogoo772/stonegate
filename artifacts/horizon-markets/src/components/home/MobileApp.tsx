import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function MobileApp() {
  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex-1 lg:pr-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              The entire market <br />
              <span className="text-primary">in your pocket.</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Don't miss a beat. Trade, monitor, and manage your portfolio with our highly responsive mobile app. Featuring the same advanced tools as our desktop platform, optimized for trading on the go.
            </p>
            <ul className="space-y-4 mb-10">
              <li className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">✓</div>
                <span>Real-time push notifications</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">✓</div>
                <span>One-tap order execution</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">✓</div>
                <span>Biometric security</span>
              </li>
            </ul>
            <div className="flex gap-4">
              <Button size="lg" className="bg-white text-black hover:bg-white/90 font-semibold h-14 px-8">
                Download for iOS
              </Button>
              <Button size="lg" variant="outline" className="border-white/20 hover:bg-white/5 font-semibold h-14 px-8">
                Download for Android
              </Button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex-1 flex justify-center lg:justify-end"
          >
            <div className="relative max-w-[350px]">
              <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full"></div>
              <img 
                src="/images/app-mockup.png" 
                alt="Horizon Mobile App" 
                className="relative z-10 w-full h-auto drop-shadow-2xl"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
