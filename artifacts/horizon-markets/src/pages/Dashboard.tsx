import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useUser } from "@clerk/react";
import { Navbar } from "@/components/layout/Navbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  TrendingUp,
  Activity,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { useLivePrices, type LivePrice } from "@/hooks/useLivePrices";
import { useTradingBot } from "@/hooks/useTradingBot";
import { TradingBot } from "@/components/dashboard/TradingBot";

const COIN_ICONS: Record<string, string> = {
  BTC: "https://assets.coincap.io/assets/icons/btc@2x.png",
  ETH: "https://assets.coincap.io/assets/icons/eth@2x.png",
  SOL: "https://assets.coincap.io/assets/icons/sol@2x.png",
  USDT: "https://assets.coincap.io/assets/icons/usdt@2x.png",
  XRP: "https://assets.coincap.io/assets/icons/xrp@2x.png",
  BNB: "https://assets.coincap.io/assets/icons/bnb@2x.png",
  DOGE: "https://assets.coincap.io/assets/icons/doge@2x.png",
  ADA: "https://assets.coincap.io/assets/icons/ada@2x.png",
};

function formatUsd(value: number, max = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: max,
    maximumFractionDigits: max,
  });
}

function formatPrice(value: number): string {
  if (value >= 1000) return formatUsd(value, 2);
  if (value >= 1) return formatUsd(value, 3);
  return formatUsd(value, 4);
}

function timeAgo(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function PriceCell({ price }: { price: LivePrice }) {
  const prevRef = useRef<number>(price.price);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    if (price.price === prev) return;
    setFlash(price.price > prev ? "up" : "down");
    prevRef.current = price.price;
    const t = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(t);
  }, [price.price]);

  return (
    <span
      className={`font-mono font-semibold transition-colors duration-500 ${
        flash === "up"
          ? "text-primary"
          : flash === "down"
            ? "text-rose-400"
            : "text-foreground"
      }`}
    >
      ${formatPrice(price.price)}
    </span>
  );
}

