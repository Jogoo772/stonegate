import { promises as fs } from "node:fs";
import path from "node:path";

import { listAll as listAllCredits } from "./creditsStore";
import { listAll as listAllWithdrawals } from "./withdrawalsStore";

const DATA_DIR =
  process.env["STONEGATE_DATA_DIR"] ??
  path.resolve(process.cwd(), "data");

const BACKUP_DIR =
  process.env["STONEGATE_BACKUP_DIR"] ?? "/root/stonegate-backups";

const OFFSITE_LOG =
  process.env["STONEGATE_OFFSITE_LOG"] ?? path.join(BACKUP_DIR, "offsite.log");

const PROCESS_STARTED_AT = Date.now();

export type SystemStatus = {
  apiOk: true;
  uptimeSeconds: number;
  serverTime: number;
  dataDir: string;
  dataDirBytes: number;
  dataDirFiles: number;
  pendingWithdrawals: number;
  pendingCredits: number;
  backup: {
    dir: string;
    latestFilename: string | null;
    latestAt: number | null;
    latestBytes: number | null;
    totalBackups: number;
    offsiteLastUploadAt: number | null;
    offsiteLastStatus: "ok" | "failed" | null;
  };
};

const MAX_DIR_DEPTH = 6;
const MAX_DIR_ENTRIES = 10_000;

async function dirSize(
  dir: string,
  depth = 0,
  budget = { remaining: MAX_DIR_ENTRIES },
): Promise<{ bytes: number; files: number }> {
  let bytes = 0;
  let files = 0;
  if (depth > MAX_DIR_DEPTH) return { bytes, files };
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (budget.remaining <= 0) break;
      budget.remaining -= 1;
      const full = path.join(dir, entry.name);
      // isFile()/isDirectory() do not follow symlinks, so circular links are skipped.
      if (entry.isFile()) {
        try {
          const st = await fs.stat(full);
          bytes += st.size;
          files += 1;
        } catch {
          // skip unreadable file
        }
      } else if (entry.isDirectory()) {
        const sub = await dirSize(full, depth + 1, budget);
        bytes += sub.bytes;
        files += sub.files;
      }
    }
  } catch {
    // missing dir is fine — return zeros
  }
  return { bytes, files };
}

// Read only the last `maxBytes` of a (potentially huge) text file.
async function tailFile(filePath: string, maxBytes = 16 * 1024): Promise<string> {
  let fh: import("node:fs/promises").FileHandle | null = null;
  try {
    fh = await fs.open(filePath, "r");
    const st = await fh.stat();
    const start = Math.max(0, st.size - maxBytes);
    const length = st.size - start;
    if (length <= 0) return "";
    const buf = Buffer.alloc(length);
    await fh.read(buf, 0, length, start);
    return buf.toString("utf8");
  } finally {
    if (fh) await fh.close().catch(() => undefined);
  }
}

async function inspectBackups(): Promise<SystemStatus["backup"]> {
  const result: SystemStatus["backup"] = {
    dir: BACKUP_DIR,
    latestFilename: null,
    latestAt: null,
    latestBytes: null,
    totalBackups: 0,
    offsiteLastUploadAt: null,
    offsiteLastStatus: null,
  };

  // Local tarballs.
  try {
    const entries = await fs.readdir(BACKUP_DIR);
    const tars = entries.filter(
      (n) => n.startsWith("data-") && n.endsWith(".tgz"),
    );
    result.totalBackups = tars.length;
    if (tars.length > 0) {
      let newest: { name: string; mtime: number; size: number } | null = null;
      for (const name of tars) {
        try {
          const st = await fs.stat(path.join(BACKUP_DIR, name));
          if (!newest || st.mtimeMs > newest.mtime) {
            newest = { name, mtime: st.mtimeMs, size: st.size };
          }
        } catch {
          // skip files we can't stat
        }
      }
      if (newest) {
        result.latestFilename = newest.name;
        result.latestAt = Math.round(newest.mtime);
        result.latestBytes = newest.size;
      }
    }
  } catch {
    // backup dir missing — leave zeros
  }

  // Off-site upload log (best-effort: read tail and look for ok / FAILED).
  // We deliberately tail the file rather than read it whole — backup logs grow
  // forever and the API server polls this every 10s per open admin tab.
  try {
    const raw = await tailFile(OFFSITE_LOG);
    const lines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    // Walk backwards looking for last "upload ok" or "upload FAILED".
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i] ?? "";
      const tsMatch = line.match(/^\[([^\]]+)\]/);
      if (!tsMatch) continue;
      const ts = Date.parse(tsMatch[1] ?? "");
      if (!Number.isFinite(ts)) continue;
      if (line.includes("upload ok")) {
        result.offsiteLastUploadAt = ts;
        result.offsiteLastStatus = "ok";
        break;
      }
      if (line.includes("upload FAILED")) {
        result.offsiteLastUploadAt = ts;
        result.offsiteLastStatus = "failed";
        break;
      }
    }
  } catch {
    // no log file — off-site backups likely not configured
  }

  return result;
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const [size, backup, withdrawals, credits] = await Promise.all([
    dirSize(DATA_DIR),
    inspectBackups(),
    listAllWithdrawals(),
    listAllCredits(),
  ]);

  return {
    apiOk: true,
    uptimeSeconds: Math.round((Date.now() - PROCESS_STARTED_AT) / 1000),
    serverTime: Date.now(),
    dataDir: DATA_DIR,
    dataDirBytes: size.bytes,
    dataDirFiles: size.files,
    pendingWithdrawals: withdrawals.filter((w) => w.status === "PENDING").length,
    pendingCredits: credits.filter((c) => c.status === "PENDING").length,
    backup,
  };
}
