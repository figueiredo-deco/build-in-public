import { newId, readDB, updateDB } from "@/lib/db";
import type { ReferencePost } from "@/lib/types";

export async function GET() {
  const db = await readDB();
  return Response.json({ references: db.references });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Omit<ReferencePost, "id">;
  const ref: ReferencePost = { ...body, id: newId("ref") };
  await updateDB((db) => {
    db.references.unshift(ref);
  });
  return Response.json({ reference: ref });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as Partial<ReferencePost> & { id: string };
  const reference = await updateDB((db) => {
    const r = db.references.find((x) => x.id === body.id);
    if (r) Object.assign(r, body);
    return r ?? null;
  });
  return Response.json({ reference });
}

export async function DELETE(req: Request) {
  const { id } = (await req.json()) as { id: string };
  await updateDB((db) => {
    db.references = db.references.filter((r) => r.id !== id);
  });
  return Response.json({ ok: true });
}
