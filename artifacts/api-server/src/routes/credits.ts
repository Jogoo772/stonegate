import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import {
  cancel,
  create,
  getById,
  listAll,
  listPendingForUser,
  markApplied,
} from "../lib/creditsStore";

const router: IRouter = Router();

const RAW_ADMIN_KEY = process.env.ADMIN_KEY ?? "";
const ADMIN_KEY = RAW_ADMIN_KEY.trim();

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
  const submitted = String(req.header("x-admin-key") ?? "").trim();
  if (!submitted || !constantTimeEqual(submitted, ADMIN_KEY)) {
    req.log.warn({ submittedLength: submitted.length }, "Admin auth rejected");
    res.status(401).json({ ok: false, error: "Invalid admin key." });
    return;
  }
  next();
}

// User-facing: list pending credits to apply on their device.
router.get("/pending", async (req, res) => {
  const userId = String(req.query.userId ?? "").trim();
  if (!userId) {
    return res.status(400).json({ ok: false, error: "Missing userId" });
  }
  const items = await listPendingForUser(userId);
  return res.json({ ok: true, credits: items });
});

// User-facing: acknowledge that a credit was applied to local balance.
router.post("/:id/ack", async (req, res) => {
  const id = String(req.params.id ?? "");
  const body = (req.body ?? {}) as { userId?: unknown };
  const userId = String(body.userId ?? "").trim();
  if (!userId) {
    return res.status(400).json({ ok: false, error: "Missing userId" });
  }
  const existing = await getById(id);
  if (!existing) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  if (existing.userId !== userId) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  if (existing.status === "CANCELLED") {
    return res
      .status(409)
      .json({ ok: false, error: "Credit was cancelled by admin" });
  }
  if (existing.status === "APPLIED") {
    return res
      .status(409)
      .json({ ok: false, error: "Already applied", credit: existing });
  }
  const updated = await markApplied(id);
  req.log.info({ id, userId }, "Credit acknowledged by user");
  return res.json({ ok: true, credit: updated });
});

// Admin: list all credits.
router.get("/admin", requireAdmin, async (_req, res) => {
  const items = await listAll();
  res.json({ ok: true, credits: items });
});

// Admin: create a new credit (manual balance top-up).
router.post("/admin", requireAdmin, async (req, res) => {
  const body = (req.body ?? {}) as {
    userId?: unknown;
    userEmail?: unknown;
    userName?: unknown;
    amount?: unknown;
    note?: unknown;
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
  const note =
    typeof body.note === "string" && body.note.trim()
      ? body.note.trim().slice(0, 240)
      : null;

  if (!userId) {
    return res.status(400).json({ ok: false, error: "Missing userId" });
  }
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return res
      .status(400)
      .json({ ok: false, error: "Amount must be a positive number" });
  }
  if (amountNum > 1_000_000) {
    return res
      .status(400)
      .json({ ok: false, error: "Amount exceeds maximum" });
  }

  const record = await create({
    userId,
    userEmail,
    userName,
    amount: Number(amountNum.toFixed(2)),
    note,
  });
  req.log.info(
    { id: record.id, userId, amount: record.amount },
    "Admin credit created",
  );
  return res.status(201).json({ ok: true, credit: record });
});

// Admin: cancel a still-pending credit.
router.post("/admin/:id/cancel", requireAdmin, async (req, res) => {
  const id = String(req.params.id ?? "");
  const existing = await getById(id);
  if (!existing) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  if (existing.status !== "PENDING") {
    return res
      .status(409)
      .json({ ok: false, error: `Already ${existing.status.toLowerCase()}` });
  }
  const updated = await cancel(id);
  req.log.info({ id }, "Admin credit cancelled");
  return res.json({ ok: true, credit: updated });
});

export default router;
