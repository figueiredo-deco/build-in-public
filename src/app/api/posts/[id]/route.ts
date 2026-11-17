import { newId, readDB, updateDB } from "@/lib/db";
import type { Evaluation, Post, PostDraft } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  const db = await readDB();
  const post = db.posts.find((p) => p.id === id);
  return post ? Response.json({ post }) : Response.json({ error: "Post não encontrado" }, { status: 404 });
}

/** Atualiza campos do post e, se vier `draft`, adiciona uma nova versão. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json()) as Partial<Post> & { draft?: PostDraft; evaluation?: Evaluation; approve?: boolean };
  const post = await updateDB((db) => {
    const p = db.posts.find((x) => x.id === id);
    if (!p) return null;
    const now = new Date().toISOString();
    if (body.draft) {
      p.versions.push({ id: newId("v"), createdAt: now, draft: body.draft, evaluation: body.evaluation });
      p.title = body.draft.text.trim().split("\n")[0]?.slice(0, 80) || p.title;
      if (body.evaluation) p.sensitive = body.evaluation.sensitive.flag;
    }
    for (const key of ["status", "scheduledAt", "publishedUrl", "metrics", "theme", "title"] as const) {
      if (key in body) (p as unknown as Record<string, unknown>)[key] = body[key];
    }
    if (body.approve) {
      p.approvedBy = body.approvedBy || "Curador";
      p.status = p.scheduledAt ? "agendado" : "pronto";
    } else if (p.sensitive && !p.approvedBy && (p.status === "agendado" || p.status === "pronto")) {
      p.status = "em_aprovacao";
    }
    p.updatedAt = now;
    return p;
  });
  return post ? Response.json({ post }) : Response.json({ error: "Post não encontrado" }, { status: 404 });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  await updateDB((db) => {
    db.posts = db.posts.filter((p) => p.id !== id);
  });
  return Response.json({ ok: true });
}
