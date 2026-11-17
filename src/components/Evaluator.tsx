"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Calendar, Check, ChevronDown, ImagePlus, MagicWand01, Plus, ShieldTick, Stars02, XClose } from "@untitledui/icons";
import { Alert, AlertDescription, AlertTitle } from "@decocms/ui/components/alert";
import { Badge } from "@decocms/ui/components/badge";
import { Button } from "@decocms/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@decocms/ui/components/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@decocms/ui/components/collapsible";
import { IconButton } from "@decocms/ui/components/icon-button";
import { Input } from "@decocms/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@decocms/ui/components/popover";
import { Skeleton } from "@decocms/ui/components/skeleton";
import { toast } from "@decocms/ui/components/sonner";
import { Spinner } from "@decocms/ui/components/spinner";
import { Tabs, TabsList, TabsTrigger } from "@decocms/ui/components/tabs";
import { Textarea } from "@decocms/ui/components/textarea";
import { LinkedInPreview } from "./LinkedInPreview";
import { Field, PageContainer, PageHeader, ScoreBar, ScorePill, ScoreRing, SeverityBadge, SimpleSelect, formatDate, scoreColor, toLocalInput } from "./ui";
import { useProfile } from "./useProfile";
import { computeCut, type Device } from "@/lib/linkedin";
import { BAND_LABEL, CRITERIA, FORMAT_LABEL, type Evaluation, type Goal, type Post, type PostDraft, type PostFormat, type ReferencePost } from "@/lib/types";

const EMPTY: PostDraft = { text: "", format: "texto", images: [], firstComment: "", pollOptions: ["", ""] };

