import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { getSystemStatus } from "../lib/systemStatus";

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
    req.log.warn(
      { submittedLength: submitted.length },
      "Admin status auth rejected",
    );
    res.status(401).json({ ok: false, error: "Invalid admin key." });
    return;
  }
  next();
}

router.get("/", requireAdmin, async (_req, res) => {
  const status = await getSystemStatus();
  res.json({ ok: true, status });
});

export default router;
