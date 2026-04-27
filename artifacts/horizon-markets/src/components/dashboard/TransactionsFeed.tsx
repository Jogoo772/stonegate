import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Inbox,
  ArrowLeftRight,
} from "lucide-react";
import {
  NETWORK_LABELS,
  type Deposit,
  type Withdrawal,
} from "@/hooks/useTradingBot";

type Row =
  | { kind: "DEPOSIT"; data: Deposit; ts: number }
  | { kind: "WITHDRAWAL"; data: Withdrawal; ts: number };

function timeAgo(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function truncateMid(s: string, head = 8, tail = 6) {
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function TransactionsFeed({
  deposits,
  withdrawals,
  onDepositClick,
  onWithdrawClick,
}: {
  deposits: Deposit[];
  withdrawals: Withdrawal[];
  onDepositClick: () => void;
  onWithdrawClick: () => void;
}) {
  const rows: Row[] = useMemo(() => {
    const d: Row[] = deposits.map((x) => ({
      kind: "DEPOSIT",
      data: x,
      ts: x.createdAt,
    }));
    const w: Row[] = withdrawals.map((x) => ({
      kind: "WITHDRAWAL",
      data: x,
      ts: x.requestedAt,
    }));
    return [...d, ...w].sort((a, b) => b.ts - a.ts).slice(0, 50);
  }, [deposits, withdrawals]);

  return (
    <Card className="bg-[#0c0c0c] border-white/5 p-6 mt-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            Transactions
          </h2>
          <p className="text-sm text-muted-foreground">
            All deposits and withdrawals across networks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onDepositClick}
            className="text-xs font-semibold text-primary hover:underline"
          >
            New deposit
          </button>
          <span className="text-muted-foreground/50">·</span>
          <button
            onClick={onWithdrawClick}
            className="text-xs font-semibold text-primary hover:underline"
          >
            New withdrawal
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 text-muted-foreground flex items-center justify-center mb-3">
            <Inbox className="w-5 h-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            No transactions yet. Deposits and withdrawals will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground border-b border-white/5">
                <th className="py-3 pr-4 font-medium">Type</th>
                <th className="py-3 pr-4 font-medium text-right">Amount</th>
                <th className="py-3 pr-4 font-medium">Network</th>
                <th className="py-3 pr-4 font-medium">Address</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 font-medium text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                if (r.kind === "DEPOSIT") {
                  const d = r.data;
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-white/5 hover:bg-white/[0.02]"
                    >
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-1.5 text-primary font-semibold text-xs uppercase tracking-widest">
                          <ArrowDownToLine className="w-3.5 h-3.5" />
                          Deposit
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right font-mono font-semibold text-primary">
                        +${d.amount.toFixed(2)}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {NETWORK_LABELS[d.network]}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                        {truncateMid(d.address, 8, 6)}
                      </td>
                      <td className="py-3 pr-4">
                        <DepositStatusBadge status={d.status} />
                      </td>
                      <td className="py-3 text-right text-muted-foreground text-xs">
                        {timeAgo(d.createdAt)}
                      </td>
                    </tr>
                  );
                }
                const w = r.data;
                return (
                  <tr
                    key={w.id}
                    className="border-b border-white/5 hover:bg-white/[0.02]"
                  >
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-1.5 text-rose-400 font-semibold text-xs uppercase tracking-widest">
                        <ArrowUpFromLine className="w-3.5 h-3.5" />
                        Withdraw
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono font-semibold text-rose-400">
                      −${w.amount.toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {NETWORK_LABELS[w.network]}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                      {truncateMid(w.address, 8, 6)}
                    </td>
                    <td className="py-3 pr-4">
                      <WithdrawalStatusBadge status={w.status} />
                    </td>
                    <td className="py-3 text-right text-muted-foreground text-xs">
                      {timeAgo(w.requestedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function DepositStatusBadge({ status }: { status: Deposit["status"] }) {
  const styles: Record<Deposit["status"], string> = {
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    CONFIRMED: "bg-primary/10 text-primary border-primary/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-widest ${styles[status]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full bg-current ${
          status === "PENDING" ? "animate-pulse" : ""
        }`}
      />
      {status}
    </span>
  );
}

function WithdrawalStatusBadge({ status }: { status: Withdrawal["status"] }) {
  const styles: Record<Withdrawal["status"], string> = {
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    PROCESSING: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    COMPLETED: "bg-primary/10 text-primary border-primary/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-widest ${styles[status]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      {status}
    </span>
  );
}
