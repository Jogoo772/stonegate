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
  ArrowUpFromLine,
  CheckCircle2,
  AlertCircle,
  Copy,
  Loader2,
} from "lucide-react";
import {
  MIN_DEPOSIT_USD,
  NETWORK_LABELS,
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
  getDepositAddress: (network: WithdrawalNetwork) => string;
  onSubmit: (amount: number, network: WithdrawalNetwork) => DepositResult;
};

export function DepositDialog({
  open,
  onOpenChange,
  getDepositAddress,
  onSubmit,
}: Props) {
  const [network, setNetwork] = useState<WithdrawalNetwork>("USDT_TRC20");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Deposit | null>(null);
  const [copied, setCopied] = useState(false);

  const address = getDepositAddress(network);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&bgcolor=0c0c0c&color=ffc107&data=${encodeURIComponent(
    address,
  )}`;

  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      setAmount("");
      setError(null);
      setPending(null);
    }, 200);
    return () => clearTimeout(t);
  }, [open]);

  const handleCopy = () => {
    void navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numericAmount = Number(amount);
    const res = onSubmit(numericAmount, network);
    if (res.ok) {
      setPending(res.deposit);
    } else {
      setError(res.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0c0c0c] border-white/10 text-foreground sm:max-w-md">
        <AnimatePresence mode="wait">
          {pending ? (
            <motion.div
              key="pending"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-2"
            >
              <DialogHeader>
                <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center mb-2 relative">
                  <Loader2 className="w-7 h-7 animate-spin" />
                </div>
                <DialogTitle className="text-center text-2xl tracking-tight">
                  Awaiting confirmation
                </DialogTitle>
                <DialogDescription className="text-center text-muted-foreground">
                  Your deposit was detected on the network. Funds will be
                  credited automatically once confirmed on-chain.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-5 space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm">
                <Row
                  label="Amount"
                  value={`$${pending.amount.toFixed(2)}`}
                  mono
                />
                <Row
                  label="Network"
                  value={NETWORK_LABELS[pending.network]}
                />
                <Row
                  label="Tx hash"
                  value={truncateMid(pending.txHash, 10, 8)}
                  mono
                />
                <Row label="Status" value="PENDING" highlight />
              </div>
              <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground bg-white/[0.02] border border-white/10 rounded-md p-2.5">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  You can close this window — the deposit will appear in your
                  transactions feed within a few seconds.
                </span>
              </div>
              <Button
                onClick={() => onOpenChange(false)}
                className="w-full mt-4 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              >
                Close
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DialogHeader>
                <DialogTitle className="text-2xl tracking-tight flex items-center gap-2">
                  <ArrowUpFromLine className="w-5 h-5 text-primary" />
                  Deposit funds
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Send crypto to your unique receiving address.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 mt-3">
                <div className="space-y-2">
                  <Label htmlFor="dep-network" className="text-sm">
                    Network
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

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-[#0c0c0c] p-1.5 border border-white/10 shrink-0">
                      <img
                        src={qrUrl}
                        alt="Deposit QR code"
                        width={92}
                        height={92}
                        className="rounded"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
                        Your {NETWORK_LABELS[network]} address
                      </div>
                      <div className="font-mono text-xs text-foreground break-all leading-snug">
                        {address}
                      </div>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copied ? "Copied" : "Copy address"}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                    Send only {NETWORK_LABELS[network]} to this address. Other
                    assets sent here will be lost.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dep-amount" className="text-sm">
                    Amount sent (USD)
                  </Label>
                  <Input
                    id="dep-amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={MIN_DEPOSIT_USD}
                    placeholder={`${MIN_DEPOSIT_USD.toFixed(2)} minimum`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-white/5 border-white/10 font-mono"
                  />
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
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  >
                    I've sent the funds
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

function Row({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span
        className={`${mono ? "font-mono" : ""} ${
          highlight
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
