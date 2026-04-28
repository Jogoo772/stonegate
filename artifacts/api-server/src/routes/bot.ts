import { Router, type IRouter } from "express";
import {
  isActivated,
  recordActivation,
} from "../lib/botActivationsStore";

const router: IRouter = Router();

const RAW_KEY = process.env.BOT_UNLOCK_KEY ?? "";
const EXPECTED_KEY = RAW_KEY.trim();

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

router.post("/upload", async (req, res) => {
  if (!EXPECTED_KEY) {
    req.log.error(
      "BOT_UNLOCK_KEY env var is not configured; bot uploads are disabled",
    );
    return res.status(503).json({
      ok: false,
      error: "Bot upload service is not configured. Contact the administrator.",
    });
  }

  const body = (req.body ?? {}) as { key?: unknown; userId?: unknown };
  const submitted =
    typeof body.key === "string" ? body.key.trim() : "";
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";

  if (!submitted) {
    return res
      .status(400)
      .json({ ok: false, error: "Enter the bot pass key." });
  }

  if (!constantTimeEqual(submitted, EXPECTED_KEY)) {
    req.log.warn({ submittedLength: submitted.length }, "Bot upload rejected");
    return res.status(401).json({
      ok: false,
      error:
        "Invalid pass key. Contact the HedgeGate administrator to obtain a valid key.",
    });
  }

  if (userId) {
    try {
      await recordActivation(userId);
      req.log.info({ userId }, "Bot activation recorded");
    } catch (err) {
      req.log.warn({ err, userId }, "Failed to record bot activation");
    }
  }

  return res.json({ ok: true });
});

router.get("/activated", async (req, res) => {
  const userId = String(req.query.userId ?? "").trim();
  if (!userId) {
    return res.status(400).json({ ok: false, error: "userId required" });
  }
  const activated = await isActivated(userId);
  return res.json({ ok: true, activated });
});

router.get("/health", (_req, res) => {
  res.json({ configured: Boolean(EXPECTED_KEY) });
});

export default router;
