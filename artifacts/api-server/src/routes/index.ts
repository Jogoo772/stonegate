import { Router, type IRouter } from "express";
import healthRouter from "./health";
import paymentsRouter from "./payments";
import botRouter from "./bot";
import withdrawalsRouter from "./withdrawals";
import creditsRouter from "./credits";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/payments", paymentsRouter);
router.use("/bot", botRouter);
router.use("/withdrawals", withdrawalsRouter);
router.use("/credits", creditsRouter);

export default router;
