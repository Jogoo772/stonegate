import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";

function formatUsd(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function MinimumBalanceDialog({
  open,
  onOpenChange,
  required,
  current,
  onDepositClick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  required: number;
  current: number;
  onDepositClick: () => void;
}) {
  const needed = Math.max(0, Number((required - current).toFixed(2)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0c0c0c] border-white/10 max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-xl sm:text-2xl font-extrabold tracking-tight text-center leading-snug">
            Minimum Trading Balance Required
            <br />
            <span className="text-foreground">for PRO TRADING BOT</span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6">
          <p className="text-sm text-muted-foreground text-center leading-relaxed mt-3 mb-5">
            To start trading with Pro Trading Bot, you need to reach the
            minimum trading balance:
          </p>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-lg bg-white/[0.04] border border-white/10 px-4 py-3.5">
              <span className="text-sm text-foreground/90">
                Minimum Required
              </span>
              <span className="font-mono font-extrabold text-lg text-primary">
                ${formatUsd(required)}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-white/[0.04] border border-white/10 px-4 py-3.5">
              <span className="text-sm text-foreground/90">Current Balance</span>
              <span className="font-mono font-extrabold text-lg text-foreground">
                ${formatUsd(current)}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-rose-500/[0.06] border border-rose-500/30 px-4 py-3.5">
              <span className="text-sm text-rose-200/90">Amount Needed</span>
              <span className="font-mono font-extrabold text-lg text-rose-400">
                ${formatUsd(needed)}
              </span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground text-center leading-relaxed mt-5 mb-5">
            Please deposit the remaining amount to unlock Pro Trading Bot
          </p>

          <div className="space-y-2.5">
            <Button
              onClick={() => {
                onOpenChange(false);
                onDepositClick();
              }}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-12 text-[15px] shadow-[0_0_18px_rgba(255,179,0,0.3)]"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Go to Deposit
            </Button>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="w-full h-11 text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
