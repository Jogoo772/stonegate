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

export type WithdrawalNetwork =
  | "BTC"
  | "ETH"
  | "USDT_TRC20"
  | "USDT_ERC20"
  | "SOL";

export type WithdrawalStatus = "PENDING" | "PROCESSING" | "COMPLETED";

export type Withdrawal = {
  id: string;
  amount: number;
  address: string;
  network: WithdrawalNetwork;
  status: WithdrawalStatus;
  requestedAt: number;
  completedAt: number | null;
  txHash: string | null;
};

export type DepositStatus = "PENDING" | "CONFIRMED";

export type Deposit = {
  id: string;
  amount: number;
  address: string;
  network: WithdrawalNetwork;
  status: DepositStatus;
  createdAt: number;
  confirmAt: number;
  confirmedAt: number | null;
  txHash: string;
};

export const MIN_WITHDRAWAL_USD = 10;
export const MIN_DEPOSIT_USD = 10;

export const NETWORK_LABELS: Record<WithdrawalNetwork, string> = {
  BTC: "Bitcoin (BTC)",
  ETH: "Ethereum (ERC-20)",
  USDT_TRC20: "USDT (TRC-20)",
  USDT_ERC20: "USDT (ERC-20)",
  SOL: "Solana (SOL)",
};

export type WithdrawResult =
  | { ok: true; withdrawal: Withdrawal }
  | { ok: false; error: string };

export type DepositResult =
  | { ok: true; deposit: Deposit }
  | { ok: false; error: string };

type BotState = {
  isRunning: boolean;
  pair: BotPair;
  trades: BotTrade[];
  consecutiveWins: number;
  startedAt: number | null;
  balance: number;
  lastSettledPnl: number | null;
  lastSettledAt: number | null;
  withdrawals: Withdrawal[];
  deposits: Deposit[];
  depositAddresses: Partial<Record<WithdrawalNetwork, string>>;
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

const BASE58 =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const HEX = "0123456789abcdef";

function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function seededRandom(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

function randomString(charset: string, length: number, rng: () => number) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += charset[Math.floor(rng() * charset.length)];
  }
  return out;
}

function generateAddress(
  network: "BTC" | "ETH" | "USDT_TRC20" | "USDT_ERC20" | "SOL",
  userKey: string,
): string {
  const rng = seededRandom(`${userKey}:${network}`);
  switch (network) {
    case "BTC":
      return `bc1q${randomString(BASE58.toLowerCase(), 38, rng)}`;
    case "ETH":
    case "USDT_ERC20":
      return `0x${randomString(HEX, 40, rng)}`;
    case "USDT_TRC20":
      return `T${randomString(BASE58, 33, rng)}`;
    case "SOL":
      return randomString(BASE58, 44, rng);
  }
}

