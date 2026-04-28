import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import {
  create,
  getById,
  listAll,
  listForUser,
  updateStatus,
  type WithdrawalNetwork,
} from "../lib/withdrawalsStore";

const router: IRouter = Router();

const RAW_ADMIN_KEY = process.env.ADMIN_KEY ?? "";
const ADMIN_KEY = RAW_ADMIN_KEY.trim();

const NETWORKS: WithdrawalNetwork[] = [
  "BTC",
  "ETH",
  "USDT_TRC20",
  "USDT_ERC20",
  "SOL",
];

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!ADMIN_KEY) {
    req.log.error("ADMIN_KEY env var not configured");
    res.status(503).json({
      ok: false,
      error: "Admin console is not configured. Contact the operator.",
    });
    return;
  }
  // Header-only to prevent the key being leaked into request-body logs.
  const submitted = String(req.header("x-admin-key") ?? "").trim();
  if (!submitted || !constantTimeEqual(submitted, ADMIN_KEY)) {
    req.log.warn({ submittedLength: submitted.length }, "Admin auth rejected");
    res.status(401).json({ ok: false, error: "Invalid admin key." });
    return;
  }
  next();
}

router.post("/", async (req, res) => {
  const body = (req.body ?? {}) as {
    userId?: unknown;
    userEmail?: unknown;
    userName?: unknown;
    amount?: unknown;
    address?: unknown;
    network?: unknown;
  };
  const userId = String(body.userId ?? "").trim();
  const userEmail =
    typeof body.userEmail === "string" && body.userEmail.trim()
      ? body.userEmail.trim()
      : null;
  const userName =
    typeof body.userName === "string" && body.userName.trim()
      ? body.userName.trim()
      : null;
  const amountNum = Number(body.amount);
  const address = String(body.address ?? "").trim();
  const network = String(body.network ?? "") as WithdrawalNetwork;

  if (!userId) {
    return res.status(400).json({ ok: false, error: "Missing userId" });
  }
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return res.status(400).json({ ok: false, error: "Invalid amount" });
  }
  if (address.length < 16) {
    return res.status(400).json({ ok: false, error: "Invalid address" });
  }
  if (!NETWORKS.includes(network)) {
    return res.status(400).json({ ok: false, error: "Invalid network" });
  }

  const record = await create({
    userId,
    userEmail,
    userName,
    amount: Number(amountNum.toFixed(2)),
    address,
    network,
  });
  req.log.info(
    { id: record.id, userId, amount: record.amount, network },
    "Withdrawal request created",
  );
  return res.status(201).json({ ok: true, withdrawal: record });
});

router.get("/", async (req, res) => {
  const userId = String(req.query.userId ?? "").trim();
  if (!userId) {
    return res.status(400).json({ ok: false, error: "Missing userId" });
  }
  const items = await listForUser(userId);
  return res.json({ ok: true, withdrawals: items });
});

router.post("/admin/auth", requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

router.get("/admin", requireAdmin, async (_req, res) => {
  const items = await listAll();
  res.json({ ok: true, withdrawals: items });
});

router.post("/admin/:id/approve", requireAdmin, async (req, res) => {
  const id = String(req.params.id ?? "");
  const body = (req.body ?? {}) as { txHash?: unknown; note?: unknown };
  const txHash = typeof body.txHash === "string" ? body.txHash : null;
  const note = typeof body.note === "string" ? body.note : null;
  const existing = await getById(id);
  if (!existing) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  if (existing.status !== "PENDING") {
    return res
      .status(409)
      .json({ ok: false, error: `Already ${existing.status.toLowerCase()}` });
  }
  const updated = await updateStatus(id, "APPROVED", note, txHash);
  req.log.info({ id }, "Withdrawal approved");
  return res.json({ ok: true, withdrawal: updated });
});

router.post("/admin/:id/reject", requireAdmin, async (req, res) => {
  const id = String(req.params.id ?? "");
  const body = (req.body ?? {}) as { reason?: unknown };
  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : "Rejected by administrator";
  const existing = await getById(id);
  if (!existing) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  if (existing.status !== "PENDING") {
    return res
      .status(409)
      .json({ ok: false, error: `Already ${existing.status.toLowerCase()}` });
  }
  const updated = await updateStatus(id, "REJECTED", reason, null);
  req.log.info({ id }, "Withdrawal rejected");
  return res.json({ ok: true, withdrawal: updated });
});

export default router;
