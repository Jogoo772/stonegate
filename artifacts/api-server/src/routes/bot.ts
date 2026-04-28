import { Router, type IRouter } from "express";

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

router.post("/upload", (req, res) => {
  if (!EXPECTED_KEY) {
    req.log.error(
      "BOT_UNLOCK_KEY env var is not configured; bot uploads are disabled",
    );
    return res.status(503).json({
      ok: false,
      error: "Bot upload service is not configured. Contact the administrator.",
    });
  }

  const body = req.body as unknown;
  const submitted =
    body && typeof body === "object" && "key" in body
      ? String((body as { key: unknown }).key ?? "").trim()
      : "";

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

  return res.json({ ok: true });
});

router.get("/health", (_req, res) => {
  res.json({ configured: Boolean(EXPECTED_KEY) });
});

export default router;