function generateTxHash(
  network: "BTC" | "ETH" | "USDT_TRC20" | "USDT_ERC20" | "SOL",
): string {
  const rng = seededRandom(`tx:${Date.now()}:${Math.random()}`);
  if (network === "ETH" || network === "USDT_ERC20") {
    return `0x${randomString(HEX, 64, rng)}`;
  }
  return randomString(HEX, 64, rng);
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
      balance: typeof v.balance === "number" ? v.balance : 0,
      lastSettledPnl:
        typeof v.lastSettledPnl === "number" ? v.lastSettledPnl : null,
      lastSettledAt:
        typeof v.lastSettledAt === "number" ? v.lastSettledAt : null,
      withdrawals: Array.isArray(v.withdrawals)
        ? (v.withdrawals as Withdrawal[])
        : [],
      deposits: Array.isArray(v.deposits) ? (v.deposits as Deposit[]) : [],
      depositAddresses:
        v.depositAddresses && typeof v.depositAddresses === "object"
          ? (v.depositAddresses as Partial<Record<WithdrawalNetwork, string>>)
          : {},
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
        balance: 0,
        lastSettledPnl: null,
        lastSettledAt: null,
        withdrawals: [],
        deposits: [],
        depositAddresses: {},
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
    () =>
      setState((s) => {
        const sessionPnl = s.trades.reduce((acc, t) => acc + t.pnl, 0);
        return {
          ...s,
          isRunning: false,
          balance: Number((s.balance + sessionPnl).toFixed(2)),
          trades: [],
          consecutiveWins: 0,
          startedAt: null,
          lastSettledPnl: Number(sessionPnl.toFixed(2)),
          lastSettledAt: Date.now(),
        };
      }),
    [],
  );

  const clearSettledNotice = useCallback(
    () =>
      setState((s) => ({ ...s, lastSettledPnl: null, lastSettledAt: null })),
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
        balance: 0,
        lastSettledPnl: null,
        lastSettledAt: null,
        withdrawals: [],
        deposits: [],
        depositAddresses: {},
      }),
    [],
  );

  const requestWithdrawal = useCallback(
    (
      amount: number,
      address: string,
      network: WithdrawalNetwork,
    ): WithdrawResult => {
      const cleanAddress = address.trim();
      if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, error: "Enter a valid amount" };
      }
      if (amount < MIN_WITHDRAWAL_USD) {
        return {
          ok: false,
          error: `Minimum withdrawal is $${MIN_WITHDRAWAL_USD.toFixed(2)}`,
        };
      }
      if (cleanAddress.length < 16) {
        return { ok: false, error: "Wallet address looks invalid" };
      }
      let result: WithdrawResult = {
        ok: false,
        error: "Insufficient balance",
      };
      setState((s) => {
        if (amount > s.balance) {
          result = {
            ok: false,
            error: `Insufficient balance. Available: $${s.balance.toFixed(2)}`,
          };
          return s;
        }
        const withdrawal: Withdrawal = {
          id: `W${Date.now().toString(36)}${Math.floor(
            Math.random() * 1e6,
          ).toString(36)}`,
          amount: Number(amount.toFixed(2)),
          address: cleanAddress,
          network,
          status: "PENDING",
          requestedAt: Date.now(),
          completedAt: null,
          txHash: null,
        };
        result = { ok: true, withdrawal };
        return {
          ...s,
          balance: Number((s.balance - amount).toFixed(2)),
          withdrawals: [withdrawal, ...s.withdrawals].slice(0, 50),
        };
      });
      return result;
    },
    [],
  );

  const getDepositAddress = useCallback(
    (network: WithdrawalNetwork): string => {
      const existing = state.depositAddresses[network];
      if (existing) return existing;
      const fresh = generateAddress(network, userKey);
      setState((s) =>
        s.depositAddresses[network]
          ? s
          : {
              ...s,
              depositAddresses: { ...s.depositAddresses, [network]: fresh },
            },
      );
      return fresh;
    },
    [state.depositAddresses, userKey],
  );

  const simulateDeposit = useCallback(
    (amount: number, network: WithdrawalNetwork): DepositResult => {
      if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, error: "Enter a valid amount" };
      }
      if (amount < MIN_DEPOSIT_USD) {
        return {
          ok: false,
          error: `Minimum deposit is $${MIN_DEPOSIT_USD.toFixed(2)}`,
        };
      }
      const address =
        state.depositAddresses[network] ?? generateAddress(network, userKey);
      const now = Date.now();
      const deposit: Deposit = {
        id: `D${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
        amount: Number(amount.toFixed(2)),
        address,
        network,
        status: "PENDING",
        createdAt: now,
        confirmAt: now + Math.floor(rand(4_000, 9_000)),
        confirmedAt: null,
        txHash: generateTxHash(network),
      };
      setState((s) => ({
        ...s,
        deposits: [deposit, ...s.deposits].slice(0, 50),
        depositAddresses: s.depositAddresses[network]
          ? s.depositAddresses
          : { ...s.depositAddresses, [network]: address },
      }));
      return { ok: true, deposit };
    },
    [state.depositAddresses, userKey],
  );

  // Confirm pending deposits and credit balance
  useEffect(() => {
    const hasPending = state.deposits.some((d) => d.status === "PENDING");
    if (!hasPending) return;
    const id = setInterval(() => {
      setState((s) => {
        const now = Date.now();
        let credited = 0;
        const deposits = s.deposits.map((d) => {
          if (d.status === "PENDING" && now >= d.confirmAt) {
            credited += d.amount;
            return { ...d, status: "CONFIRMED" as DepositStatus, confirmedAt: now };
          }
          return d;
        });
        if (credited === 0) return s;
        return {
          ...s,
          deposits,
          balance: Number((s.balance + credited).toFixed(2)),
        };
      });
    }, 800);
    return () => clearInterval(id);
  }, [state.deposits]);

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
    balance: state.balance,
    lastSettledPnl: state.lastSettledPnl,
    lastSettledAt: state.lastSettledAt,
    withdrawals: state.withdrawals,
    deposits: state.deposits,
    ...stats,
    start,
    stop,
    setPair,
    reset,
    clearSettledNotice,
    requestWithdrawal,
    getDepositAddress,
    simulateDeposit,
  };
}
