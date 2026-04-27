import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/react";

export type TradePair = "XAUUSD" | "BTCUSD";
export type BotPair = TradePair | "BOTH";

export type BotTrade = {
  id: string;
  pair: TradePair;
  side: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  outcome: "WIN" | "LOSS";
  closedAt: number;
};

type BotState = {
  isRunning: boolean;
  pair: BotPair;
  trades: BotTrade[];
  consecutiveWins: number;
  startedAt: number | null;
};

const MAX_TRADES = 100;
const TRADE_INTERVAL_MIN_MS = 6_000;
const TRADE_INTERVAL_MAX_MS = 12_000;

const PROFIT_MIN = 50;
const PROFIT_MAX = 60;
const LOSS_MIN = 5;
const LOSS_MAX = 15;

const STREAK_THRESHOLD = 5;
const LOSS_PROBABILITY_AFTER_STREAK = 0.5;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pickPair(p: BotPair): TradePair {
  if (p === "BOTH") return Math.random() < 0.5 ? "BTCUSD" : "XAUUSD";
  return p;
}

function basePrice(pair: TradePair): number {
  if (pair === "BTCUSD") return rand(96000, 99500);
  return rand(2620, 2680);
}

function genTrade(pair: TradePair, outcome: "WIN" | "LOSS"): BotTrade {
  const side: "BUY" | "SELL" = Math.random() < 0.5 ? "BUY" : "SELL";
  const entry = basePrice(pair);
  const pnl =
    outcome === "WIN"
      ? rand(PROFIT_MIN, PROFIT_MAX)
      : -rand(LOSS_MIN, LOSS_MAX);
  const moveScale = pair === "BTCUSD" ? 8 : 0.4;
  const exit = side === "BUY" ? entry + pnl * moveScale : entry - pnl * moveScale;
  return {
    id: `B${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    pair,
    side,
    entryPrice: Number(entry.toFixed(2)),
    exitPrice: Number(exit.toFixed(2)),
    pnl: Number(pnl.toFixed(2)),
    outcome,
    closedAt: Date.now(),
  };
}

function loadState(key: string): BotState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<BotState>;
    return {
      isRunning: false,
      pair: v.pair === "XAUUSD" || v.pair === "BTCUSD" ? v.pair : "BOTH",
      trades: Array.isArray(v.trades) ? (v.trades as BotTrade[]) : [],
      consecutiveWins:
        typeof v.consecutiveWins === "number" ? v.consecutiveWins : 0,
      startedAt: typeof v.startedAt === "number" ? v.startedAt : null,
    };
  } catch {
    return null;
  }
}

function saveState(key: string, state: BotState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function useTradingBot() {
  const { user } = useUser();
  const userKey = user?.id ?? "anon";
  const storageKey = `horizon:bot:v1:${userKey}`;

  const [state, setState] = useState<BotState>(
    () =>
      loadState(storageKey) ?? {
        isRunning: false,
        pair: "BOTH",
        trades: [],
        consecutiveWins: 0,
        startedAt: null,
      },
  );

  useEffect(() => {
    saveState(storageKey, state);
  }, [state, storageKey]);

  useEffect(() => {
    if (!state.isRunning) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      const delay = rand(TRADE_INTERVAL_MIN_MS, TRADE_INTERVAL_MAX_MS);
      timer = setTimeout(() => {
        setState((cur) => {
          const pair = pickPair(cur.pair);
          let outcome: "WIN" | "LOSS";
          if (cur.consecutiveWins < STREAK_THRESHOLD) {
            outcome = "WIN";
          } else {
            outcome =
              Math.random() < LOSS_PROBABILITY_AFTER_STREAK ? "LOSS" : "WIN";
          }
          const trade = genTrade(pair, outcome);
          const trades = [trade, ...cur.trades].slice(0, MAX_TRADES);
          const consecutiveWins =
            outcome === "WIN" ? cur.consecutiveWins + 1 : 0;
          return { ...cur, trades, consecutiveWins };
        });
        schedule();
      }, delay);
    };

    schedule();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [state.isRunning]);

  const start = useCallback(
    () =>
      setState((s) => ({
        ...s,
        isRunning: true,
        startedAt: s.startedAt ?? Date.now(),
      })),
    [],
  );

  const stop = useCallback(
    () => setState((s) => ({ ...s, isRunning: false })),
    [],
  );

  const setPair = useCallback(
    (pair: BotPair) => setState((s) => ({ ...s, pair })),
    [],
  );

  const reset = useCallback(
    () =>
      setState({
        isRunning: false,
        pair: "BOTH",
        trades: [],
        consecutiveWins: 0,
        startedAt: null,
      }),
    [],
  );

  const stats = useMemo(() => {
    const wins = state.trades.filter((t) => t.outcome === "WIN").length;
    const total = state.trades.length;
    const losses = total - wins;
    const winRate = total ? (wins / total) * 100 : 0;
    const totalPnl = state.trades.reduce((s, t) => s + t.pnl, 0);
    const grossProfit = state.trades
      .filter((t) => t.pnl > 0)
      .reduce((s, t) => s + t.pnl, 0);
    const grossLoss = state.trades
      .filter((t) => t.pnl < 0)
      .reduce((s, t) => s + Math.abs(t.pnl), 0);
    return { wins, losses, total, winRate, totalPnl, grossProfit, grossLoss };
  }, [state.trades]);

  return {
    isRunning: state.isRunning,
    pair: state.pair,
    trades: state.trades,
    consecutiveWins: state.consecutiveWins,
    startedAt: state.startedAt,
    ...stats,
    start,
    stop,
    setPair,
    reset,
  };
}
