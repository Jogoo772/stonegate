import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Play,
  Pause,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Flame,
} from "lucide-react";
import { useTradingBot, type BotPair } from "@/hooks/useTradingBot";

const PAIR_OPTIONS: { value: BotPair; label: string }[] = [
  { value: "BOTH", label: "Both" },
  { value: "XAUUSD", label: "XAUUSD" },
  { value: "BTCUSD", label: "BTCUSD" },
];

function formatPrice(pair: string, value: number) {
  if (pair === "BTCUSD")
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function timeAgo(ms: number) {
  const diff = Math.max(0, Date.now() - ms);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function TradingBot() {
  const bot = useTradingBot();

  return (
    <Card className="bg-[#0c0c0c] border-white/5 p-6 relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6 relative">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              Horizon AlphaBot
              <span
                className={`inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase ${
                  bot.isRunning
                    ? "bg-primary/15 text-primary border border-primary/25"
                    : "bg-white/5 text-muted-foreground border border-white/10"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    bot.isRunning ? "bg-primary animate-pulse" : "bg-zinc-500"
                  }`}
                />
                {bot.isRunning ? "LIVE" : "STOPPED"}
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Algorithmic execution on XAUUSD &amp; BTCUSD · 85%+ win rate engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1">
            {PAIR_OPTIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => bot.setPair(p.value)}
                disabled={bot.isRunning}
                className={`px-3 py-1.5 text-xs font-bold tracking-wide rounded-md transition-colors ${
                  bot.pair === p.value
                    ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(0,255,136,0.25)]"
                    : "text-muted-foreground hover:text-foreground"
                } ${bot.isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {bot.isRunning ? (
            <Button
              size="sm"
              variant="outline"
              onClick={bot.stop}
              className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 font-semibold"
            >
              <Pause className="w-4 h-4 mr-1.5" />
              Pause
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={bot.start}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-[0_0_15px_rgba(0,255,136,0.35)]"
            >
              <Play className="w-4 h-4 mr-1.5" />
              Start Bot
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={bot.reset}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Reset bot"
            disabled={bot.isRunning}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 relative">
        <BotStat
          label="Net Profit"
          value={`${bot.totalPnl >= 0 ? "+" : "−"}$${Math.abs(bot.totalPnl).toFixed(2)}`}
          tone={bot.totalPnl >= 0 ? "pos" : "neg"}
        />
        <BotStat
          label="Win Rate"
          value={`${bot.winRate.toFixed(1)}%`}
          tone={bot.winRate >= 85 ? "pos" : "neutral"}
        />
        <BotStat
          label="Trades"
          value={`${bot.total}`}
          sub={`${bot.wins}W / ${bot.losses}L`}
        />
        <BotStat
          label="Win Streak"
          value={`${bot.consecutiveWins}`}
          icon={
            bot.consecutiveWins >= 3 ? (
              <Flame className="w-3.5 h-3.5 text-amber-400" />
            ) : null
          }
        />
      </div>

      {/* Strategy summary */}
      <div className="flex flex-wrap gap-2 mb-5 text-xs">
        <Tag>TP: $50 – $60</Tag>
        <Tag>SL: $5 – $15</Tag>
        <Tag>Min 5 wins before any SL</Tag>
        <Tag>Pairs: XAUUSD · BTCUSD</Tag>
      </div>

      {/* Live trades feed */}
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold tracking-wide text-foreground/90">
            Live Trade Feed
          </h3>
          {bot.isRunning ? (
            <span className="text-xs text-muted-foreground">
              Next trade in 6–12s
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Press start to begin executing trades
            </span>
          )}
        </div>

        <div className="rounded-lg border border-white/5 bg-black/30 max-h-80 overflow-y-auto">
          {bot.trades.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No trades yet. Start the bot to begin execution.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              <AnimatePresence initial={false}>
                {bot.trades.slice(0, 12).map((t) => {
                  const win = t.outcome === "WIN";
                  return (
                    <motion.li
                      key={t.id}
                      initial={{ opacity: 0, y: -8, backgroundColor: win ? "rgba(0,255,136,0.08)" : "rgba(244,63,94,0.08)" }}
                      animate={{ opacity: 1, y: 0, backgroundColor: "rgba(0,0,0,0)" }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="px-4 py-3 flex items-center gap-3"
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          win
                            ? "bg-primary/15 text-primary"
                            : "bg-rose-500/15 text-rose-400"
                        }`}
                      >
                        {win ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <span>{t.pair}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              t.side === "BUY"
                                ? "bg-primary/10 text-primary"
                                : "bg-amber-500/10 text-amber-400"
                            }`}
                          >
                            {t.side}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {formatPrice(t.pair, t.entryPrice)} →{" "}
                          {formatPrice(t.pair, t.exitPrice)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-mono font-bold text-sm ${
                            win ? "text-primary" : "text-rose-400"
                          }`}
                        >
                          {win ? "+" : "−"}${Math.abs(t.pnl).toFixed(2)}
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {win ? "TP hit" : "SL hit"} · {timeAgo(t.closedAt)}
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

function BotStat({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "pos" | "neg" | "neutral";
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === "pos"
      ? "text-primary"
      : tone === "neg"
        ? "text-rose-400"
        : "text-foreground";
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
        {label}
      </div>
      <div
        className={`text-xl font-black font-mono mt-1 flex items-center gap-1.5 ${toneClass}`}
      >
        {value}
        {icon}
      </div>
      {sub ? (
        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/5 text-muted-foreground font-medium">
      {children}
    </span>
  );
}
