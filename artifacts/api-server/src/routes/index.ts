import { Router, type IRouter } from "express";
import healthRouter from "./health";
import paymentsRouter from "./payments";
import botRouter from "./bot";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/payments", paymentsRouter);
router.use("/bot", botRouter);

export default router;
