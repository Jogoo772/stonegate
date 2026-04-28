import { promises as fs } from "node:fs";
import path from "node:path";
import { logger } from "./logger";

export type BotActivation = {
  userId: string;
  activatedAt: number;
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "bot-activations.json");

let cache: BotActivation[] | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function load(): Promise<BotActivation[]> {
  if (cache) return cache;
  try {
    await ensureDir();
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    cache = Array.isArray(parsed) ? (parsed as BotActivation[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      cache = [];
    } else {
      logger.warn(
        { err },
        "Failed to read bot activations store; starting empty",
      );
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
      logger.error({ err }, "Failed to persist bot activations store");
    });
  await writeChain;
}

export async function isActivated(userId: string): Promise<boolean> {
  if (!userId) return false;
  const all = await load();
  return all.some((a) => a.userId === userId);
}

export async function recordActivation(userId: string): Promise<void> {
  if (!userId) return;
  const all = await load();
  if (all.some((a) => a.userId === userId)) return;
  all.push({ userId, activatedAt: Date.now() });
  await persist();
}
