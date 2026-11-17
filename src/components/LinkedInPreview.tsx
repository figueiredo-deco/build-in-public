"use client";
import { Globe02, MessageSquare01, Repeat01, Send01, ThumbsUp } from "@untitledui/icons";
import { forwardRef, useMemo, useState } from "react";
import { computeCut, type Device } from "@/lib/linkedin";
import type { PostDraft } from "@/lib/types";
import { DecoLogo } from "./DecoLogo";
import { initials, useProfile } from "./useProfile";

/** Um trecho do texto marcado no preview, ligado a uma caixinha de comentário. */
export interface Mark {
  id: string;
  start: number;
  end: number;
  kind: "issue" | "pending" | "applied" | "hook";
}

interface Props {
  draft: PostDraft;
  device: Device;
  marks?: Mark[];
  activeId?: string | null;
  onMarkHover?: (id: string | null) => void;
  /** Mostra o texto inteiro com a linha do corte; false mostra como no feed. */
  expanded?: boolean;
}

const PRIORITY: Record<Mark["kind"], number> = { applied: 0, pending: 1, hook: 2, issue: 3 };

const KIND_CLASS: Record<Mark["kind"], string> = {
  issue: "bg-warning/12 underline decoration-warning/70 decoration-dotted underline-offset-4",
  hook: "bg-special/10 underline decoration-special/60 decoration-dotted underline-offset-4",
  pending: "bg-notice/10 underline decoration-notice/60 decoration-dashed underline-offset-4",
  applied: "bg-success/15 bip-flash",
};

type Piece = { type: "text"; text: string; mark?: Mark } | { type: "cut" };

/** Quebra o texto em pedaços marcados/não marcados e insere a linha do corte. */
function pieces(text: string, marks: Mark[], cutIndex: number | null): Piece[] {
  const chosen: Mark[] = [];
  for (const m of [...marks].sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])) {
    if (m.start < 0 || m.end <= m.start || m.end > text.length) continue;
    if (chosen.some((c) => m.start < c.end && m.end > c.start)) continue;
    chosen.push(m);
  }
  chosen.sort((a, b) => a.start - b.start);
  const cuts = new Set<number>([0, text.length]);
  for (const m of chosen) cuts.add(m.start).add(m.end);
  if (cutIndex !== null) cuts.add(cutIndex);
  const points = [...cuts].sort((a, b) => a - b);
  const out: Piece[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    if (cutIndex === a && a > 0) out.push({ type: "cut" });
    const mark = chosen.find((m) => m.start <= a && m.end >= b);
    out.push({ type: "text", text: text.slice(a, b), mark });
  }
  return out;
}

