import { Router, type IRouter } from "express";
import healthRouter from "./health";
import paymentsRouter from "./payments";
import botRouter from "./bot";
import withdrawalsRouter from "./withdrawals";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/payments", paymentsRouter);
router.use("/bot", botRouter);
router.use("/withdrawals", withdrawalsRouter);

export default router;
