import { newId, readDB, updateDB } from "@/lib/db";
import type { Post, PostDraft, Evaluation } from "@/lib/types";

export async function GET() {
  const db = await readDB();
  const posts = [...db.posts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return Response.json({ posts });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    draft: PostDraft;
    evaluation?: Evaluation;
    status?: Post["status"];
    scheduledAt?: string;
    author?: string;
  };
  const now = new Date().toISOString();
  const firstLine = body.draft.text.trim().split("\n")[0]?.slice(0, 80) || "Sem título";
  const sensitive = !!body.evaluation?.sensitive.flag;
  let status = body.status ?? "rascunho";
  if (sensitive && (status === "agendado" || status === "pronto")) status = "em_aprovacao";
  const post: Post = {
    id: newId("post"),
    title: firstLine,
    status,
    versions: [{ id: newId("v"), createdAt: now, draft: body.draft, evaluation: body.evaluation }],
    scheduledAt: body.scheduledAt,
    sensitive,
    author: body.author || "Eu",
    createdAt: now,
    updatedAt: now,
  };
  await updateDB((db) => {
    db.posts.push(post);
  });
  return Response.json({ post });
}
