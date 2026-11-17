import { evaluateDraft } from "@/lib/evaluate";
import type { PostDraft } from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { draft } = (await req.json()) as { draft: PostDraft };
  if (!draft?.text?.trim()) return Response.json({ error: "Cole o texto do post." }, { status: 400 });
  const result = await evaluateDraft(draft);
  return Response.json(result);
}
