import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const NOWPAYMENTS_API_BASE =
  process.env.NOWPAYMENTS_API_BASE ?? "https://api.nowpayments.io/v1";

const PAY_CURRENCIES = [
  "btc",
  "eth",
  "sol",
  "usdttrc20",
  "usdterc20",
] as const;

type PayCurrency = (typeof PAY_CURRENCIES)[number];

function isPayCurrency(v: unknown): v is PayCurrency {
  return (
    typeof v === "string" &&
    (PAY_CURRENCIES as readonly string[]).includes(v)
  );
}

type NowPaymentsPayment = {
  payment_id?: string | number;
  payment_status?: string;
  pay_address?: string;
  pay_amount?: number;
  pay_currency?: string;
  price_amount?: number;
  price_currency?: string;
  order_id?: string | null;
  order_description?: string | null;
  payin_extra_id?: string | null;
  payin_hash?: string | null;
  actually_paid?: number | null;
  outcome_amount?: number | null;
  created_at?: string;
  updated_at?: string;
  expiration_estimate_date?: string;
  message?: string;
  code?: string;
  errors?: unknown;
};

async function callNowPayments(
  path: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; data: NowPaymentsPayment | null; raw: string }> {
  const apiKey = process.env["NOWPAYMENTS_API_KEY"];
  if (!apiKey) {
    return { ok: false, status: 500, data: null, raw: "missing-api-key" };
  }
  const headers = new Headers(init.headers);
  headers.set("x-api-key", apiKey);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const r = await fetch(`${NOWPAYMENTS_API_BASE}${path}`, {
    ...init,
    headers,
  });
  const raw = await r.text();
  let data: NowPaymentsPayment | null = null;
  try {
    data = raw ? (JSON.parse(raw) as NowPaymentsPayment) : null;
  } catch {
    data = null;
  }
  return { ok: r.ok, status: r.status, data, raw };
}

router.post("/create", async (req, res) => {
  if (!process.env["NOWPAYMENTS_API_KEY"]) {
    res.status(500).json({ error: "Payment provider not configured" });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const priceAmount = Number(body["priceAmount"]);
  const payCurrency = body["payCurrency"];
  const orderId =
    typeof body["orderId"] === "string"
      ? (body["orderId"] as string).slice(0, 80)
      : undefined;
  const description =
    typeof body["description"] === "string"
      ? (body["description"] as string).slice(0, 120)
      : "HedgeGate deposit";

  if (!Number.isFinite(priceAmount) || priceAmount <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }
  if (!isPayCurrency(payCurrency)) {
    res.status(400).json({ error: "Unsupported pay currency" });
    return;
  }

  try {
    const { ok, status, data, raw } = await callNowPayments("/payment", {
      method: "POST",
      body: JSON.stringify({
        price_amount: priceAmount,
        price_currency: "usd",
        pay_currency: payCurrency,
        order_id: orderId,
        order_description: description,
      }),
    });

    if (!ok || !data || !data.payment_id || !data.pay_address) {
      const message =
        data?.message ||
        data?.code ||
        `Payment provider error (${status})`;
      logger.warn(
        { status, raw: raw.slice(0, 500) },
        "NOWPayments create failed",
      );
      res.status(status >= 400 && status < 600 ? status : 502).json({
        error: humanizeProviderError(message),
      });
      return;
    }

    res.json({
      paymentId: String(data.payment_id),
      paymentStatus: String(data.payment_status ?? "waiting"),
      payAddress: String(data.pay_address),
      payAmount: Number(data.pay_amount ?? 0),
      payCurrency: String(data.pay_currency ?? payCurrency),
      priceAmount: Number(data.price_amount ?? priceAmount),
      priceCurrency: String(data.price_currency ?? "usd"),
      orderId: data.order_id ? String(data.order_id) : null,
      payinExtraId: data.payin_extra_id ? String(data.payin_extra_id) : null,
      createdAt: data.created_at ?? null,
      expirationEstimateDate: data.expiration_estimate_date ?? null,
    });
  } catch (err) {
    logger.error({ err }, "NOWPayments create error");
    res.status(502).json({ error: "Failed to reach payment provider" });
  }
});

router.get("/:id/status", async (req, res) => {
  if (!process.env["NOWPAYMENTS_API_KEY"]) {
    res.status(500).json({ error: "Payment provider not configured" });
    return;
  }

  const id = req.params["id"];
  if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    res.status(400).json({ error: "Invalid payment id" });
    return;
  }

  try {
    const { ok, status, data, raw } = await callNowPayments(
      `/payment/${encodeURIComponent(id)}`,
      { method: "GET" },
    );

    if (!ok || !data || !data.payment_id) {
      logger.warn(
        { status, raw: raw.slice(0, 300) },
        "NOWPayments status failed",
      );
      res
        .status(status >= 400 && status < 600 ? status : 502)
        .json({ error: data?.message ?? `Provider error (${status})` });
      return;
    }

    res.json({
      paymentId: String(data.payment_id),
      paymentStatus: String(data.payment_status ?? "waiting"),
      payAmount: Number(data.pay_amount ?? 0),
      actuallyPaid:
        data.actually_paid != null ? Number(data.actually_paid) : 0,
      payCurrency: String(data.pay_currency ?? ""),
      payAddress: String(data.pay_address ?? ""),
      priceAmount: Number(data.price_amount ?? 0),
      outcomeAmount:
        data.outcome_amount != null ? Number(data.outcome_amount) : null,
      txHash: data.payin_hash ? String(data.payin_hash) : null,
      updatedAt: data.updated_at ?? null,
    });
  } catch (err) {
    logger.error({ err }, "NOWPayments status error");
    res.status(502).json({ error: "Failed to reach payment provider" });
  }
});

router.get("/health", async (_req, res) => {
  if (!process.env["NOWPAYMENTS_API_KEY"]) {
    res.json({ configured: false });
    return;
  }
  try {
    const r = await fetch(`${NOWPAYMENTS_API_BASE}/status`);
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    res.json({ configured: true, providerStatus: body?.["message"] ?? null });
  } catch {
    res.json({ configured: true, providerStatus: null });
  }
});

function humanizeProviderError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("amount") && lower.includes("min")) {
    return "Amount is below the network minimum. Try a larger amount.";
  }
  if (lower.includes("invalid") && lower.includes("currency")) {
    return "That currency isn't available on your account.";
  }
  if (lower.includes("auth") || lower.includes("unauthorized")) {
    return "Payment provider rejected the request. Check your API key.";
  }
  return raw;
}

export default router;
