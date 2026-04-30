import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ShieldCheck,
  LogOut,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Wallet,
  Banknote,
  PlusCircle,
  Activity,
  HardDrive,
  CloudUpload,
  Clock,
} from "lucide-react";
import {
  NETWORK_LABELS,
  type Withdrawal,
  type WithdrawalNetwork,
} from "@/hooks/useTradingBot";

const ADMIN_KEY_STORAGE = "stonegate:admin-key:v1";

type AdminWithdrawal = Withdrawal & {
  userId: string;
  userEmail: string | null;
  userName: string | null;
};

type ListResp =
  | { ok: true; withdrawals: AdminWithdrawal[] }
  | { ok: false; error: string };

type Filter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

type AdminTab = "status" | "withdrawals" | "credits";

type SystemStatus = {
  apiOk: true;
  uptimeSeconds: number;
  serverTime: number;
  dataDir: string;
  dataDirBytes: number;
  dataDirFiles: number;
  pendingWithdrawals: number;
  pendingCredits: number;
  backup: {
    dir: string;
    latestFilename: string | null;
    latestAt: number | null;
    latestBytes: number | null;
    totalBackups: number;
    offsiteLastUploadAt: number | null;
    offsiteLastStatus: "ok" | "failed" | null;
  };
};

type CreditStatus = "PENDING" | "APPLIED" | "CANCELLED";

type CreditRecord = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  amount: number;
  note: string | null;
  status: CreditStatus;
  createdAt: number;
  appliedAt: number | null;
  cancelledAt: number | null;
};

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
              Stonegate Admin
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
  const [tab, setTab] = useState<AdminTab>("status");
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
                Stonegate Admin
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
        <div className="flex items-center gap-2 mb-6 border-b border-white/5">
          {(
            [
              { id: "status", label: "Status", icon: Activity },
              { id: "withdrawals", label: "Withdrawals", icon: Banknote },
              { id: "credits", label: "Manual credit", icon: PlusCircle },
            ] as { id: AdminTab; label: string; icon: typeof Banknote }[]
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold tracking-tight transition-colors ${
                tab === id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {tab === id ? (
                <motion.span
                  layoutId="admin-tab-underline"
                  className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary"
                />
              ) : null}
            </button>
          ))}
        </div>

        {tab === "status" ? (
          <StatusPanel adminKey={adminKey} onSignOut={onSignOut} />
        ) : tab === "credits" ? (
          <CreditsPanel adminKey={adminKey} onSignOut={onSignOut} />
        ) : (
          <WithdrawalsPanel
            items={items}
            loading={loading}
            error={error}
            filter={filter}
            setFilter={setFilter}
            busyId={busyId}
            handleApprove={handleApprove}
            handleReject={handleReject}
          />
        )}
      </main>
    </div>
  );
}

function WithdrawalsPanel({
  items,
  loading,
  error,
  filter,
  setFilter,
  busyId,
  handleApprove,
  handleReject,
}: {
  items: AdminWithdrawal[];
  loading: boolean;
  error: string | null;
  filter: Filter;
  setFilter: (f: Filter) => void;
  busyId: string | null;
  handleApprove: (w: AdminWithdrawal) => Promise<void>;
  handleReject: (w: AdminWithdrawal) => Promise<void>;
}) {
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

  return (
    <>
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
    </>
  );
}

