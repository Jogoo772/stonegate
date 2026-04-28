import { promises as fs } from "node:fs";
import path from "node:path";
import { logger } from "./logger";

export type CreditStatus = "PENDING" | "APPLIED" | "CANCELLED";

export type CreditRecord = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  amount: number;
  note: string | null;
  status: CreditStatus;
  createdAt: number;
  appliedAt: number | null;
  cancelledAt: number | null;
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "admin-credits.json");

let cache: CreditRecord[] | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function load(): Promise<CreditRecord[]> {
  if (cache) return cache;
  try {
    await ensureDir();
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    cache = Array.isArray(parsed) ? (parsed as CreditRecord[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      cache = [];
    } else {
      logger.warn({ err }, "Failed to read credits store; starting empty");
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
      logger.error({ err }, "Failed to persist credits store");
    });
  await writeChain;
}

export async function listAll(): Promise<CreditRecord[]> {
  const all = await load();
  return [...all].sort((a, b) => b.createdAt - a.createdAt);
}

export async function listPendingForUser(
  userId: string,
): Promise<CreditRecord[]> {
  const all = await load();
  return all
    .filter((c) => c.userId === userId && c.status === "PENDING")
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function getById(id: string): Promise<CreditRecord | undefined> {
  const all = await load();
  return all.find((c) => c.id === id);
}

export async function create(
  input: Omit<
    CreditRecord,
    "id" | "status" | "createdAt" | "appliedAt" | "cancelledAt"
  >,
): Promise<CreditRecord> {
  const all = await load();
  const now = Date.now();
  const record: CreditRecord = {
    id: `C${now.toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`,
    status: "PENDING",
    createdAt: now,
    appliedAt: null,
    cancelledAt: null,
    ...input,
  };
  all.unshift(record);
  if (all.length > 1000) all.length = 1000;
  await persist();
  return record;
}

export async function markApplied(id: string): Promise<CreditRecord | null> {
  const all = await load();
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const existing = all[idx];
  if (!existing) return null;
  if (existing.status !== "PENDING") return existing;
  const updated: CreditRecord = {
    ...existing,
    status: "APPLIED",
    appliedAt: Date.now(),
  };
  all[idx] = updated;
  await persist();
  return updated;
}

export async function cancel(id: string): Promise<CreditRecord | null> {
  const all = await load();
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const existing = all[idx];
  if (!existing) return null;
  if (existing.status !== "PENDING") return existing;
  const updated: CreditRecord = {
    ...existing,
    status: "CANCELLED",
    cancelledAt: Date.now(),
  };
  all[idx] = updated;
  await persist();
  return updated;
}
