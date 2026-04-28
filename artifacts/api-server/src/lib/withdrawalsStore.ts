import { promises as fs } from "node:fs";
import path from "node:path";
import { logger } from "./logger";

export type WithdrawalNetwork =
  | "BTC"
  | "ETH"
  | "USDT_TRC20"
  | "USDT_ERC20"
  | "SOL";

export type AdminWithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type WithdrawalRecord = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  amount: number;
  address: string;
  network: WithdrawalNetwork;
  status: AdminWithdrawalStatus;
  requestedAt: number;
  reviewedAt: number | null;
  reviewerNote: string | null;
  txHash: string | null;
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "withdrawals.json");

let cache: WithdrawalRecord[] | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function load(): Promise<WithdrawalRecord[]> {
  if (cache) return cache;
  try {
    await ensureDir();
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    cache = Array.isArray(parsed) ? (parsed as WithdrawalRecord[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      cache = [];
    } else {
      logger.warn({ err }, "Failed to read withdrawals store; starting empty");
      cache = [];
    }
  }
  return cache;
}

async function persist(): Promise<void> {
  if (!cache) return;
  const snapshot = JSON.stringify(cache, null, 2);
  writeChain = writeChain
    .then(async () => {
      await ensureDir();
      const tmp = `${FILE}.tmp`;
      await fs.writeFile(tmp, snapshot, "utf8");
      await fs.rename(tmp, FILE);
    })
    .catch((err) => {
      logger.error({ err }, "Failed to persist withdrawals store");
    });
  await writeChain;
}

export async function listAll(): Promise<WithdrawalRecord[]> {
  const all = await load();
  return [...all].sort((a, b) => b.requestedAt - a.requestedAt);
}

export async function listForUser(
  userId: string,
): Promise<WithdrawalRecord[]> {
  const all = await load();
  return all
    .filter((w) => w.userId === userId)
    .sort((a, b) => b.requestedAt - a.requestedAt);
}

export async function getById(
  id: string,
): Promise<WithdrawalRecord | undefined> {
  const all = await load();
  return all.find((w) => w.id === id);
}

export async function create(
  input: Omit<
    WithdrawalRecord,
    "id" | "status" | "requestedAt" | "reviewedAt" | "reviewerNote" | "txHash"
  >,
): Promise<WithdrawalRecord> {
  const all = await load();
  const now = Date.now();
  const record: WithdrawalRecord = {
    id: `W${now.toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`,
    status: "PENDING",
    requestedAt: now,
    reviewedAt: null,
    reviewerNote: null,
    txHash: null,
    ...input,
  };
  all.unshift(record);
  if (all.length > 1000) all.length = 1000;
  await persist();
  return record;
}

export async function updateStatus(
  id: string,
  status: AdminWithdrawalStatus,
  reviewerNote: string | null,
  txHash: string | null,
): Promise<WithdrawalRecord | null> {
  const all = await load();
  const idx = all.findIndex((w) => w.id === id);
  if (idx === -1) return null;
  const existing = all[idx];
  if (!existing) return null;
  if (existing.status !== "PENDING") return existing;
  const updated: WithdrawalRecord = {
    ...existing,
    status,
    reviewedAt: Date.now(),
    reviewerNote: reviewerNote?.trim() || null,
    txHash: txHash?.trim() || null,
  };
  all[idx] = updated;
  await persist();
  return updated;
}
