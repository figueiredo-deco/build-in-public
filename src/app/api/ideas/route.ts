import { newId, readDB, updateDB } from "@/lib/db";

export async function GET() {
  const db = await readDB();
  return Response.json({ ideas: db.ideas });
}

export async function POST(req: Request) {
  const { text } = (await req.json()) as { text: string };
  const idea = { id: newId("idea"), text, createdAt: new Date().toISOString() };
  await updateDB((db) => {
    db.ideas.unshift(idea);
  });
  return Response.json({ idea });
}

export async function DELETE(req: Request) {
  const { id } = (await req.json()) as { id: string };
  await updateDB((db) => {
    db.ideas = db.ideas.filter((i) => i.id !== id);
  });
  return Response.json({ ok: true });
}