export const LinkedInPreview = forwardRef<HTMLDivElement, Props>(function LinkedInPreview(
  { draft, device, marks = [], activeId, onMarkHover, expanded = false },
  ref,
) {
  const { profile } = useProfile();
  const [openInFeed, setOpenInFeed] = useState(false);
  const isArticle = draft.format === "artigo";
  const cut = useMemo(() => computeCut(draft.text, device), [draft.text, device]);
  const width = device === "mobile" ? "max-w-[375px]" : "max-w-[555px]";
  const showAll = expanded || openInFeed || !cut.truncated;
  const text = showAll ? draft.text : cut.visible;
  const list = pieces(text, marks, expanded && cut.truncated ? cut.index : null);
  const isCompany = draft.channel === "empresa";

  return (
    <div ref={ref} className={`${width} w-full overflow-hidden rounded-lg bg-white card-shadow`} style={{ fontFamily: "-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif" }}>
      <div className="flex gap-2 px-4 pt-3">
        {isCompany ? (
          <div className="grid size-12 shrink-0 place-items-center rounded-md bg-[#0a0a09]">
            <DecoLogo className="h-4 w-auto" />
          </div>
        ) : (
          <div className="grid size-12 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-brand-foreground">{initials(profile.name)}</div>
        )}
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-semibold text-[#191919]">{isCompany ? "deco.cx" : profile.name}</div>
          <div className="truncate text-xs text-[#666]">{isCompany ? "Página da empresa" : profile.headline}</div>
          <div className="flex items-center gap-1 text-xs text-[#666]">
            agora · <Globe02 className="size-3" />
          </div>
        </div>
      </div>

      {!isArticle && draft.text && (
        <div className="px-4 pt-2 pb-1 text-[14px] leading-[20px] whitespace-pre-wrap break-words text-[#191919]">
          {list.map((p, i) =>
            p.type === "cut" ? (
              <span key={`cut-${i}`} className="my-1.5 flex items-center gap-2 text-[11px] font-medium whitespace-nowrap text-warning" style={{ fontFamily: "var(--font-sans)" }}>
                <span className="h-px flex-1 border-t border-dashed border-warning" />
                corte do “ver mais” no {device}
                <span className="h-px flex-1 border-t border-dashed border-warning" />
              </span>
            ) : p.mark ? (
              <mark
                key={`${p.mark.id}-${i}`}
                data-anno={p.mark.id}
                onMouseEnter={() => onMarkHover?.(p.mark!.id)}
                onMouseLeave={() => onMarkHover?.(null)}
                className={`rounded-[3px] px-px text-inherit transition-[background-color,box-shadow] duration-200 ${KIND_CLASS[p.mark.kind]} ${activeId === p.mark.id ? "ring-2 ring-foreground/25" : ""}`}
              >
                {p.text}
              </mark>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )}
          {!expanded && cut.truncated && (
            <>
              {!openInFeed && <span className="text-[#666]">… </span>}
              <button onClick={() => setOpenInFeed((o) => !o)} className="text-[#666] hover:text-link hover:underline">
                {openInFeed ? " ver menos" : device === "mobile" ? "mais" : "ver mais"}
              </button>
            </>
          )}
        </div>
      )}

      <Media draft={draft} />

      <div className="mx-4 flex items-center justify-between border-b border-[#e8e8e8] py-2 text-xs text-[#666]">
        <span>👍 💡 ❤️</span>
        <span>{draft.firstComment ? "1 comentário" : "0 comentários"}</span>
      </div>
      <div className="flex justify-around px-2 py-1 text-xs font-semibold text-[#666]">
        {[ThumbsUp, MessageSquare01, Repeat01, Send01].map((Icon, i) => (
          <span key={i} className="flex items-center gap-1.5 rounded px-3 py-2">
            <Icon className="size-4" />
            {device === "desktop" && ["Gostei", "Comentar", "Compartilhar", "Enviar"][i]}
          </span>
        ))}
      </div>
      {draft.firstComment && (
        <div className="flex gap-2 px-4 pb-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-[10px] font-semibold text-brand-foreground">{isCompany ? "d" : initials(profile.name)}</div>
          <div className="rounded-lg bg-[#f2f2f2] px-3 py-2 text-[13px] text-[#191919]">
            <div className="text-xs font-semibold">
              {isCompany ? "deco.cx" : profile.name} <span className="font-normal text-[#666]">· Autor</span>
            </div>
            <div className="whitespace-pre-wrap break-words">{draft.firstComment}</div>
          </div>
        </div>
      )}
    </div>
  );
});

function Media({ draft }: { draft: PostDraft }) {
  const [page, setPage] = useState(0);
  const imgs = draft.images;
  if (draft.format === "enquete") {
    const opts = (draft.pollOptions ?? []).filter(Boolean);
    return (
      <div className="mx-4 my-2 rounded-lg border border-[#e0e0e0] p-3 text-sm">
        <div className="font-semibold text-[#191919]">{draft.pollQuestion || "Pergunta da enquete"}</div>
        <div className="mb-2 text-xs text-[#666]">Você pode ver como as pessoas votam.</div>
        {(opts.length ? opts : ["Opção 1", "Opção 2"]).map((o, i) => (
          <div key={i} className="mb-2 rounded-full border border-[#0a66c2] px-3 py-1.5 text-center font-semibold text-[#0a66c2]">
            {o}
          </div>
        ))}
      </div>
    );
  }
  if (draft.format === "artigo") {
    return (
      <div className="mt-2 border-y border-[#e8e8e8]">
        {imgs[0] ? <img src={imgs[0]} alt="" className="aspect-[1.91/1] w-full object-cover" /> : <div className="aspect-[1.91/1] w-full bg-muted" />}
        <div className="bg-[#f9fafb] px-4 py-2">
          <div className="text-sm font-semibold text-[#191919]">{draft.articleTitle || "Título do artigo"}</div>
          <div className="text-xs text-[#666]">Artigo · leitura de {Math.max(1, Math.round(draft.text.split(/\s+/).length / 200))} min</div>
        </div>
      </div>
    );
  }
  if (!imgs.length) {
    if (draft.format === "video") return <div className="mt-2 grid aspect-video place-items-center bg-[#1b1f23] text-xs text-white/70">Vídeo (adicione a capa)</div>;
    return null;
  }
  if (draft.format === "carrossel") {
    return (
      <div className="relative mt-2 bg-[#f3f2ef]">
        <img src={imgs[page]} alt="" className="aspect-[4/5] w-full object-contain" />
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))}>‹</button>
          {page + 1} / {imgs.length}
          <button onClick={() => setPage((p) => Math.min(imgs.length - 1, p + 1))}>›</button>
        </div>
      </div>
    );
  }
  if (draft.format === "video") {
    return (
      <div className="relative mt-2">
        <img src={imgs[0]} alt="" className="aspect-video w-full object-cover" />
        <span className="absolute inset-0 m-auto grid size-12 place-items-center rounded-full bg-black/60 text-white">▶</span>
      </div>
    );
  }
  if (imgs.length === 1) return <img src={imgs[0]} alt="" className="mt-2 max-h-[560px] w-full object-cover" />;
  return (
    <div className="mt-2 grid grid-cols-2 gap-0.5">
      {imgs.slice(0, 4).map((src, i) => (
        <img key={i} src={src} alt="" className="aspect-square w-full object-cover" />
      ))}
    </div>
  );
}
