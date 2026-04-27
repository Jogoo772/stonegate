import { motion } from "framer-motion";
import { LineChart, BarChart3, Zap, Shield, Globe, Clock } from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Lightning-Fast Execution",
    description: "Our matching engine processes millions of orders per second with microsecond latency."
  },
  {
    icon: LineChart,
    title: "Advanced Trading Charts",
    description: "Professional-grade charting with dozens of indicators, drawing tools, and multi-timeframe analysis."
  },
  {
    icon: Shield,
    title: "Enterprise-Grade Security",
    description: "Bank-level security protocols, cold storage, and comprehensive asset protection."
  },
  {
    icon: Clock,
    title: "24/7 Market Monitoring",
    description: "Automated alerts and round-the-clock monitoring tools keep you ahead of the market."
  },
  {
    icon: BarChart3,
    title: "Deep Liquidity",
    description: "Tight spreads and massive order book depth ensure you get the best price on every trade."
  },
  {
    icon: Globe,
    title: "Global Reach",
    description: "Trade over 100+ pairs with seamless fiat on-ramps from anywhere in the world."
  }
];

export function Features() {
  return (
    <section className="py-24 bg-[#020202] relative" id="platform">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Built for Performance</h2>
          <p className="text-muted-foreground text-lg">Everything you need to execute your strategy with precision and confidence.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
