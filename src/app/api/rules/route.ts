import { newId, readDB, updateDB } from "@/lib/db";
import type { Rule } from "@/lib/types";

export async function GET() {
  const db = await readDB();
  return Response.json({ rules: db.rules, playbookVersion: db.playbookVersion });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Omit<Rule, "id">;
  const rule: Rule = { ...body, id: newId("r"), active: body.active ?? true };
  await updateDB((db) => {
    db.rules.push(rule);
    db.playbookVersion += 1;
  });
  return Response.json({ rule });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as Partial<Rule> & { id: string };
  const rule = await updateDB((db) => {
    const r = db.rules.find((x) => x.id === body.id);
    if (!r) return null;
    Object.assign(r, body);
    db.playbookVersion += 1;
    return r;
  });
  return Response.json({ rule });
}

export async function DELETE(req: Request) {
  const { id } = (await req.json()) as { id: string };
  await updateDB((db) => {
    db.rules = db.rules.filter((r) => r.id !== id);
    db.playbookVersion += 1;
  });
  return Response.json({ ok: true });
}
