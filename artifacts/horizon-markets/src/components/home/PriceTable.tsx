import { motion } from "framer-motion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const ALL_COINS = [
  { symbol: "BTC", name: "Bitcoin", price: 64230.50, change: 2.4, high: 65100.20, low: 62800.00, vol: "42.5B" },
  { symbol: "ETH", name: "Ethereum", price: 3450.20, change: 1.8, high: 3520.00, low: 3380.50, vol: "18.2B" },
  { symbol: "BNB", name: "Binance Coin", price: 580.40, change: -0.5, high: 595.00, low: 570.20, vol: "2.1B" },
  { symbol: "SOL", name: "Solana", price: 145.20, change: 5.2, high: 148.50, low: 138.00, vol: "4.8B" },
  { symbol: "XRP", name: "Ripple", price: 0.58, change: -1.2, high: 0.61, low: 0.56, vol: "1.2B" },
  { symbol: "DOGE", name: "Dogecoin", price: 0.12, change: 8.4, high: 0.13, low: 0.11, vol: "900M" },
  { symbol: "ADA", name: "Cardano", price: 0.45, change: 0.2, high: 0.46, low: 0.44, vol: "450M" },
  { symbol: "AVAX", name: "Avalanche", price: 35.60, change: 3.1, high: 36.50, low: 34.00, vol: "600M" },
  { symbol: "DOT", name: "Polkadot", price: 7.20, change: 1.5, high: 7.40, low: 7.00, vol: "300M" },
  { symbol: "LINK", name: "Chainlink", price: 18.90, change: -2.1, high: 19.50, low: 18.20, vol: "550M" },
];

export function PriceTable() {
  return (
    <section className="py-24 bg-[#050505] relative border-t border-border/40">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Real-Time Market Prices</h2>
          <p className="text-muted-foreground">Monitor the top performing cryptocurrencies with our lightning-fast data feeds.</p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card rounded-xl border border-white/5 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="w-[250px] text-muted-foreground font-medium">Asset</TableHead>
                  <TableHead className="text-right text-muted-foreground font-medium">Price</TableHead>
                  <TableHead className="text-right text-muted-foreground font-medium">24h Change</TableHead>
                  <TableHead className="text-right text-muted-foreground font-medium hidden md:table-cell">24h High</TableHead>
                  <TableHead className="text-right text-muted-foreground font-medium hidden lg:table-cell">24h Low</TableHead>
                  <TableHead className="text-right text-muted-foreground font-medium hidden lg:table-cell">24h Volume</TableHead>
                  <TableHead className="text-right w-[150px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ALL_COINS.map((coin, i) => {
                  const isUp = coin.change >= 0;
                  return (
                    <TableRow key={coin.symbol} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <img 
                            src={`https://assets.coincap.io/assets/icons/${coin.symbol.toLowerCase()}@2x.png`} 
                            alt={coin.name}
                            className="w-8 h-8 rounded-full"
                            onError={(e) => (e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMzMzMiLz48L3N2Zz4=')}
                          />
                          <div>
                            <div className="font-bold text-base">{coin.symbol}</div>
                            <div className="text-xs text-muted-foreground">{coin.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-base font-medium">
                        ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-medium ${isUp ? 'text-primary' : 'text-destructive'}`}>
                        {isUp ? '+' : ''}{coin.change}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground hidden md:table-cell">
                        ${coin.high.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground hidden lg:table-cell">
                        ${coin.low.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground hidden lg:table-cell">
                        ${coin.vol}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" className="hover:bg-primary/20 hover:text-primary transition-colors text-sm h-8">
                          Trade
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </motion.div>
        
        <div className="mt-8 text-center">
          <Button variant="link" className="text-primary hover:text-primary/80">
            View All Markets →
          </Button>
        </div>
      </div>
    </section>
  );
}
