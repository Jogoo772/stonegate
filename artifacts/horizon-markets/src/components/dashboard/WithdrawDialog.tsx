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
  Wallet,
  Copy,
} from "lucide-react";
import {
  MIN_WITHDRAWAL_USD,
  NETWORK_LABELS,
  type Withdrawal,
  type WithdrawalNetwork,
  type WithdrawResult,
} from "@/hooks/useTradingBot";

const NETWORK_VALUES: WithdrawalNetwork[] = [
  "BTC",
  "ETH",
  "USDT_TRC20",
  "USDT_ERC20",
  "SOL",
];

const NETWORK_FEES: Record<WithdrawalNetwork, number> = {
  BTC: 2.5,
  ETH: 3.0,
  USDT_TRC20: 1.0,
  USDT_ERC20: 4.0,
  SOL: 0.5,
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance: number;
  onSubmit: (
    amount: number,
    address: string,
    network: WithdrawalNetwork,
  ) => WithdrawResult;
};

export function WithdrawDialog({
  open,
  onOpenChange,
  balance,
  onSubmit,
}: Props) {
  const [network, setNetwork] = useState<WithdrawalNetwork>("USDT_TRC20");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Withdrawal | null>(null);

  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      setAmount("");
      setAddress("");
      setError(null);
      setSuccess(null);
    }, 200);
    return () => clearTimeout(t);
  }, [open]);

  const numericAmount = Number(amount);
  const fee = NETWORK_FEES[network];
  const willReceive = Number.isFinite(numericAmount)
    ? Math.max(0, numericAmount - fee)
    : 0;

  const handleMax = () => {
    if (balance > 0) {
      setAmount(balance.toFixed(2));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = onSubmit(numericAmount, address, network);
    if (res.ok) {
      setSuccess(res.withdrawal);
    } else {
      setError(res.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0c0c0c] border-white/10 text-foreground sm:max-w-md">
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
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
                  Withdrawal requested
                </DialogTitle>
                <DialogDescription className="text-center text-muted-foreground">
                  Your request is queued for processing. Funds typically arrive
                  within 10–60 minutes after on-chain confirmation.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-5 space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm">
                <Row
                  label="Amount"
                  value={`$${success.amount.toFixed(2)}`}
                  mono
                />
                <Row
                  label="Network"
                  value={NETWORK_LABELS[success.network]}
                />
                <Row
                  label="Destination"
                  value={truncateMid(success.address, 10, 8)}
                  mono
                  copy={success.address}
                />
                <Row label="Status" value="PENDING" highlight />
              </div>
              <Button
                onClick={() => onOpenChange(false)}
                className="w-full mt-5 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              >
                Done
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
                  <ArrowDownToLine className="w-5 h-5 text-primary" />
                  Withdraw funds
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Send your settled balance to an external wallet.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 mb-5 p-4 rounded-lg bg-primary/[0.06] border border-primary/15 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">
                    Available balance
                  </div>
                  <div className="text-xl font-black font-mono">
                    ${balance.toFixed(2)}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="network" className="text-sm">
                    Network
                  </Label>
                  <Select
                    value={network}
                    onValueChange={(v) =>
                      setNetwork(v as WithdrawalNetwork)
                    }
                  >
                    <SelectTrigger
                      id="network"
                      className="bg-white/5 border-white/10 hover:bg-white/10"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111] border-white/10 text-foreground">
                      {NETWORK_VALUES.map((n) => (
                        <SelectItem key={n} value={n}>
                          <span className="flex items-center justify-between gap-3 w-full">
                            <span>{NETWORK_LABELS[n]}</span>
                            <span className="text-xs text-muted-foreground">
                              fee ${NETWORK_FEES[n].toFixed(2)}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className="text-sm">
                    Destination wallet address
                  </Label>
                  <Input
                    id="address"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={addressPlaceholder(network)}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="bg-white/5 border-white/10 font-mono text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="amount" className="text-sm">
                      Amount (USD)
                    </Label>
                    <button
                      type="button"
                      onClick={handleMax}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Use max
                    </button>
                  </div>
                  <Input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={MIN_WITHDRAWAL_USD}
                    placeholder={`${MIN_WITHDRAWAL_USD.toFixed(2)} minimum`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-white/5 border-white/10 font-mono"
                  />
                </div>

                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-1.5 text-sm">
                  <Row
                    label="Network fee"
                    value={`$${fee.toFixed(2)}`}
                    mono
                    muted
                  />
                  <Row
                    label="You will receive"
                    value={`$${willReceive.toFixed(2)}`}
                    mono
                    highlight
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
                    disabled={balance <= 0}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold disabled:opacity-50"
                  >
                    Withdraw
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                  Double-check the address — blockchain transactions are
                  irreversible.
                </p>
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
  muted,
  highlight,
  copy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
  highlight?: boolean;
  copy?: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!copy) return;
    void navigator.clipboard.writeText(copy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span
        className={`flex items-center gap-2 ${mono ? "font-mono" : ""} ${
          highlight
            ? "text-primary font-semibold"
            : muted
              ? "text-muted-foreground"
              : "text-foreground font-medium"
        }`}
      >
        {value}
        {copy ? (
          <button
            type="button"
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Copy address"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? (
              <span className="sr-only">Copied</span>
            ) : null}
          </button>
        ) : null}
      </span>
    </div>
  );
}

function truncateMid(s: string, head = 8, tail = 6) {
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function addressPlaceholder(n: WithdrawalNetwork) {
  switch (n) {
    case "BTC":
      return "bc1q… or 1… / 3…";
    case "ETH":
    case "USDT_ERC20":
      return "0x…";
    case "USDT_TRC20":
      return "T…";
    case "SOL":
      return "Solana wallet address";
  }
}