function CreditsPanel({
  adminKey,
  onSignOut,
}: {
  adminKey: string;
  onSignOut: () => void;
}) {
  const [credits, setCredits] = useState<CreditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch("/api/credits/admin", {
        headers: { "x-admin-key": adminKey },
      });
      if (r.status === 401) {
        onSignOut();
        return;
      }
      const data = (await r.json().catch(() => null)) as
        | { ok: true; credits: CreditRecord[] }
        | { ok: false; error: string }
        | null;
      if (!r.ok || !data || !data.ok) {
        setLoadError(
          (data && !data.ok ? data.error : null) ?? "Failed to load credits.",
        );
        return;
      }
      setCredits(data.credits);
    } catch {
      setLoadError("Network error loading credits.");
    } finally {
      setLoading(false);
    }
  }, [adminKey, onSignOut]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 15_000);
    return () => clearInterval(id);
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    setOkMessage(null);
    const trimmedUserId = userId.trim();
    const numericAmount = Number(amount);
    if (!trimmedUserId) {
      setFormError("User ID is required.");
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError("Enter a positive USD amount.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/credits/admin", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          userId: trimmedUserId,
          amount: numericAmount,
          note: note.trim() || null,
        }),
      });
      const data = (await r.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!r.ok || !data?.ok) {
        setFormError(data?.error ?? "Failed to create credit.");
        return;
      }
      setOkMessage(
        `Credited $${numericAmount.toFixed(
          2,
        )} to ${trimmedUserId}. The user's balance updates within ~10 seconds the next time they open the app.`,
      );
      setAmount("");
      setNote("");
      await load();
    } catch {
      setFormError("Network error creating credit.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (c: CreditRecord) => {
    if (
      !window.confirm(
        `Cancel pending credit of $${c.amount.toFixed(2)} for ${c.userId}? It will not be applied.`,
      )
    )
      return;
    setBusyId(c.id);
    try {
      const r = await fetch(
        `/api/credits/admin/${encodeURIComponent(c.id)}/cancel`,
        {
          method: "POST",
          headers: { "x-admin-key": adminKey },
        },
      );
      if (!r.ok) {
        const data = (await r.json().catch(() => null)) as {
          error?: string;
        } | null;
        alert(data?.error ?? "Cancel failed.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="bg-[#0c0c0c] border-white/5 p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold tracking-tight">
              Add manual credit
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Top up a user's USD balance directly. The amount is queued
            server-side and applied to their balance the next time their
            dashboard polls (within ~10 seconds).
          </p>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cr-userid" className="text-sm">
                User ID
              </Label>
              <Input
                id="cr-userid"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="user_2abc... (Clerk user ID)"
                spellCheck={false}
                autoComplete="off"
                className="bg-white/5 border-white/10 font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Tip: copy the user ID from any of their withdrawal rows on the
                Withdrawals tab.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cr-amount" className="text-sm">
                Amount (USD)
              </Label>
              <Input
                id="cr-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100.00"
                className="bg-white/5 border-white/10 font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cr-note" className="text-sm">
                Internal note <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="cr-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason for credit (visible only to admins)"
                rows={2}
                className="bg-white/5 border-white/10 text-sm"
              />
            </div>
            {formError ? (
              <div className="flex items-start gap-2 text-sm text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-md p-2.5">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{formError}</span>
              </div>
            ) : null}
            {okMessage ? (
              <div className="flex items-start gap-2 text-sm text-emerald-300 bg-emerald-500/5 border border-emerald-500/20 rounded-md p-2.5">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{okMessage}</span>
              </div>
            ) : null}
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-11 shadow-[0_0_18px_rgba(255,179,0,0.3)]"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              {submitting ? "Crediting…" : "Credit balance"}
            </Button>
          </form>
        </Card>

        <Card className="bg-[#0c0c0c] border-white/5 lg:col-span-3 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
              Recent credits
            </h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void load()}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
          {loadError ? (
            <div className="m-4 flex items-start gap-2 text-sm text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-md p-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{loadError}</span>
            </div>
          ) : null}
          {credits.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {loading ? "Loading…" : "No manual credits yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground border-b border-white/5">
                    <th className="py-3 px-4 font-medium">User</th>
                    <th className="py-3 px-4 font-medium text-right">Amount</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Created</th>
                    <th className="py-3 px-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {credits.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-white/5 hover:bg-white/[0.02]"
                    >
                      <td className="py-3 px-4">
                        <div className="text-[11px] text-muted-foreground font-mono break-all">
                          {c.userId}
                        </div>
                        {c.note ? (
                          <div className="text-[11px] text-muted-foreground mt-1 italic">
                            {c.note}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-primary">
                        +${c.amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <CreditStatusBadge status={c.status} />
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {c.status === "PENDING" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleCancel(c)}
                            disabled={busyId === c.id}
                            className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 font-semibold h-8"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Cancel
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {c.appliedAt
                              ? new Date(c.appliedAt).toLocaleString()
                              : c.cancelledAt
                                ? new Date(c.cancelledAt).toLocaleString()
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
      </div>
    </>
  );
}

function CreditStatusBadge({ status }: { status: CreditStatus }) {
  const styles: Record<CreditStatus, string> = {
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    APPLIED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    CANCELLED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
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

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtUptime(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

function fmtRelative(ts: number | null, now: number): string {
  if (!ts) return "never";
  const diff = Math.max(0, Math.floor((now - ts) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StatusPanel({
  adminKey,
  onSignOut,
}: {
  adminKey: string;
  onSignOut: () => void;
}) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState<number>(Date.now());

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/status/", {
        headers: { "x-admin-key": adminKey },
      });
      if (r.status === 401) {
        onSignOut();
        return;
      }
      const data = (await r.json().catch(() => null)) as
        | { ok: true; status: SystemStatus }
        | { ok: false; error?: string }
        | null;
      if (!r.ok || !data || data.ok !== true) {
        setError(
          (data && "error" in data && data.error) ||
            `Server returned ${r.status}`,
        );
        return;
      }
      setError(null);
      setStatus(data.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [adminKey, onSignOut]);

  useEffect(() => {
    void fetchStatus();
    const id = setInterval(fetchStatus, 10_000);
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      clearInterval(id);
      clearInterval(tick);
    };
  }, [fetchStatus]);

  const apiHealthy = status !== null && error === null;

  // Backup health: green if uploaded within last 30h, amber 30-72h, red >72h or failed.
  const backupHealth: "green" | "amber" | "red" | "none" = (() => {
    if (!status) return "none";
    const last =
      status.backup.offsiteLastUploadAt ?? status.backup.latestAt ?? null;
    if (!last) return "none";
    if (status.backup.offsiteLastStatus === "failed") return "red";
    const ageHours = (now - last) / 3_600_000;
    if (ageHours < 30) return "green";
    if (ageHours < 72) return "amber";
    return "red";
  })();

  const apiHealth: "green" | "red" = apiHealthy ? "green" : "red";

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border/40 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold tracking-tight">
              System status
            </h2>
            <p className="text-xs text-muted-foreground">
              Auto-refreshes every 10s. Last fetched{" "}
              {fmtRelative(status?.serverTime ?? null, now)}.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStatus}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {error ? (
          <div className="mb-4 p-3 rounded border border-rose-500/30 bg-rose-500/10 flex items-start gap-2 text-sm text-rose-200">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatusCard
            icon={Activity}
            label="API server"
            value={apiHealth === "green" ? "Online" : "Unreachable"}
            sub={
              status
                ? `Up ${fmtUptime(status.uptimeSeconds)}`
                : "Waiting for first response"
            }
            health={apiHealth}
          />
          <StatusCard
            icon={CloudUpload}
            label="Off-box backup"
            value={
              status?.backup.offsiteLastUploadAt
                ? status.backup.offsiteLastStatus === "failed"
                  ? "Last upload failed"
                  : `Uploaded ${fmtRelative(
                      status.backup.offsiteLastUploadAt,
                      now,
                    )}`
                : status?.backup.latestAt
                  ? `Local only (${fmtRelative(status.backup.latestAt, now)})`
                  : "Never"
            }
            sub={
              status
                ? `${status.backup.totalBackups} tarball${
                    status.backup.totalBackups === 1 ? "" : "s"
                  } in ${status.backup.dir}`
                : ""
            }
            health={backupHealth}
          />
          <StatusCard
            icon={HardDrive}
            label="Data folder"
            value={status ? fmtBytes(status.dataDirBytes) : "—"}
            sub={
              status
                ? `${status.dataDirFiles} file${
                    status.dataDirFiles === 1 ? "" : "s"
                  }`
                : ""
            }
            health="green"
          />
          <StatusCard
            icon={Clock}
            label="Pending queue"
            value={
              status
                ? `${status.pendingWithdrawals + status.pendingCredits}`
                : "—"
            }
            sub={
              status
                ? `${status.pendingWithdrawals} withdrawal${
                    status.pendingWithdrawals === 1 ? "" : "s"
                  }, ${status.pendingCredits} credit${
                    status.pendingCredits === 1 ? "" : "s"
                  }`
                : ""
            }
            health={
              status &&
              status.pendingWithdrawals + status.pendingCredits > 0
                ? "amber"
                : "green"
            }
          />
        </div>
      </Card>

      {status ? (
        <Card className="bg-card border-border/40 p-5">
          <h3 className="text-sm font-bold tracking-tight mb-3">Details</h3>
          <dl className="text-xs space-y-2">
            <DetailRow label="Data directory" value={status.dataDir} mono />
            <DetailRow label="Backup directory" value={status.backup.dir} mono />
            <DetailRow
              label="Latest backup file"
              value={status.backup.latestFilename ?? "(none)"}
              mono
            />
            <DetailRow
              label="Latest backup size"
              value={
                status.backup.latestBytes !== null
                  ? fmtBytes(status.backup.latestBytes)
                  : "—"
              }
            />
            <DetailRow
              label="Off-box last attempt"
              value={
                status.backup.offsiteLastUploadAt
                  ? `${new Date(status.backup.offsiteLastUploadAt).toLocaleString()} (${status.backup.offsiteLastStatus ?? "unknown"})`
                  : "(no off-box backup configured or no log yet)"
              }
            />
            <DetailRow
              label="Server time"
              value={new Date(status.serverTime).toLocaleString()}
            />
          </dl>
        </Card>
      ) : null}
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  sub,
  health,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub?: string;
  health: "green" | "amber" | "red" | "none";
}) {
  const dot =
    health === "green"
      ? "bg-emerald-400"
      : health === "amber"
        ? "bg-amber-400"
        : health === "red"
          ? "bg-rose-500"
          : "bg-muted-foreground/40";
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            {label}
          </span>
        </div>
        <span className={`w-2 h-2 rounded-full ${dot}`} />
      </div>
      <div className="text-base font-bold tracking-tight truncate">
        {value}
      </div>
      {sub ? (
        <div className="text-xs text-muted-foreground mt-1 truncate">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 border-b border-white/5 pb-2 last:border-b-0 last:pb-0">
      <dt className="text-muted-foreground sm:w-44 shrink-0">{label}</dt>
      <dd
        className={`break-all ${mono ? "font-mono" : ""} text-foreground/90`}
      >
        {value}
      </dd>
    </div>
  );
}
