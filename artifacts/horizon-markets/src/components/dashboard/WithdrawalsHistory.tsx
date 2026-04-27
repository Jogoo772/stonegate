import { Card } from "@/components/ui/card";
import { ArrowDownToLine, Inbox } from "lucide-react";
import {
  NETWORK_LABELS,
  type Withdrawal,
} from "@/hooks/useTradingBot";

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

export function WithdrawalsHistory({
  withdrawals,
  onWithdrawClick,
}: {
  withdrawals: Withdrawal[];
  onWithdrawClick: () => void;
}) {
  return (
    <Card className="bg-[#0c0c0c] border-white/5 p-6 mt-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-primary" />
            Withdrawals
          </h2>
          <p className="text-sm text-muted-foreground">
            Outgoing transfers to external wallets
          </p>
        </div>
        <button
          onClick={onWithdrawClick}
          className="text-xs font-semibold text-primary hover:underline"
        >
          New withdrawal
        </button>
      </div>
      {withdrawals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 text-muted-foreground flex items-center justify-center mb-3">
            <Inbox className="w-5 h-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            No withdrawals yet. Your requests will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground border-b border-white/5">
                <th className="py-3 pr-4 font-medium">Amount</th>
                <th className="py-3 pr-4 font-medium">Network</th>
                <th className="py-3 pr-4 font-medium">Address</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 font-medium text-right">Requested</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr
                  key={w.id}
                  className="border-b border-white/5 hover:bg-white/[0.02]"
                >
                  <td className="py-3 pr-4 font-mono font-semibold">
                    ${w.amount.toFixed(2)}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {NETWORK_LABELS[w.network]}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                    {truncateMid(w.address, 8, 6)}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={w.status} />
                  </td>
                  <td className="py-3 text-right text-muted-foreground text-xs">
                    {timeAgo(w.requestedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: Withdrawal["status"] }) {
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
