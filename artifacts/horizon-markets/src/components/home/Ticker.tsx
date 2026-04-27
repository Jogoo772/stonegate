import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const COINS = [
  { symbol: "BTC", price: 64230.50, change: 2.4 },
  { symbol: "ETH", price: 3450.20, change: 1.8 },
  { symbol: "BNB", price: 580.40, change: -0.5 },
  { symbol: "SOL", price: 145.20, change: 5.2 },
  { symbol: "XRP", price: 0.58, change: -1.2 },
  { symbol: "DOGE", price: 0.12, change: 8.4 },
  { symbol: "ADA", price: 0.45, change: 0.2 },
  { symbol: "AVAX", price: 35.60, change: 3.1 },
  { symbol: "LINK", price: 18.90, change: -2.1 },
  { symbol: "DOT", price: 7.20, change: 1.5 },
];

export function Ticker() {
  const [tick, setTick] = useState(0);

  // Subtle ticking effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-[#050505] border-y border-white/5 py-2 overflow-hidden flex relative z-20">
      <div className="flex animate-marquee whitespace-nowrap min-w-max">
        {[...COINS, ...COINS, ...COINS].map((coin, i) => {
          const isUp = coin.change >= 0;
          // Random slight fluctuation for the effect
          const fluctuation = (Math.random() - 0.5) * (coin.price * 0.0001);
          const currentPrice = coin.price + fluctuation;
          
          return (
            <div key={`${coin.symbol}-${i}`} className="flex items-center gap-3 px-6 border-r border-white/5">
              <span className="font-mono text-sm font-bold text-foreground/80">{coin.symbol}</span>
              <span className="font-mono text-sm">
                ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </span>
              <span className={`font-mono text-xs font-medium ${isUp ? 'text-primary' : 'text-destructive'}`}>
                {isUp ? '+' : ''}{coin.change}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
