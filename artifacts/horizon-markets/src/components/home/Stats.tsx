import { motion } from "framer-motion";

const STATS = [
  { label: "Active Traders", value: "50,000+" },
  { label: "24h Trading Volume", value: "$2.5B+" },
  { label: "Trading Pairs", value: "100+" },
  { label: "System Uptime", value: "99.99%" },
];

export function Stats() {
  return (
    <section className="py-16 border-y border-white/5 bg-[#020202]">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-white/5">
          {STATS.map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center px-4"
            >
              <div className="text-3xl md:text-5xl font-black text-gold-gradient mb-2 font-mono">
                {stat.value}
              </div>
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
