import { motion } from "framer-motion";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";

const generateSparkline = (points: number, start: number, trend: 'up' | 'down') => {
  let current = start;
  return Array.from({ length: points }).map((_, i) => {
    current += (Math.random() - (trend === 'up' ? 0.3 : 0.7)) * (start * 0.02);
    return { value: current };
  });
};

const MARKETS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 64230.50, change: 2.4, trend: 'up' as const },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3450.20, change: 1.8, trend: 'up' as const },
  { id: "solana", symbol: "SOL", name: "Solana", price: 145.20, change: 5.2, trend: 'up' as const },
  { id: "binance-coin", symbol: "BNB", name: "BNB", price: 580.40, change: -0.5, trend: 'down' as const },
];

export function MarketOverview() {
  const [data, setData] = useState(MARKETS.map(m => ({ ...m, sparkline: generateSparkline(20, m.price, m.trend) })));

  // Simulate live ticks
  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => prev.map(m => {
        const fluctuation = (Math.random() - 0.5) * (m.price * 0.001);
        return {
          ...m,
          price: m.price + fluctuation,
        };
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-20 bg-background relative" id="markets">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-2">Live Markets</h2>
            <p className="text-muted-foreground">Real-time prices and 24h performance</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {data.map((market, index) => {
            const isUp = market.change >= 0;
            return (
              <motion.div
                key={market.symbol}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="glass-card rounded-xl p-6 relative overflow-hidden group hover:border-primary/30 transition-colors"
              >
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <img 
                      src={`https://assets.coincap.io/assets/icons/${market.symbol.toLowerCase()}@2x.png`} 
                      alt={market.name}
                      className="w-10 h-10 rounded-full bg-black/50"
                      onError={(e) => (e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMzMzMiLz48L3N2Zz4=')}
                    />
                    <div>
                      <h3 className="font-bold">{market.symbol}</h3>
                      <p className="text-xs text-muted-foreground">{market.name}</p>
                    </div>
                  </div>
                </div>
                
                <div className="relative z-10">
                  <div className="text-2xl font-mono font-bold tracking-tight mb-1">
                    ${market.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className={`text-sm font-medium flex items-center gap-1 ${isUp ? 'text-primary' : 'text-destructive'}`}>
                    {isUp ? '+' : ''}{market.change}%
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 w-full h-24 opacity-30 group-hover:opacity-60 transition-opacity">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={market.sparkline}>
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={isUp ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} 
                        strokeWidth={2} 
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
