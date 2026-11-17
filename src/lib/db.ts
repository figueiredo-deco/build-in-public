import { promises as fs } from "fs";
import path from "path";
import { SEED } from "./seed";
import type { DB } from "./types";

// Armazenamento em arquivo JSON para o MVP (um processo, time pequeno).
// Trocar por Postgres quando for hospedado para o time inteiro.
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

let queue: Promise<unknown> = Promise.resolve();

export async function readDB(): Promise<DB> {
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    return JSON.parse(raw) as DB;
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(SEED, null, 2));
    return structuredClone(SEED);
  }
}

/** Lê, aplica a mudança e grava, em fila, para não perder escritas concorrentes. */
export function updateDB<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await readDB();
    const result = await fn(db);
    await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
