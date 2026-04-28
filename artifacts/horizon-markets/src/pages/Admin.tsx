import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck,
  LogOut,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
} from "lucide-react";
import {
  NETWORK_LABELS,
  type Withdrawal,
  type WithdrawalNetwork,
} from "@/hooks/useTradingBot";

const ADMIN_KEY_STORAGE = "hedgegate:admin-key:v1";

type AdminWithdrawal = Withdrawal & {
  userId: string;
  userEmail: string | null;
  userName: string | null;
};

type ListResp =
  | { ok: true; withdrawals: AdminWithdrawal[] }
  | { ok: false; error: string };

type Filter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

export default function Admin() {
  const [adminKey, setAdminKey] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(ADMIN_KEY_STORAGE);
  });

  if (!adminKey) {
    return (
      <AdminLogin
        onAuth={(key) => {
          window.sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
          setAdminKey(key);
        }}
      />
    );
  }

  return (
    <AdminConsole
      adminKey={adminKey}
      onSignOut={() => {
        window.sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        setAdminKey(null);
      }}
    />
  );
}

function AdminLogin({ onAuth }: { onAuth: (key: string) => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !key.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch("/api/withdrawals/admin/auth", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-key": key.trim(),
        },
        body: JSON.stringify({}),
      });
      const data = (await r.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!r.ok || !data?.ok) {
        setError(data?.error ?? "Invalid admin key.");
        return;
      }
      onAuth(key.trim());
    } catch {
      setError("Could not reach the admin service. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="bg-[#0c0c0c] border-white/5 p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-amber-500/5 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/15 text-primary flex items-center justify-center mb-4">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-center text-2xl font-black tracking-tight">
              HedgeGate Admin
            </h1>
            <p className="text-center text-sm text-muted-foreground mt-1">
              Withdrawal review console
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-key" className="text-sm">
                  Administrator key
                </Label>
                <Input
                  id="admin-key"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="bg-white/5 border-white/10 font-mono"
                  placeholder="Enter admin key"
                />
              </div>
              {error ? (
                <div className="flex items-start gap-2 text-sm text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-md p-2.5">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}
              <Button
                type="submit"
                disabled={submitting || !key.trim()}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-11 shadow-[0_0_20px_rgba(255,179,0,0.35)]"
              >
                {submitting ? "Verifying…" : "Sign in"}
              </Button>
            </form>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

function AdminConsole({
  adminKey,
  onSignOut,
}: {
  adminKey: string;
  onSignOut: () => void;
}) {
  const [items, setItems] = useState<AdminWithdrawal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/withdrawals/admin", {
        headers: { "x-admin-key": adminKey },
      });
      if (r.status === 401) {
        onSignOut();
        return;
      }
      const data = (await r.json().catch(() => null)) as ListResp | null;
      if (!r.ok || !data || !data.ok) {
        setError(
          (data && !data.ok ? data.error : null) ??
            "Failed to load withdrawals.",
        );
        return;
      }
      setItems(data.withdrawals);
    } catch {
      setError("Network error loading withdrawals.");
    } finally {
      setLoading(false);
    }
  }, [adminKey, onSignOut]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 15_000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((w) => w.status === filter);
  }, [items, filter]);

  const counts = useMemo(
    () => ({
      PENDING: items.filter((w) => w.status === "PENDING").length,
      APPROVED: items.filter((w) => w.status === "APPROVED").length,
      REJECTED: items.filter((w) => w.status === "REJECTED").length,
      ALL: items.length,
    }),
    [items],
  );

  const handleApprove = async (w: AdminWithdrawal) => {
    const txHash = window.prompt(
      `Optional transaction hash for ${w.id} (leave blank to mark approved without one):`,
      "",
    );
    if (txHash === null) return; // cancelled
    setBusyId(w.id);
    try {
      const r = await fetch(
        `/api/withdrawals/admin/${encodeURIComponent(w.id)}/approve`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({ txHash: txHash.trim() || null }),
        },
      );
      if (!r.ok) {
        const data = (await r.json().catch(() => null)) as {
          error?: string;
        } | null;
        alert(data?.error ?? "Approval failed.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (w: AdminWithdrawal) => {
    const reason = window.prompt(
      `Reason for rejecting ${w.id}? (will be shown to the user; balance is refunded automatically)`,
      "Insufficient verification",
    );
    if (reason === null) return;
    setBusyId(w.id);
    try {
      const r = await fetch(
        `/api/withdrawals/admin/${encodeURIComponent(w.id)}/reject`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({ reason: reason.trim() }),
        },
      );
      if (!r.ok) {
        const data = (await r.json().catch(() => null)) as {
          error?: string;
        } | null;
        alert(data?.error ?? "Rejection failed.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 max-w-7xl py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">
                HedgeGate Admin
              </div>
              <div className="text-[11px] text-muted-foreground">
                Withdrawal review console
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
              className="border-white/15 hover:bg-white/5"
            >
              <RefreshCw
                className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onSignOut}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4 mr-1.5" />
              Sign out
            </Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 max-w-7xl py-8">
        <div className="flex flex-wrap gap-2 mb-6">
          {(["PENDING", "APPROVED", "REJECTED", "ALL"] as Filter[]).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
                }`}
              >
                {f} ({counts[f]})
              </button>
            ),
          )}
        </div>

        {error ? (
          <div className="flex items-start gap-2 text-sm text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-md p-3 mb-4">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <Card className="bg-[#0c0c0c] border-white/5 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {loading ? "Loading…" : "No withdrawals in this view."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground border-b border-white/5">
                    <th className="py-3 px-4 font-medium">User</th>
                    <th className="py-3 px-4 font-medium text-right">
                      Amount
                    </th>
                    <th className="py-3 px-4 font-medium">Network</th>
                    <th className="py-3 px-4 font-medium">Address</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Requested</th>
                    <th className="py-3 px-4 font-medium text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((w) => (
                    <tr
                      key={w.id}
                      className="border-b border-white/5 hover:bg-white/[0.02]"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold">
                          {w.userName ?? w.userEmail ?? "—"}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {w.userEmail ?? w.userId}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                        ${w.amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {NETWORK_LABELS[w.network as WithdrawalNetwork]}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        <CopyableAddress value={w.address} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={w.status} />
                        {w.reviewerNote ? (
                          <div className="text-[11px] text-muted-foreground mt-1 max-w-[200px]">
                            {w.reviewerNote}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {new Date(w.requestedAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {w.status === "PENDING" ? (
                          <div className="inline-flex items-center gap-2 justify-end">
                            <Button
                              size="sm"
                              onClick={() => void handleApprove(w)}
                              disabled={busyId === w.id}
                              className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-8"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleReject(w)}
                              disabled={busyId === w.id}
                              className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 font-semibold h-8"
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {w.reviewedAt
                              ? new Date(w.reviewedAt).toLocaleString()
                              : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <p className="text-[11px] text-muted-foreground text-center mt-6">
          All actions are logged on the server. Refresh runs automatically
          every 15 seconds.
        </p>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: Withdrawal["status"] }) {
  const styles: Record<Withdrawal["status"], string> = {
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    APPROVED: "bg-primary/10 text-primary border-primary/20",
    REJECTED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
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

function CopyableAddress({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const truncated =
    value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
      title={value}
    >
      <span>{truncated}</span>
      <Copy className="w-3 h-3" />
      {copied ? <span className="sr-only">Copied</span> : null}
    </button>
  );
}