export default function Dashboard() {
  const { user } = useUser();
  const {
    data: prices,
    isLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
    error,
  } = useLivePrices();
  const bot = useTradingBot();

  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const marketRows: LivePrice[] = useMemo(() => {
    if (!prices) return [];
    return Object.values(prices);
  }, [prices]);

  const firstName =
    user?.firstName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "Trader";

  const lastUpdatedLabel = dataUpdatedAt ? timeAgo(dataUpdatedAt) : "—";
  const portfolioValue = bot.balance;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4"
          >
            <div>
              <Badge className="bg-primary/10 text-primary border-primary/20 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 animate-pulse" />
                Account verified
              </Badge>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter">
                Welcome back,{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">
                  {firstName}
                </span>
              </h1>
              <p className="text-muted-foreground mt-2">
                Live market data, streaming straight from the exchange.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-white/[0.03]">
                <span
                  className={`w-2 h-2 rounded-full ${
                    error
                      ? "bg-rose-400"
                      : isFetching
                        ? "bg-primary animate-pulse"
                        : "bg-primary"
                  }`}
                />
                <span className="text-xs font-medium text-muted-foreground">
                  {error
                    ? "Reconnecting…"
                    : isFetching
                      ? "Updating…"
                      : `Live · updated ${lastUpdatedLabel}`}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                className="border-white/15 hover:bg-white/5"
                aria-label="Refresh prices"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </motion.div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <SummaryCard
              icon={<Wallet className="w-5 h-5" />}
              label="Portfolio Value"
              value={`$${formatUsd(portfolioValue)}`}
              sub={
                portfolioValue > 0 ? (
                  <span className="text-primary">
                    Settled bot profits in your wallet
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Stop the bot to settle profits to balance
                  </span>
                )
              }
            />
            <SummaryCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Session P/L"
              value={`${bot.totalPnl >= 0 ? "+" : "−"}$${formatUsd(Math.abs(bot.totalPnl))}`}
              sub={
                <span
                  className={
                    bot.totalPnl >= 0 ? "text-primary" : "text-rose-400"
                  }
                >
                  {bot.total > 0
                    ? `${bot.total} trades · ${bot.winRate.toFixed(1)}% win rate`
                    : "No active session"}
                </span>
              }
            />
            <SummaryCard
              icon={<Activity className="w-5 h-5" />}
              label="Bot Status"
              value={bot.isRunning ? "LIVE" : "Idle"}
              sub={
                <span
                  className={
                    bot.isRunning ? "text-primary" : "text-muted-foreground"
                  }
                >
                  {bot.isRunning
                    ? `Streak: ${bot.consecutiveWins} wins`
                    : "Press start in the bot panel"}
                </span>
              }
            />
            <SummaryCard
              icon={<ShieldCheck className="w-5 h-5" />}
              label="Account Tier"
              value="VIP 2"
              sub={
                <span className="text-muted-foreground">
                  Maker 0.04% / Taker 0.06%
                </span>
              }
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TradingBot />
            </div>

            {/* Quick actions */}
            <Card className="bg-[#0c0c0c] border-white/5 p-6">
              <h2 className="text-xl font-bold tracking-tight mb-4">
                Quick Actions
              </h2>
              <div className="space-y-3">
                <ActionButton label="Deposit Funds" primary />
                <ActionButton label="Withdraw" />
                <ActionButton label="Buy Crypto" />
                <ActionButton label="Sell" />
                <ActionButton label="Open Trading Terminal" />
              </div>
              <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/15">
                <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-widest mb-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Security tip
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Enable 2FA in account settings to add an extra layer of
                  protection to withdrawals and logins.
                </p>
              </div>
            </Card>
          </div>

          {/* Live markets */}
          <Card className="bg-[#0c0c0c] border-white/5 p-6 mt-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                  Live Markets
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    REAL-TIME
                  </span>
                </h2>
                <p className="text-sm text-muted-foreground">
                  Spot prices, refreshed every 12 seconds
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-white/15 hover:bg-white/5"
              >
                View all markets
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground border-b border-white/5">
                    <th className="py-3 pr-4 font-medium">Asset</th>
                    <th className="py-3 pr-4 font-medium text-right">
                      Price (USD)
                    </th>
                    <th className="py-3 pr-4 font-medium text-right">
                      24h Change
                    </th>
                    <th className="py-3 font-medium text-right">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && marketRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-10 text-center text-muted-foreground"
                      >
                        Loading live prices…
                      </td>
                    </tr>
                  ) : (
                    marketRows.map((p) => {
                      const positive = p.change24h >= 0;
                      return (
                        <tr
                          key={p.symbol}
                          className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={COIN_ICONS[p.symbol]}
                                alt={p.symbol}
                                className="w-7 h-7 rounded-full"
                              />
                              <div>
                                <div className="font-semibold">{p.symbol}</div>
                                <div className="text-xs text-muted-foreground">
                                  {p.name}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-right">
                            <PriceCell price={p} />
                          </td>
                          <td
                            className={`py-3 pr-4 text-right font-mono font-semibold ${
                              positive ? "text-primary" : "text-rose-400"
                            }`}
                          >
                            <span className="inline-flex items-center gap-1 justify-end">
                              {positive ? (
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowDownRight className="w-3.5 h-3.5" />
                              )}
                              {positive ? "+" : ""}
                              {p.change24h.toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-3 text-right text-muted-foreground text-xs">
                            {timeAgo(p.lastUpdated)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {error ? (
              <div className="mt-4 text-xs text-rose-400">
                Couldn't reach market data feed. Retrying automatically…
              </div>
            ) : null}
          </Card>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: React.ReactNode;
}) {
  return (
    <Card className="bg-[#0c0c0c] border-white/5 p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl" />
      <div className="flex items-center justify-between mb-3 relative">
        <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          {label}
        </div>
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-black tracking-tight font-mono">
        {value}
      </div>
      <div className="text-xs mt-1.5 font-medium">{sub}</div>
    </Card>
  );
}

function ActionButton({
  label,
  primary,
}: {
  label: string;
  primary?: boolean;
}) {
  return (
    <Button
      className={`w-full justify-start font-semibold ${
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(0,255,136,0.25)]"
          : "bg-white/5 hover:bg-white/10 text-foreground"
      }`}
    >
      {label}
    </Button>
  );
}