async function fileToDataUrl(file: File): Promise<string> {
  const url = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  // Reduz imagens grandes para no máximo 1600px (banco leve e chamada à IA rápida).
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
  const [device, setDevice] = useState<Device>("mobile");
  const [activeQuote, setActiveQuote] = useState<string | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [refs, setRefs] = useState<ReferencePost[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
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

  const stale = !!evaluation && evaluatedText !== draft.text;
  const highlights = useMemo(() => (evaluation ? evaluation.criteria.flatMap((c) => c.highlights) : []), [evaluation]);
  const cutMobile = computeCut(draft.text, "mobile");
  const cutDesktop = computeCut(draft.text, "desktop");
  const usedRefs = refs.filter((r) => evaluation?.referenceIds.includes(r.id));
  const hasText = !!draft.text.trim();

  const update = (patch: Partial<PostDraft>) => setDraft((d) => ({ ...d, ...patch }));

  async function evaluate() {
    setLoading(true);
    setActiveQuote(null);
    try {
      const res = await fetch("/api/evaluate", { method: "POST", body: JSON.stringify({ draft }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao avaliar");
      setEvaluation(data.evaluation);
      setEvaluatedText(draft.text);
      setNotice(data.notice);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function save(status: Post["status"], when?: string) {
    const scheduledAt = when ? new Date(when).toISOString() : undefined;
    const evalToSave = evaluation && !stale ? evaluation : undefined;
    let saved: Post;
    if (post) {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        body: JSON.stringify({ draft, evaluation: evalToSave, status, ...(scheduledAt ? { scheduledAt } : {}) }),
      });
      saved = (await res.json()).post;
    } else {
      const res = await fetch("/api/posts", {
        method: "POST",
        body: JSON.stringify({ draft, evaluation: evalToSave, status, scheduledAt, author: profile.name }),
      });
      saved = (await res.json()).post;
      router.replace(`/?post=${saved.id}`);
    }
    setPost(saved);
    setScheduleOpen(false);
    if (saved.status === "em_aprovacao") toast.warning("Salvo. O post foi para aprovação do curador.");
    else if (saved.status === "agendado") toast.success(`Agendado para ${formatDate(saved.scheduledAt)}.`);
    else toast.success(post ? "Nova versão salva." : "Salvo na Biblioteca.");
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
    const multi = draft.format === "imagem" || draft.format === "carrossel";
    update({ images: (multi ? [...draft.images, ...urls] : urls.slice(0, 1)).slice(0, 20) });
  }

  return (
    <>
      <PageHeader
        crumb={post ? post.title : "Avaliador"}
        actions={
          <>
            {(post || hasText) && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <Plus /> Novo post
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={!hasText} onClick={() => save(post?.status === "publicado" ? "publicado" : "rascunho")}>
              {post ? "Salvar versão" : "Salvar rascunho"}
            </Button>
            <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" disabled={!hasText}>
                  <Calendar /> {post?.scheduledAt ? formatDate(post.scheduledAt) : "Agendar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <div className="flex flex-col gap-3">
                  <Field label="Quando publicar" hint="No MVP você recebe o lembrete na Biblioteca e publica manualmente.">
                    <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                  </Field>
                  <Button disabled={!scheduleAt} onClick={() => save("agendado", scheduleAt)}>
                    Agendar post
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button size="sm" disabled={!hasText || loading} onClick={evaluate}>
              {loading ? <Spinner size="xs" /> : <Stars02 />}
              {evaluation ? "Reavaliar" : "Avaliar post"}
            </Button>
          </>
        }
      />

      <PageContainer width="wide">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* Editor + preview */}
          <div className="flex min-w-0 flex-col gap-10">
            <Card className="gap-4 py-5">
              <CardContent className="flex flex-col gap-4 px-5">
                <Tabs value={draft.format} onValueChange={(f) => update({ format: f as PostFormat, images: draft.images.slice(0, f === "imagem" || f === "carrossel" ? 20 : 1) })}>
                  <TabsList className="flex-wrap">
                    {(Object.keys(FORMAT_LABEL) as PostFormat[]).map((f) => (
                      <TabsTrigger key={f} value={f}>
                        {FORMAT_LABEL[f]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                {draft.format === "artigo" && <Input placeholder="Título do artigo" value={draft.articleTitle ?? ""} onChange={(e) => update({ articleTitle: e.target.value })} />}

                <div className="flex flex-col gap-1.5">
                  <Textarea
                    className="min-h-[260px] resize-y leading-relaxed"
                    placeholder="Cole aqui o post que você escreveu no Claude, ChatGPT ou onde preferir"
                    value={draft.text}
                    onChange={(e) => update({ text: e.target.value })}
                  />
                  <div className="flex flex-wrap justify-between gap-2 text-meta">
                    <span>{draft.text.length.toLocaleString("pt-BR")} / 3.000 caracteres</span>
                    {draft.format !== "artigo" && hasText && (
                      <span>
                        Corte em ~{cutMobile.visible.length} caracteres no mobile e ~{cutDesktop.visible.length} no desktop
                      </span>
                    )}
                  </div>
                </div>

                {draft.format === "enquete" && (
                  <div className="flex flex-col gap-2">
                    <Input placeholder="Pergunta da enquete" value={draft.pollQuestion ?? ""} onChange={(e) => update({ pollQuestion: e.target.value })} />
                    {(draft.pollOptions ?? ["", ""]).map((o, i) => (
                      <Input
                        key={i}
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
                      <Button variant="ghost" size="sm" className="self-start" onClick={() => update({ pollOptions: [...(draft.pollOptions ?? []), ""] })}>
                        <Plus /> Adicionar opção
                      </Button>
                    )}
                  </div>
                )}

                {draft.format !== "texto" && draft.format !== "enquete" && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap gap-2">
                      {draft.images.map((src, i) => (
                        <div key={i} className="relative">
                          <img src={src} alt="" className="size-20 rounded-lg object-cover card-shadow" />
                          <IconButton
                            label="Remover imagem"
                            variant="default"
                            size="icon-sm"
                            className="absolute -right-2 -top-2 size-6"
                            onClick={() => update({ images: draft.images.filter((_, j) => j !== i) })}
                          >
                            <XClose />
                          </IconButton>
                        </div>
                      ))}
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="grid size-20 place-items-center rounded-lg border border-dashed border-input text-muted-foreground transition-colors hover:bg-accent"
                        aria-label="Adicionar imagem"
                      >
                        <ImagePlus className="size-5" />
                      </button>
                    </div>
                    <p className="text-meta">
                      {draft.format === "carrossel" && "Suba as páginas do carrossel como imagens, na ordem."}
                      {draft.format === "video" && "Suba a capa. O conteúdo do vídeo não é analisado no MVP."}
                      {draft.format === "artigo" && "Imagem de capa do artigo."}
                      {draft.format === "imagem" && "Até 20 imagens. A IA avalia legibilidade e coerência com o texto."}
                    </p>
                    <input ref={fileRef} type="file" accept="image/*" multiple={draft.format === "imagem" || draft.format === "carrossel"} hidden onChange={(e) => onFiles(e.target.files)} />
                  </div>
                )}

                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="group -ml-2 self-start">
                      <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
                      Primeiro comentário, objetivo e público
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid gap-4 pt-3 md:grid-cols-2">
                      <Field label="Primeiro comentário" hint="Onde vai o link externo." className="md:col-span-2">
                        <Textarea className="min-h-16" value={draft.firstComment ?? ""} onChange={(e) => update({ firstComment: e.target.value })} />
                      </Field>
                      <Field label="Objetivo">
                        <SimpleSelect<Goal>
                          value={draft.goal ?? ""}
                          onValueChange={(goal) => update({ goal })}
                          placeholder="Não definido"
                          options={[
                            { value: "alcance", label: "Alcance" },
                            { value: "autoridade", label: "Autoridade" },
                            { value: "leads", label: "Gerar leads" },
                            { value: "recrutar", label: "Recrutar" },
                          ]}
                        />
                      </Field>
                      <Field label="Público">
                        <Input placeholder="Devs, founders, e-commerce" value={draft.audience ?? ""} onChange={(e) => update({ audience: e.target.value })} />
                      </Field>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {stale && <p className="text-meta text-warning">O texto mudou desde a última avaliação.</p>}
              </CardContent>
            </Card>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-medium">Preview no LinkedIn</h2>
                <Tabs value={device} onValueChange={(v) => setDevice(v as Device)}>
                  <TabsList>
                    <TabsTrigger value="mobile">Mobile</TabsTrigger>
                    <TabsTrigger value="desktop">Desktop</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="surface-inset p-4 md:p-6">
                {hasText || draft.images.length ? (
                  <LinkedInPreview draft={draft} device={device} highlights={stale ? [] : highlights} activeQuote={activeQuote} />
                ) : (
                  <p className="py-16 text-center text-sm text-muted-foreground">O preview aparece enquanto você escreve.</p>
                )}
              </div>
              <p className="text-meta">Corte aproximado: ~140 caracteres ou 3 linhas no mobile, ~210 no desktop. Validar com prints na Fase 0.</p>
            </section>
          </div>

          {/* Feedback */}
          <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-16 xl:max-h-[calc(100dvh-6rem)] xl:self-start xl:overflow-y-auto xl:pb-2">
            {loading && <FeedbackSkeleton />}
            {!evaluation && !loading && <HowScoreWorks />}
            {evaluation && !loading && (
              <Feedback
                evaluation={evaluation}
                notice={notice}
                stale={stale}
                activeQuote={activeQuote}
                onQuote={(q) => setActiveQuote((cur) => (cur === q ? null : q))}
                onApply={(before, after) => update({ text: draft.text.replace(before, after) })}
                onHook={applyHook}
                text={draft.text}
                refs={usedRefs}
              />
            )}
            {post && post.versions.length > 1 && (
              <Card className="gap-3 py-5">
                <CardHeader className="px-5">
                  <CardTitle>Versões</CardTitle>
                </CardHeader>
                <CardContent className="px-5">
                  <ol className="flex flex-col gap-2">
                    {post.versions.map((v, i) => (
                      <li key={v.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          v{i + 1} · {formatDate(v.createdAt)}
                        </span>
                        <ScorePill score={v.evaluation?.overall} />
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      </PageContainer>
    </>
  );
}

function FeedbackSkeleton() {
  return (
    <Card className="gap-4 p-5">
      <div className="flex items-center gap-4">
        <Skeleton className="size-[88px] rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      {CRITERIA.map((c) => (
        <div key={c.key} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-1.5 w-full" />
        </div>
      ))}
      <p className="text-meta">Lendo o post e comparando com o Playbook e as referências.</p>
    </Card>
  );
}

function HowScoreWorks() {
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle>Como a nota funciona</CardTitle>
      </CardHeader>
      <CardContent className="px-5">
        <ul className="flex flex-col gap-3">
          {CRITERIA.map((c) => (
            <li key={c.key} className="flex gap-3 text-sm">
              <span className="tnum w-9 shrink-0 font-medium">{Math.round(c.weight * 100)}%</span>
              <span>
                <span className="font-medium">{c.label}</span>
                <span className="block text-muted-foreground">{c.help}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-border pt-3 text-meta">0–49 reescrever · 50–69 ajustar · 70–84 bom · 85+ pronto. Regras bloqueantes geram alerta independente da nota.</p>
      </CardContent>
    </Card>
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
  const others = evaluation.violations.filter((v) => v.severity !== "bloqueante");
  return (
    <>
      <Card className={`gap-3 p-5 ${stale ? "opacity-60" : ""}`}>
        <div className="flex items-center gap-4">
          <ScoreRing score={evaluation.overall} />
          <div className="min-w-0">
            <div className="text-xs font-medium" style={{ color: scoreColor(evaluation.overall) }}>
              {BAND_LABEL[evaluation.band]}
            </div>
            <p className="mt-1 text-sm">{evaluation.verdict}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="muted">{evaluation.model === "heuristica" ? "Regras, sem IA" : evaluation.model}</Badge>
          <Badge variant="muted">{evaluation.language === "en" ? "Inglês" : "Português"}</Badge>
          <Badge variant="muted">Playbook v{evaluation.playbookVersion}</Badge>
        </div>
      </Card>

      {notice && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {(evaluation.sensitive.flag || blocking.length > 0) && (
        <Alert variant="destructive">
          <ShieldTick />
          <div className="flex flex-col gap-1">
            <AlertTitle>Precisa de aprovação antes de publicar</AlertTitle>
            <AlertDescription>
              {evaluation.sensitive.reason && <p>{evaluation.sensitive.reason}</p>}
              {blocking.map((v) => (
                <p key={v.ruleId}>
                  {v.ruleName}: {v.message}
                </p>
              ))}
              <p className="mt-1">Ao agendar, o post vai para “Em aprovação”.</p>
            </AlertDescription>
          </div>
        </Alert>
      )}

      <Card className="gap-4 py-5">
        <CardHeader className="px-5">
          <CardTitle>Nota por critério</CardTitle>
        </CardHeader>
        <CardContent className="px-5">
          <ul className="flex flex-col gap-5">
            {CRITERIA.map((c) => {
              const r = evaluation.criteria.find((x) => x.key === c.key);
              if (!r) return null;
              return (
                <li key={c.key} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {c.label} <span className="font-normal text-muted-foreground">· {Math.round(c.weight * 100)}%</span>
                    </span>
                    <span className="tnum font-medium" style={{ color: scoreColor(r.score) }}>
                      {r.score}
                    </span>
                  </div>
                  <ScoreBar score={r.score} />
                  <p className="text-sm text-muted-foreground">{r.reason}</p>
                  {r.highlights.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => onQuote(h.quote)}
                      className={`surface-inset px-3 py-2 text-left text-xs transition-colors hover:bg-accent ${activeQuote === h.quote ? "ring-2 ring-brand" : ""}`}
                    >
                      <span className="line-clamp-2 italic">“{h.quote}”</span>
                      <span className="mt-0.5 block text-muted-foreground">{h.issue}</span>
                    </button>
                  ))}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {others.length > 0 && (
        <Card className="gap-4 py-5">
          <CardHeader className="px-5">
            <CardTitle>Regras do Playbook</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <ul className="flex flex-col gap-3">
              {others.map((v, i) => (
                <li key={i} className="flex flex-col gap-1 text-sm">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={v.severity} />
                    <span className="font-medium">{v.ruleName}</span>
                  </div>
                  <p className="text-muted-foreground">{v.message}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {evaluation.hooks.length > 0 && (
        <Card className="gap-4 py-5">
          <CardHeader className="px-5">
            <CardTitle>Hooks alternativos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 px-5">
            {evaluation.hooks.map((h, i) => (
              <div key={i} className="surface-inset flex flex-col items-start gap-2 p-3 text-sm">
                <p className="whitespace-pre-wrap">{h}</p>
                <Button variant="outline" size="xs" onClick={() => onHook(h)}>
                  Usar este hook
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {evaluation.suggestions.length > 0 && (
        <Card className="gap-4 py-5">
          <CardHeader className="px-5">
            <CardTitle className="flex items-center gap-2">
              <MagicWand01 className="size-4" /> Sugestões
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 px-5">
            {evaluation.suggestions.map((s, i) => {
              const applied = !text.includes(s.before) && text.includes(s.after);
              return (
                <div key={i} className="surface-inset flex flex-col items-start gap-1.5 p-3 text-sm">
                  <p className="text-muted-foreground line-through decoration-destructive/50">{s.before}</p>
                  <p>{s.after}</p>
                  <p className="text-meta">{s.why}</p>
                  <Button variant="outline" size="xs" disabled={applied || !text.includes(s.before)} onClick={() => onApply(s.before, s.after)}>
                    {applied ? (
                      <>
                        <Check /> Aplicada
                      </>
                    ) : (
                      "Aplicar"
                    )}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {refs.length > 0 && (
        <Card className="gap-4 py-5">
          <CardHeader className="px-5">
            <CardTitle>Posts parecidos que performaram</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 px-5">
            {refs.map((r) => (
              <Collapsible key={r.id} className="surface-inset p-3 text-sm">
                <CollapsibleTrigger className="w-full text-left">
                  <span className="line-clamp-2 font-medium">{r.text.split("\n")[0]}</span>
                  <span className="mt-1 block text-meta">
                    {r.comments ? `${r.comments} comentários` : ""}
                    {r.impressions ? ` · ${r.impressions.toLocaleString("pt-BR")} impressões` : ""}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{r.text}</p>
                  <p className="mt-2 text-xs">
                    <span className="font-medium">Por que funciona:</span> {r.why}
                  </p>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
