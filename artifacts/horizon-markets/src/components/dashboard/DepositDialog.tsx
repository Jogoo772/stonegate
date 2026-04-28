import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDownToLine,
  CheckCircle2,
  AlertCircle,
  Copy,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  DEPOSIT_PRESETS_USD,
  MIN_DEPOSIT_USD,
  NETWORK_LABELS,
  PAY_CURRENCY_LABEL,
  type Deposit,
  type DepositResult,
  type WithdrawalNetwork,
} from "@/hooks/useTradingBot";

const NETWORK_VALUES: WithdrawalNetwork[] = [
  "USDT_TRC20",
  "USDT_ERC20",
  "BTC",
  "ETH",
  "SOL",
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    amount: number,
    network: WithdrawalNetwork,
  ) => Promise<DepositResult>;
  deposits: Deposit[];
};

export function DepositDialog({
  open,
  onOpenChange,
  onSubmit,
  deposits,
}: Props) {
  const [network, setNetwork] = useState<WithdrawalNetwork>("USDT_TRC20");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const active = activeId
    ? deposits.find((d) => d.id === activeId) ?? null
    : null;

  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      setAmount("");
      setError(null);
      setActiveId(null);
      setSubmitting(false);
    }, 200);
    return () => clearTimeout(t);
  }, [open]);

  const handleCopy = (value: string) => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const numericAmount = Number(amount);
    const res = await onSubmit(numericAmount, network);
    setSubmitting(false);
    if (res.ok) {
      setActiveId(res.deposit.id);
    } else {
      setError(res.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0c0c0c] border-white/10 text-foreground sm:max-w-md">
        <AnimatePresence mode="wait">
          {active ? (
            <ActivePayment
              key="active"
              deposit={active}
              copied={copied}
              onCopy={handleCopy}
              onClose={() => onOpenChange(false)}
              onNew={() => {
                setActiveId(null);
                setAmount("");
              }}
            />
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DialogHeader>
                <DialogTitle className="text-2xl tracking-tight flex items-center gap-2">
                  <ArrowDownToLine className="w-5 h-5 text-primary" />
                  Deposit funds
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Powered by NOWPayments. Crypto is auto-converted to your USD
                  balance once the network confirms.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 mt-3">
                <div className="space-y-2">
                  <Label htmlFor="dep-network" className="text-sm">
                    Pay with
                  </Label>
                  <Select
                    value={network}
                    onValueChange={(v) => setNetwork(v as WithdrawalNetwork)}
                  >
                    <SelectTrigger
                      id="dep-network"
                      className="bg-white/5 border-white/10 hover:bg-white/10"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111] border-white/10 text-foreground">
                      {NETWORK_VALUES.map((n) => (
                        <SelectItem key={n} value={n}>
                          {NETWORK_LABELS[n]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="dep-amount" className="text-sm">
                      Deposit amount (USD)
                    </Label>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Min ${MIN_DEPOSIT_USD}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {DEPOSIT_PRESETS_USD.map((preset) => {
                      const active = Number(amount) === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setAmount(String(preset));
                            setError(null);
                          }}
                          className={`py-2 rounded-md border text-sm font-bold font-mono transition-all ${
                            active
                              ? "bg-primary text-primary-foreground border-primary shadow-[0_0_12px_rgba(255,179,0,0.35)]"
                              : "bg-white/[0.03] text-foreground border-white/10 hover:border-primary/40 hover:bg-white/[0.06]"
                          }`}
                        >
                          ${preset}
                        </button>
                      );
                    })}
                  </div>
                  <Input
                    id="dep-amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={MIN_DEPOSIT_USD}
                    placeholder={`Or enter a custom amount ($${MIN_DEPOSIT_USD} minimum)`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-white/5 border-white/10 font-mono"
                  />
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-primary/5 border border-primary/15 rounded-md p-2.5">
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                  <span>
                    On submit, NOWPayments generates a unique payment address
                    just for this deposit. Pay any amount up to the quote — your
                    HedgeGate balance updates the moment the network confirms.
                  </span>
                </div>

                {error ? (
                  <div className="flex items-start gap-2 text-sm text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-md p-2.5">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                ) : null}

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="flex-1 border-white/15 hover:bg-white/5"
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating address…
                      </span>
                    ) : (
                      "Generate payment address"
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function ActivePayment({
  deposit,
  copied,
  onCopy,
  onClose,
  onNew,
}: {
  deposit: Deposit;
  copied: boolean;
  onCopy: (value: string) => void;
  onClose: () => void;
  onNew: () => void;
}) {
  const cryptoLabel =
    PAY_CURRENCY_LABEL[deposit.payCurrency] ??
    deposit.payCurrency.toUpperCase();
  const networkLabel = NETWORK_LABELS[deposit.network];
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&bgcolor=0c0c0c&color=ffc107&data=${encodeURIComponent(
    deposit.address,
  )}`;
  const isConfirmed = deposit.status === "CONFIRMED";
  const isFailed = deposit.status === "FAILED";

  if (isConfirmed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="py-2"
      >
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/15 text-primary flex items-center justify-center mb-2">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <DialogTitle className="text-center text-2xl tracking-tight">
            Deposit confirmed
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            ${deposit.amount.toFixed(2)} has been credited to your HedgeGate
            balance.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-5 space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm">
          <Row label="Amount" value={`$${deposit.amount.toFixed(2)}`} mono />
          <Row label="Network" value={networkLabel} />
          {deposit.txHash ? (
            <Row label="Tx hash" value={truncateMid(deposit.txHash, 10, 8)} mono />
          ) : null}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onNew}
            className="flex-1 border-white/15 hover:bg-white/5"
          >
            Make another deposit
          </Button>
          <Button
            type="button"
            onClick={onClose}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            Close
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="py-2"
    >
      <DialogHeader>
        <DialogTitle className="text-2xl tracking-tight flex items-center gap-2">
          <ArrowDownToLine className="w-5 h-5 text-primary" />
          Send {cryptoLabel} to fund ${deposit.amount.toFixed(2)}
        </DialogTitle>
        <DialogDescription className="text-muted-foreground">
          {isFailed
            ? "This payment expired or failed. Generate a new address to try again."
            : "Send the exact crypto amount to the address below. Status updates live."}
        </DialogDescription>
      </DialogHeader>

      {!isFailed && (
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-[#0c0c0c] p-1.5 border border-white/10 shrink-0">
              <img
                src={qrUrl}
                alt="Payment QR code"
                width={108}
                height={108}
                className="rounded"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
                Send exactly
              </div>
              <div className="font-mono text-2xl font-bold text-primary leading-tight break-all">
                {formatCrypto(deposit.payAmount)}{" "}
                <span className="text-base text-foreground">{cryptoLabel}</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onCopy(formatCrypto(deposit.payAmount).toString())
                }
                className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Copy className="w-3 h-3" />
                Copy amount
              </button>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
              {networkLabel} address
            </div>
            <div className="font-mono text-xs text-foreground break-all leading-snug">
              {deposit.address}
            </div>
            <button
              type="button"
              onClick={() => onCopy(deposit.address)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? "Copied" : "Copy address"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm">
        <Row label="USD value" value={`$${deposit.amount.toFixed(2)}`} mono />
        <Row label="Network" value={networkLabel} />
        <Row
          label="Status"
          value={prettyStatus(deposit.rawStatus)}
          highlight={!isFailed}
          danger={isFailed}
        />
      </div>

      {!isFailed ? (
        <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground bg-white/[0.02] border border-white/10 rounded-md p-2.5">
          <Loader2 className="w-4 h-4 mt-0.5 shrink-0 text-amber-400 animate-spin" />
          <span>
            Watching the {cryptoLabel} network for your payment. You can close
            this window — confirmation will appear in your transactions feed.
          </span>
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        {isFailed ? (
          <Button
            type="button"
            onClick={onNew}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            New deposit
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={onNew}
            className="flex-1 border-white/15 hover:bg-white/5"
          >
            New deposit
          </Button>
        )}
        <Button
          type="button"
          onClick={onClose}
          className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
        >
          Close
        </Button>
      </div>
    </motion.div>
  );
}

function Row({
  label,
  value,
  mono,
  highlight,
  danger,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span
        className={`${mono ? "font-mono" : ""} ${
          danger
            ? "text-rose-400 font-semibold"
            : highlight
              ? "text-amber-400 font-semibold"
              : "text-foreground font-medium"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function truncateMid(s: string, head = 8, tail = 6) {
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function formatCrypto(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  if (amount >= 1) return amount.toFixed(4);
  if (amount >= 0.01) return amount.toFixed(6);
  return amount.toFixed(8);
}

function prettyStatus(raw: string): string {
  switch (raw) {
    case "waiting":
      return "Waiting for payment";
    case "confirming":
      return "Confirming on-chain";
    case "confirmed":
      return "Confirmed";
    case "sending":
      return "Settling";
    case "partially_paid":
      return "Partially paid";
    case "finished":
      return "Completed";
    case "failed":
      return "Failed";
    case "refunded":
      return "Refunded";
    case "expired":
      return "Expired";
    default:
      return raw.replace(/_/g, " ");
  }
}
