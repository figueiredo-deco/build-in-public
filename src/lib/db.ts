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
    return withSeedRules(JSON.parse(raw) as DB);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(SEED, null, 2));
    return structuredClone(SEED);
  }
}

/** Adiciona regras novas do seed a um banco existente (só uma vez por regra). */
function withSeedRules(db: DB): DB {
  const applied = new Set(db.appliedSeedRules ?? db.rules.map((r) => r.id));
  let added = 0;
  for (const rule of SEED.rules) {
    if (applied.has(rule.id)) continue;
    if (!db.rules.some((r) => r.id === rule.id)) {
      db.rules.push(structuredClone(rule));
      added += 1;
    }
    applied.add(rule.id);
  }
  db.appliedSeedRules = [...applied];
  if (added) db.playbookVersion += 1;
  return db;
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
