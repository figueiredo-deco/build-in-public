"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Calendar, ChevronDown, Edit05, ImagePlus, Plus, Stars02, XClose } from "@untitledui/icons";
import { Alert, AlertDescription } from "@decocms/ui/components/alert";
import { Button } from "@decocms/ui/components/button";
import { Card, CardContent } from "@decocms/ui/components/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@decocms/ui/components/collapsible";
import { IconButton } from "@decocms/ui/components/icon-button";
import { Input } from "@decocms/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@decocms/ui/components/popover";
import { toast } from "@decocms/ui/components/sonner";
import { Spinner } from "@decocms/ui/components/spinner";
import { Tabs, TabsList, TabsTrigger } from "@decocms/ui/components/tabs";
import { Textarea } from "@decocms/ui/components/textarea";
import { Review } from "./Review";
import { Field, PageContainer, PageHeader, SimpleSelect, formatDate, toLocalInput } from "./ui";
import { useProfile } from "./useProfile";
import { computeCut } from "@/lib/linkedin";
import { CHANNEL_LABEL, FORMAT_LABEL, type Channel, type Evaluation, type Goal, type Post, type PostDraft, type PostFormat, type ReferencePost } from "@/lib/types";

const EMPTY: PostDraft = { text: "", format: "texto", channel: "pessoal", images: [], firstComment: "", pollOptions: ["", ""] };

type Mode = "editar" | "revisar";

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

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function Evaluator() {
  const params = useSearchParams();
  const router = useRouter();
  const postId = params.get("post");
  const { profile } = useProfile();

  const [mode, setMode] = useState<Mode>("editar");
  const [draft, setDraft] = useState<PostDraft>(EMPTY);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluatedText, setEvaluatedText] = useState("");
  const [notice, setNotice] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [post, setPost] = useState<Post | null>(null);
  const [refs, setRefs] = useState<ReferencePost[]>([]);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
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
        setMode(last.evaluation ? "revisar" : "editar");
      });
  }, [postId]);

  const stale = !!evaluation && evaluatedText !== draft.text;
  const usedRefs = refs.filter((r) => evaluation?.referenceIds.includes(r.id));
  const hasText = !!draft.text.trim();
  const update = (patch: Partial<PostDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const sameDayPosts = scheduleAt ? allPosts.filter((p) => p.id !== post?.id && p.scheduledAt && p.status !== "arquivado" && sameDay(new Date(p.scheduledAt), new Date(scheduleAt))) : [];

  async function evaluate() {
    setLoading(true);
    setMode("revisar");
    try {
      const res = await fetch("/api/evaluate", { method: "POST", body: JSON.stringify({ draft }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao avaliar");
      setEvaluation(data.evaluation);
      setEvaluatedText(draft.text);
      setNotice(data.notice);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      if (!evaluation) setMode("editar");
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

  function reset() {
    setDraft(EMPTY);
    setEvaluation(null);
    setEvaluatedText("");
    setNotice(undefined);
    setMode("editar");
    router.replace("/");
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const urls = await Promise.all([...files].filter((f) => f.type.startsWith("image/")).map(fileToDataUrl));
    const multi = draft.format === "imagem" || draft.format === "carrossel";
    update({ images: (multi ? [...draft.images, ...urls] : urls.slice(0, 1)).slice(0, 20) });
  }

  const schedule = (
    <Popover
      open={scheduleOpen}
      onOpenChange={(o) => {
        setScheduleOpen(o);
        if (o) fetch("/api/posts").then((r) => r.json()).then((d) => setAllPosts(d.posts ?? []));
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={!hasText}>
          <Calendar /> {post?.scheduledAt ? formatDate(post.scheduledAt) : "Agendar"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex flex-col gap-3">
          <Field label="Quando publicar" hint="No MVP você recebe o lembrete na Biblioteca e publica manualmente.">
            <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
          </Field>
          {sameDayPosts.length > 0 && (
            <Alert variant="warning">
              <AlertTriangle />
              <AlertDescription>Já tem {sameDayPosts.length} post agendado nesse dia. O Playbook recomenda no máximo 1 por dia.</AlertDescription>
            </Alert>
          )}
          <Button disabled={!scheduleAt} onClick={() => save("agendado", scheduleAt)}>
            Agendar post
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <>
      <PageHeader
        crumb={post ? post.title : "Avaliador"}
        toolbar={
          (evaluation || loading) && (
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="editar">Texto</TabsTrigger>
                <TabsTrigger value="revisar">Revisão</TabsTrigger>
              </TabsList>
            </Tabs>
          )
        }
        actions={
          <>
            {(post || hasText) && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <Plus /> Novo post
              </Button>
            )}
            {mode === "revisar" && (
              <Button variant="outline" size="sm" onClick={() => setMode("editar")}>
                <Edit05 /> Editar texto
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={!hasText} onClick={() => save(post?.status === "publicado" ? "publicado" : "rascunho")}>
              {post ? "Salvar versão" : "Salvar rascunho"}
            </Button>
            {schedule}
            <Button size="sm" disabled={!hasText || loading} onClick={evaluate}>
              {loading ? <Spinner size="xs" /> : <Stars02 />}
              {evaluation ? "Reavaliar" : "Avaliar post"}
            </Button>
          </>
        }
      />

      {mode === "revisar" ? (
        <PageContainer width="fluid">
          <Review draft={draft} onText={(text) => update({ text })} evaluation={evaluation} loading={loading} stale={stale} notice={notice} refs={usedRefs} />
        </PageContainer>
      ) : (
        <PageContainer width="reading">
          <Editor draft={draft} update={update} fileRef={fileRef} onFiles={onFiles} stale={stale} />
        </PageContainer>
      )}
    </>
  );
}

function Editor({
  draft,
  update,
  fileRef,
  onFiles,
  stale,
}: {
  draft: PostDraft;
  update: (p: Partial<PostDraft>) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (f: FileList | null) => void;
  stale: boolean;
}) {
  const hasText = !!draft.text.trim();
  const cutMobile = computeCut(draft.text, "mobile");
  const cutDesktop = computeCut(draft.text, "desktop");
  return (
    <Card className="gap-4 py-5">
      <CardContent className="flex flex-col gap-4 px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={draft.format} onValueChange={(f) => update({ format: f as PostFormat, images: draft.images.slice(0, f === "imagem" || f === "carrossel" ? 20 : 1) })}>
            <TabsList className="flex-wrap">
              {(Object.keys(FORMAT_LABEL) as PostFormat[]).map((f) => (
                <TabsTrigger key={f} value={f}>
                  {FORMAT_LABEL[f]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <SimpleSelect<Channel>
            className="w-44"
            size="sm"
            value={draft.channel ?? "pessoal"}
            onValueChange={(channel) => update({ channel })}
            options={(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
          />
        </div>
        {draft.channel === "empresa" && <p className="text-meta -mt-2">Página da empresa: o post precisa estar em inglês.</p>}

        {draft.format === "artigo" && <Input placeholder="Título do artigo" value={draft.articleTitle ?? ""} onChange={(e) => update({ articleTitle: e.target.value })} />}

        <div className="flex flex-col gap-1.5">
          <Textarea
            className="min-h-[340px] resize-y leading-relaxed"
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
                  <IconButton label="Remover imagem" variant="default" size="icon-sm" className="absolute -top-2 -right-2 size-6" onClick={() => update({ images: draft.images.filter((_, j) => j !== i) })}>
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

        {stale && <p className="text-meta text-warning">O texto mudou desde a última avaliação. Clique em Reavaliar para a nova nota.</p>}
      </CardContent>
    </Card>
  );
}
