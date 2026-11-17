"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Calendar, Check, ChevronDown, ImagePlus, Loader2, RotateCcw, Save, ShieldAlert, Sparkles, Wand2, X } from "lucide-react";
import { LinkedInPreview } from "./LinkedInPreview";
import { PageHeader, ScorePill, ScoreRing, SeverityChip, Tabs, formatDate, scoreColor, toLocalInput } from "./ui";
import { useProfile } from "./useProfile";
import { computeCut, type Device } from "@/lib/linkedin";
import {
  BAND_LABEL,
  CRITERIA,
  FORMAT_LABEL,
  type Evaluation,
  type Goal,
  type Post,
  type PostDraft,
  type PostFormat,
  type ReferencePost,
} from "@/lib/types";

const EMPTY: PostDraft = { text: "", format: "texto", images: [], firstComment: "", pollOptions: ["", ""] };

async function fileToDataUrl(file: File): Promise<string> {
  const url = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  // Reduz imagens grandes para no máximo 1600px (mantém o banco leve e a chamada à IA rápida).
  const img = new Image();
  img.src = url;
  await img.decode().catch(() => undefined);
  const max = 1600;
  if (!img.width || (img.width <= max && img.height <= max && file.size < 1_500_000)) return url;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function Evaluator() {
  const params = useSearchParams();
  const router = useRouter();
  const postId = params.get("post");
  const { profile } = useProfile();

  const [draft, setDraft] = useState<PostDraft>(EMPTY);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluatedText, setEvaluatedText] = useState("");
  const [notice, setNotice] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>("mobile");
  const [activeQuote, setActiveQuote] = useState<string | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [refs, setRefs] = useState<ReferencePost[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/references").then((r) => r.json()).then((d) => setRefs(d.references ?? []));
  }, []);

  useEffect(() => {
    if (!postId) {
      setPost(null);
      return;
    }
    fetch(`/api/posts/${postId}`)
      .then((r) => r.json())
      .then((d: { post?: Post }) => {
        if (!d.post) return;
        setPost(d.post);
        const last = d.post.versions[d.post.versions.length - 1];
        setDraft({ ...EMPTY, ...last.draft });
        setEvaluation(last.evaluation ?? null);
        setEvaluatedText(last.evaluation ? last.draft.text : "");
        setScheduleAt(toLocalInput(d.post.scheduledAt));
      });
  }, [postId]);

  const stale = evaluation && evaluatedText !== draft.text;
  const highlights = useMemo(() => (evaluation ? evaluation.criteria.flatMap((c) => c.highlights) : []), [evaluation]);
  const cutMobile = computeCut(draft.text, "mobile");
  const cutDesktop = computeCut(draft.text, "desktop");
  const usedRefs = refs.filter((r) => evaluation?.referenceIds.includes(r.id));

  const update = (patch: Partial<PostDraft>) => setDraft((d) => ({ ...d, ...patch }));

  async function evaluate() {
    setLoading(true);
    setError(null);
    setActiveQuote(null);
    try {
      const res = await fetch("/api/evaluate", { method: "POST", body: JSON.stringify({ draft }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao avaliar");
      setEvaluation(data.evaluation);
      setEvaluatedText(draft.text);
      setNotice(data.notice);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function save(status: Post["status"], when?: string) {
    const scheduledAt = when ? new Date(when).toISOString() : undefined;
    const evalToSave = evaluation && !stale ? evaluation : undefined;
    if (post) {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        body: JSON.stringify({ draft, evaluation: evalToSave, status, ...(scheduledAt ? { scheduledAt } : {}) }),
      });
      const d = await res.json();
      setPost(d.post);
      setSaved(d.post.status === "em_aprovacao" ? "Salvo. Foi para aprovação do curador." : "Nova versão salva.");
    } else {
      const res = await fetch("/api/posts", {
        method: "POST",
        body: JSON.stringify({ draft, evaluation: evalToSave, status, scheduledAt, author: profile.name }),
      });
      const d = await res.json();
      setPost(d.post);
      router.replace(`/?post=${d.post.id}`);
      setSaved(d.post.status === "em_aprovacao" ? "Salvo. Post sensível foi para aprovação do curador." : status === "agendado" ? "Agendado na Biblioteca." : "Salvo na Biblioteca.");
    }
    setScheduleOpen(false);
    setTimeout(() => setSaved(null), 3500);
  }

  function applySuggestion(before: string, after: string) {
    update({ text: draft.text.replace(before, after) });
  }

  function applyHook(hook: string) {
    const parts = draft.text.split(/\n\s*\n/);
    parts[0] = hook;
    update({ text: parts.join("\n\n") });
  }

  function reset() {
    setDraft(EMPTY);
    setEvaluation(null);
    setEvaluatedText("");
    setNotice(undefined);
    router.replace("/");
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const urls = await Promise.all([...files].filter((f) => f.type.startsWith("image/")).map(fileToDataUrl));
    const images = draft.format === "imagem" || draft.format === "carrossel" ? [...draft.images, ...urls] : urls.slice(0, 1);
    update({ images: images.slice(0, 20) });
  }

  return (
    <div>
      <PageHeader
        title={post ? "Editar post" : "Avaliador"}
        subtitle={post ? `${post.versions.length} versão(ões) · ${post.title}` : "Cole o post que você escreveu, veja onde o LinkedIn corta e receba uma nota com sugestões."}
      >
        <div className="flex items-center gap-2">
          {saved && (
            <span className="chip bg-brand-tint text-brand-foreground"><Check size={12} />{saved}</span>
          )}
          {(post || draft.text) && (
            <button className="btn btn-ghost" onClick={reset}><RotateCcw size={14} />Novo post</button>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-6 px-4 md:px-8 py-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        {/* Coluna esquerda: editor + preview */}
        <div className="space-y-6 min-w-0">
          <section className="surface p-4 md:p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {(Object.keys(FORMAT_LABEL) as PostFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => update({ format: f, images: f === draft.format ? draft.images : draft.images.slice(0, f === "imagem" || f === "carrossel" ? 20 : 1) })}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${draft.format === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary-hover"}`}
                >
                  {FORMAT_LABEL[f]}
                </button>
              ))}
            </div>

            {draft.format === "artigo" && (
              <input className="field" placeholder="Título do artigo" value={draft.articleTitle ?? ""} onChange={(e) => update({ articleTitle: e.target.value })} />
            )}

            <div className="relative">
              <textarea
                className="field min-h-[260px] resize-y leading-relaxed"
                placeholder="Cole aqui o post que você escreveu no Claude, ChatGPT ou onde preferir…"
                value={draft.text}
                onChange={(e) => update({ text: e.target.value })}
              />
              <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {draft.text.length.toLocaleString("pt-BR")} / 3.000 caracteres
                </span>
                {draft.format !== "artigo" && draft.text && (
                  <span>
                    Corte em ~{cutMobile.visible.length} car. no mobile e ~{cutDesktop.visible.length} no desktop
                  </span>
                )}
              </div>
            </div>

            {draft.format === "enquete" && (
              <div className="space-y-2">
                <input className="field" placeholder="Pergunta da enquete" value={draft.pollQuestion ?? ""} onChange={(e) => update({ pollQuestion: e.target.value })} />
                {(draft.pollOptions ?? ["", ""]).map((o, i) => (
                  <input
                    key={i}
                    className="field"
                    placeholder={`Opção ${i + 1}`}
                    value={o}
                    onChange={(e) => {
                      const next = [...(draft.pollOptions ?? [])];
                      next[i] = e.target.value;
                      update({ pollOptions: next });
                    }}
                  />
                ))}
                {(draft.pollOptions?.length ?? 2) < 4 && (
                  <button className="btn btn-ghost" onClick={() => update({ pollOptions: [...(draft.pollOptions ?? []), ""] })}>+ opção</button>
                )}
              </div>
            )}

            {draft.format !== "texto" && draft.format !== "enquete" && (
              <div>
                <div className="flex flex-wrap gap-2">
                  {draft.images.map((src, i) => (
                    <div key={i} className="relative">
                      <img src={src} alt="" className="h-20 w-20 rounded-[0.625rem] object-cover shadow-edge" />
                      <button
                        onClick={() => update({ images: draft.images.filter((_, j) => j !== i) })}
                        className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"
                        aria-label="Remover imagem"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="grid h-20 w-20 place-items-center rounded-[0.625rem] border border-dashed border-input text-muted-foreground hover:bg-secondary"
                  >
                    <ImagePlus size={18} />
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {draft.format === "carrossel" && "Suba as páginas do carrossel como imagens, na ordem."}
                  {draft.format === "video" && "Suba a capa do vídeo. O conteúdo do vídeo não é analisado no MVP."}
                  {draft.format === "artigo" && "Suba a imagem de capa do artigo."}
                  {draft.format === "imagem" && "Até 20 imagens. A IA olha legibilidade e coerência com o texto."}
                </p>
                <input ref={fileRef} type="file" accept="image/*" multiple={draft.format === "imagem" || draft.format === "carrossel"} hidden onChange={(e) => onFiles(e.target.files)} />
              </div>
            )}

            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
                <ChevronDown size={14} className="transition-transform group-open:rotate-180" /> Primeiro comentário, objetivo e público
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="md:col-span-2 space-y-1">
                  <span className="label">Primeiro comentário (onde vai o link)</span>
                  <textarea className="field min-h-[64px]" value={draft.firstComment ?? ""} onChange={(e) => update({ firstComment: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="label">Objetivo</span>
                  <select className="field" value={draft.goal ?? ""} onChange={(e) => update({ goal: (e.target.value || undefined) as Goal | undefined })}>
                    <option value="">Não definido</option>
                    <option value="alcance">Alcance</option>
                    <option value="autoridade">Autoridade</option>
                    <option value="leads">Gerar leads</option>
                    <option value="recrutar">Recrutar</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="label">Público-alvo</span>
                  <input className="field" placeholder="Ex.: devs, founders, e-commerce" value={draft.audience ?? ""} onChange={(e) => update({ audience: e.target.value })} />
                </label>
              </div>
            </details>

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <button className="btn btn-brand" disabled={!draft.text.trim() || loading} onClick={evaluate}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {evaluation ? "Reavaliar" : "Avaliar post"}
              </button>
              <button className="btn btn-secondary" disabled={!draft.text.trim()} onClick={() => save(post?.status === "publicado" ? "publicado" : "rascunho")}>
                <Save size={14} /> {post ? "Salvar versão" : "Salvar rascunho"}
              </button>
              <div className="relative">
                <button className="btn btn-secondary" disabled={!draft.text.trim()} onClick={() => setScheduleOpen((o) => !o)}>
                  <Calendar size={14} /> {post?.scheduledAt ? formatDate(post.scheduledAt) : "Agendar"}
                </button>
                {scheduleOpen && (
                  <div className="surface absolute left-0 top-11 z-10 w-72 space-y-2 p-3">
                    <span className="label">Quando publicar</span>
                    <input type="datetime-local" className="field" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                    <p className="text-xs text-muted-foreground">No MVP você recebe um lembrete na Biblioteca e publica manualmente.</p>
                    <button className="btn btn-primary w-full justify-center" disabled={!scheduleAt} onClick={() => save("agendado", scheduleAt)}>Confirmar agendamento</button>
                  </div>
                )}
              </div>
              {stale && <span className="text-xs text-warning">O texto mudou desde a última avaliação.</span>}
              {error && <span className="text-xs text-destructive">{error}</span>}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Preview no LinkedIn</h2>
              <Tabs value={device} onChange={setDevice} items={[{ value: "mobile", label: "Mobile" }, { value: "desktop", label: "Desktop" }]} />
            </div>
            <div className="rounded-[1rem] bg-[#f4f2ee] p-4 md:p-6">
              {draft.text || draft.images.length ? (
                <LinkedInPreview draft={draft} device={device} highlights={stale ? [] : highlights} activeQuote={activeQuote} />
              ) : (
                <p className="py-16 text-center text-sm text-muted-foreground">O preview aparece aqui enquanto você escreve.</p>
              )}
            </div>
            <p className="text-xs text-subtle-foreground">Limites do corte são aproximados (~140 caracteres ou 3 linhas no mobile, ~210 no desktop) e serão validados com prints na Fase 0.</p>
          </section>
        </div>

        {/* Coluna direita: feedback */}
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:pb-6 min-w-0">
          {!evaluation && !loading && <EmptyFeedback />}
          {loading && (
            <div className="surface flex items-center gap-3 p-5 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> Lendo o post, comparando com o Playbook e as referências…
            </div>
          )}
          {evaluation && !loading && (
            <Feedback
              evaluation={evaluation}
              notice={notice}
              stale={!!stale}
              activeQuote={activeQuote}
              onQuote={(q) => setActiveQuote((cur) => (cur === q ? null : q))}
              onApply={applySuggestion}
              onHook={applyHook}
              text={draft.text}
              refs={usedRefs}
            />
          )}
          {post && post.versions.length > 1 && (
            <section className="surface p-4">
              <h3 className="mb-2 text-sm font-semibold">Histórico de versões</h3>
              <ol className="space-y-1.5">
                {post.versions.map((v, i) => (
                  <li key={v.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">v{i + 1} · {formatDate(v.createdAt)}</span>
                    <ScorePill score={v.evaluation?.overall} />
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function EmptyFeedback() {
  return (
    <div className="surface p-5">
      <div className="mb-3 inline-flex rounded-full bg-brand px-2.5 py-1 text-xs font-medium text-brand-foreground">Como a nota funciona</div>
      <ul className="space-y-2.5">
        {CRITERIA.map((c) => (
          <li key={c.key} className="flex gap-3 text-sm">
            <span className="w-10 shrink-0 font-semibold tabular-nums">{Math.round(c.weight * 100)}%</span>
            <span>
              <span className="font-medium">{c.label}</span>
              <span className="block text-muted-foreground">{c.help}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">0–49 reescrever · 50–69 ajustar · 70–84 bom · 85+ pronto. Regras bloqueantes do Playbook geram alerta independente da nota.</p>
    </div>
  );
}

function Feedback({
  evaluation,
  notice,
  stale,
  activeQuote,
  onQuote,
  onApply,
  onHook,
  text,
  refs,
}: {
  evaluation: Evaluation;
  notice?: string;
  stale: boolean;
  activeQuote: string | null;
  onQuote: (q: string) => void;
  onApply: (before: string, after: string) => void;
  onHook: (h: string) => void;
  text: string;
  refs: ReferencePost[];
}) {
  const blocking = evaluation.violations.filter((v) => v.severity === "bloqueante");
  return (
    <>
      <section className={`surface p-5 ${stale ? "opacity-60" : ""}`}>
        <div className="flex items-center gap-4">
          <ScoreRing score={evaluation.overall} />
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wide" style={{ color: scoreColor(evaluation.overall) }}>{BAND_LABEL[evaluation.band]}</div>
            <p className="mt-1 text-sm leading-snug">{evaluation.verdict}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="chip">{evaluation.model === "heuristica" ? "Regras (sem IA)" : `Claude · ${evaluation.model}`}</span>
              <span className="chip">{evaluation.language === "en" ? "Inglês" : "Português"}</span>
              <span className="chip">Playbook v{evaluation.playbookVersion}</span>
            </div>
          </div>
        </div>
        {notice && <p className="mt-3 rounded-[0.625rem] bg-yellow-tint px-3 py-2 text-xs text-warning">{notice}</p>}
      </section>

      {(evaluation.sensitive.flag || blocking.length > 0) && (
        <section className="rounded-[1rem] border border-destructive/30 bg-[#fdf1f1] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive"><ShieldAlert size={16} /> Precisa de aprovação antes de publicar</div>
          {evaluation.sensitive.reason && <p className="mt-1 text-sm text-[#7a1b1c]">{evaluation.sensitive.reason}</p>}
          {blocking.map((v) => (
            <p key={v.ruleId} className="mt-1 text-sm text-[#7a1b1c]">• {v.ruleName}: {v.message}</p>
          ))}
          <p className="mt-2 text-xs text-[#7a1b1c]/80">Ao agendar, o post vai para o status “Em aprovação” na Biblioteca.</p>
        </section>
      )}

      <section className="surface p-5">
        <h3 className="mb-3 text-sm font-semibold">Nota por critério</h3>
        <ul className="space-y-4">
          {CRITERIA.map((c) => {
            const r = evaluation.criteria.find((x) => x.key === c.key);
            if (!r) return null;
            return (
              <li key={c.key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{c.label} <span className="font-normal text-subtle-foreground">· {Math.round(c.weight * 100)}%</span></span>
                  <span className="font-semibold tabular-nums" style={{ color: scoreColor(r.score) }}>{r.score}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${r.score}%`, background: scoreColor(r.score) }} />
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{r.reason}</p>
                {r.highlights.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => onQuote(h.quote)}
                    className={`mt-1.5 block w-full rounded-[0.625rem] border px-3 py-2 text-left text-xs transition-colors ${activeQuote === h.quote ? "border-brand-soft bg-brand-tint" : "border-border hover:bg-secondary"}`}
                  >
                    <span className="line-clamp-2 italic text-foreground">“{h.quote}”</span>
                    <span className="mt-0.5 block text-muted-foreground">{h.issue}</span>
                  </button>
                ))}
              </li>
            );
          })}
        </ul>
      </section>

      {evaluation.violations.filter((v) => v.severity !== "bloqueante").length > 0 && (
        <section className="surface p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={14} /> Regras do Playbook</h3>
          <ul className="space-y-2">
            {evaluation.violations.filter((v) => v.severity !== "bloqueante").map((v, i) => (
              <li key={i} className="text-sm">
                <div className="flex items-center gap-2"><SeverityChip severity={v.severity} /><span className="font-medium">{v.ruleName}</span></div>
                <p className="mt-0.5 text-muted-foreground">{v.message}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {evaluation.hooks.length > 0 && (
        <section className="surface p-5">
          <h3 className="mb-3 text-sm font-semibold">Hooks alternativos</h3>
          <ul className="space-y-2">
            {evaluation.hooks.map((h, i) => (
              <li key={i} className="rounded-[0.625rem] bg-muted p-3 text-sm">
                <p className="whitespace-pre-wrap">{h}</p>
                <button className="mt-2 text-xs font-medium text-link hover:underline" onClick={() => onHook(h)}>Usar este hook</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {evaluation.suggestions.length > 0 && (
        <section className="surface p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Wand2 size={14} /> Sugestões pontuais</h3>
          <ul className="space-y-3">
            {evaluation.suggestions.map((s, i) => {
              const applied = !text.includes(s.before) && text.includes(s.after);
              return (
                <li key={i} className="rounded-[0.625rem] border border-border p-3 text-sm">
                  <p className="text-muted-foreground line-through decoration-destructive/50">{s.before}</p>
                  <p className="mt-1">{s.after}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">{s.why}</p>
                  <button
                    disabled={applied || !text.includes(s.before)}
                    onClick={() => onApply(s.before, s.after)}
                    className="btn btn-secondary mt-2 !px-3 !py-1 text-xs"
                  >
                    {applied ? <><Check size={12} /> Aplicada</> : "Aplicar"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {refs.length > 0 && (
        <section className="surface p-5">
          <h3 className="mb-1 text-sm font-semibold">Posts parecidos que performaram</h3>
          <p className="mb-3 text-xs text-muted-foreground">Usados como referência nesta avaliação.</p>
          <ul className="space-y-2">
            {refs.map((r) => (
              <li key={r.id}>
                <details className="rounded-[0.625rem] bg-muted p-3 text-sm">
                  <summary className="cursor-pointer list-none">
                    <span className="line-clamp-2 font-medium">{r.text.split("\n")[0]}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {r.comments ? `${r.comments} comentários` : ""}{r.impressions ? ` · ${r.impressions.toLocaleString("pt-BR")} impressões` : ""}
                    </span>
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{r.text}</p>
                  <p className="mt-2 text-xs"><span className="font-medium">Por que funciona:</span> {r.why}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
