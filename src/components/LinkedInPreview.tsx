"use client";
import { Globe, MessageSquare, Repeat2, Send, ThumbsUp } from "lucide-react";
import { useMemo, useState } from "react";
import { computeCut, type Device } from "@/lib/linkedin";
import type { Highlight, PostDraft } from "@/lib/types";
import { initials, useProfile } from "./useProfile";

interface Props {
  draft: PostDraft;
  device: Device;
  highlights?: Highlight[];
  activeQuote?: string | null;
}

type Seg = { text: string; mark?: boolean; active?: boolean };

function segments(text: string, highlights: Highlight[], activeQuote?: string | null): Seg[] {
  const ranges: { start: number; end: number; active: boolean }[] = [];
  for (const h of highlights) {
    const start = text.indexOf(h.quote);
    if (start < 0 || !h.quote) continue;
    const end = start + h.quote.length;
    if (ranges.some((r) => start < r.end && end > r.start)) continue;
    ranges.push({ start, end, active: h.quote === activeQuote });
  }
  ranges.sort((a, b) => a.start - b.start);
  const out: Seg[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) out.push({ text: text.slice(pos, r.start) });
    out.push({ text: text.slice(r.start, r.end), mark: true, active: r.active });
    pos = r.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}

function Rich({ segs }: { segs: Seg[] }) {
  return (
    <>
      {segs.map((s, i) =>
        s.mark ? (
          <mark
            key={i}
            className={`rounded-[3px] px-0.5 ${s.active ? "bg-brand text-brand-foreground" : "bg-yellow-tint text-inherit underline decoration-warning decoration-dotted underline-offset-4"}`}
          >
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

export function LinkedInPreview({ draft, device, highlights = [], activeQuote }: Props) {
  const { profile } = useProfile();
  const [expanded, setExpanded] = useState(false);
  const isArticle = draft.format === "artigo";
  const cut = useMemo(() => computeCut(draft.text, device), [draft.text, device]);
  const width = device === "mobile" ? "max-w-[375px]" : "max-w-[555px]";
  const visibleSegs = segments(cut.visible, highlights, activeQuote);
  const hiddenSegs = segments(draft.text.slice(cut.index), highlights, activeQuote);

  return (
    <div className={`${width} w-full mx-auto overflow-hidden rounded-lg bg-white shadow-edge`} style={{ fontFamily: "-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif" }}>
      <div className="flex gap-2 px-4 pt-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-brand-foreground">{initials(profile.name)}</div>
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-semibold text-[#191919]">{profile.name}</div>
          <div className="truncate text-xs text-[#666]">{profile.headline}</div>
          <div className="flex items-center gap-1 text-xs text-[#666]">agora · <Globe size={11} /></div>
        </div>
      </div>

      {!isArticle && draft.text && (
        <div className="relative px-4 pt-2 pb-1 text-[14px] leading-[20px] text-[#191919] whitespace-pre-wrap break-words">
          <Rich segs={visibleSegs} />
          {cut.truncated && !expanded && (
            <>
              <span className="text-[#666]">…</span>{" "}
              <button onClick={() => setExpanded(true)} className="text-[#666] hover:text-link hover:underline">
                {device === "mobile" ? "mais" : "ver mais"}
              </button>
            </>
          )}
          {cut.truncated && expanded && (
            <>
              <span className="my-1 flex items-center gap-2 text-[11px] font-medium text-warning" style={{ fontFamily: "var(--font-sans)" }}>
                <span className="h-px flex-1 border-t border-dashed border-warning" />
                corte do “ver mais” ({device})
                <span className="h-px flex-1 border-t border-dashed border-warning" />
              </span>
              <Rich segs={hiddenSegs} />
              <button onClick={() => setExpanded(false)} className="mt-1 block text-[#666] hover:underline">ver menos</button>
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
        {[ThumbsUp, MessageSquare, Repeat2, Send].map((Icon, i) => (
          <span key={i} className="flex items-center gap-1.5 rounded px-3 py-2">
            <Icon size={16} />
            {device === "desktop" && ["Gostei", "Comentar", "Compartilhar", "Enviar"][i]}
          </span>
        ))}
      </div>
      {draft.firstComment && (
        <div className="flex gap-2 px-4 pb-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-[10px] font-semibold text-brand-foreground">{initials(profile.name)}</div>
          <div className="rounded-lg bg-[#f2f2f2] px-3 py-2 text-[13px] text-[#191919]">
            <div className="text-xs font-semibold">{profile.name} <span className="font-normal text-[#666]">· Autor</span></div>
            <div className="whitespace-pre-wrap break-words">{draft.firstComment}</div>
          </div>
        </div>
      )}
    </div>
  );
}

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
          <div key={i} className="mb-2 rounded-full border border-[#0a66c2] px-3 py-1.5 text-center font-semibold text-[#0a66c2]">{o}</div>
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
        <span className="absolute inset-0 m-auto grid h-12 w-12 place-items-center rounded-full bg-black/60 text-white">▶</span>
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
