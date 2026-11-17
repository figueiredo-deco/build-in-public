"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell01, Check, ChevronLeft, ChevronRight, Copy01, Grid01, LinkExternal01, Lightbulb02, Plus, Trash01 } from "@untitledui/icons";
import { Alert, AlertDescription, AlertTitle } from "@decocms/ui/components/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@decocms/ui/components/alert-dialog";
import { Badge } from "@decocms/ui/components/badge";
import { Button } from "@decocms/ui/components/button";
import { Card } from "@decocms/ui/components/card";
import { EmptyState } from "@decocms/ui/components/empty-state";
import { IconButton } from "@decocms/ui/components/icon-button";
import { Input } from "@decocms/ui/components/input";
import { SearchInput } from "@decocms/ui/components/search-input";
import { toast } from "@decocms/ui/components/sonner";
import { Tabs, TabsList, TabsTrigger } from "@decocms/ui/components/tabs";
import { Field, PageContainer, PageHeader, ScorePill, SimpleSelect, StatusBadge, formatDate, latestEvaluation, toLocalInput } from "./ui";
import { useProfile } from "./useProfile";
import { FORMAT_LABEL, STATUS_LABEL, type Idea, type Post, type PostStatus } from "@/lib/types";

type View = "lista" | "calendario" | "ideias";

export function Library() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("lista");
  const [status, setStatus] = useState<PostStatus | "todos">("todos");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const { profile } = useProfile();

  useEffect(() => {
    Promise.all([
      fetch("/api/posts").then((r) => r.json()).then((d) => setPosts(d.posts ?? [])),
      fetch("/api/ideas").then((r) => r.json()).then((d) => setIdeas(d.ideas ?? [])),
    ]).finally(() => setLoaded(true));
  }, []);

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/posts/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    const d = await res.json();
    setPosts((ps) => ps.map((p) => (p.id === id ? d.post : p)));
    return d.post as Post;
  }
  async function remove(id: string) {
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
    setPosts((ps) => ps.filter((p) => p.id !== id));
    toast.success("Post excluído.");
  }

  const now = Date.now();
  const due = posts.filter((p) => p.status === "agendado" && p.scheduledAt && new Date(p.scheduledAt).getTime() <= now + 24 * 3600 * 1000);
  const pendingApproval = posts.filter((p) => p.status === "em_aprovacao");

  const filtered = useMemo(
    () =>
      posts.filter((p) => {
        if (status !== "todos" && p.status !== status) return false;
        if (status === "todos" && p.status === "arquivado") return false;
        if (q) {
          const text = p.versions[p.versions.length - 1]?.draft.text.toLowerCase() ?? "";
          if (!text.includes(q.toLowerCase())) return false;
        }
        return true;
      }),
    [posts, status, q],
  );

  return (
    <>
      <PageHeader
        crumb="Biblioteca"
        toolbar={
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="lista">Lista</TabsTrigger>
              <TabsTrigger value="calendario">Calendário</TabsTrigger>
              <TabsTrigger value="ideias">Ideias{ideas.length ? ` · ${ideas.length}` : ""}</TabsTrigger>
            </TabsList>
          </Tabs>
        }
        actions={
          <Button size="sm" asChild>
            <Link href="/">
              <Plus /> Novo post
            </Link>
          </Button>
        }
      />
      <PageContainer width="standard" className="flex flex-col gap-10">
        {(due.length > 0 || pendingApproval.length > 0) && (
          <div className="flex flex-col gap-3">
            {due.length > 0 && (
              <Alert variant="success">
                <Bell01 />
                <div className="flex w-full flex-col gap-2">
                  <AlertTitle>Hora de publicar</AlertTitle>
                  {due.map((p) => (
                    <DueRow key={p.id} post={p} onPublished={(url) => patch(p.id, { status: "publicado", publishedUrl: url || undefined }).then(() => toast.success("Marcado como publicado. Não edite o post no LinkedIn agora: isso derruba a entrega."))} />
                  ))}
                </div>
              </Alert>
            )}
            {pendingApproval.length > 0 && (
              <Alert variant="warning">
                <Check />
                <div className="flex w-full flex-col gap-2">
                  <AlertTitle>Aguardando aprovação do curador</AlertTitle>
                  {pendingApproval.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {p.title} <span className="text-muted-foreground">· {p.author}</span>
                      </span>
                      <span className="flex gap-2">
                        <Button variant="outline" size="xs" asChild>
                          <Link href={`/?post=${p.id}`}>Revisar</Link>
                        </Button>
                        {profile.role === "curador" ? (
                          <Button size="xs" onClick={() => patch(p.id, { approve: true, approvedBy: profile.name }).then(() => toast.success("Post aprovado."))}>
                            Aprovar
                          </Button>
                        ) : (
                          <span className="self-center text-meta">Só o curador aprova</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </Alert>
            )}
          </div>
        )}

        {view === "lista" && (
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput className="w-full sm:w-64" placeholder="Buscar no texto" value={q} onChange={setQ} />
              <SimpleSelect<PostStatus | "todos">
                className="w-44"
                value={status}
                onValueChange={setStatus}
                options={[{ value: "todos", label: "Todos os status" }, ...(Object.keys(STATUS_LABEL) as PostStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))]}
              />
            </div>
            {loaded && filtered.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Grid01 />}
                  title={posts.length ? "Nenhum post com esse filtro" : "Nenhum post salvo"}
                  buttonComponent={
                    !posts.length && (
                      <Button size="sm" asChild>
                        <Link href="/">Avaliar um post</Link>
                      </Button>
                    )
                  }
                />
              </Card>
            ) : (
              <Card className="gap-0 overflow-hidden">
                <ul className="divide-y divide-border">
                  {filtered.map((p) => (
                    <PostRow key={p.id} post={p} open={openId === p.id} onToggle={() => setOpenId(openId === p.id ? null : p.id)} onPatch={(b) => patch(p.id, b)} onDelete={() => remove(p.id)} />
                  ))}
                </ul>
              </Card>
            )}
          </section>
        )}

        {view === "calendario" && <CalendarView posts={posts} />}
        {view === "ideias" && <IdeasView ideas={ideas} setIdeas={setIdeas} />}
      </PageContainer>
    </>
  );
}

function lastDraft(p: Post) {
  return p.versions[p.versions.length - 1].draft;
}

function copy(text: string, what = "Texto copiado.") {
  navigator.clipboard.writeText(text).then(() => toast.success(what));
}

function DueRow({ post, onPublished }: { post: Post; onPublished: (url: string) => void }) {
  const [url, setUrl] = useState("");
  const draft = lastDraft(post);
  return (
    <div className="flex flex-wrap items-center gap-2 text-foreground">
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{formatDate(post.scheduledAt)}</span> · {post.title}
      </span>
      <Button variant="outline" size="xs" onClick={() => copy(draft.text)}>
        <Copy01 /> Copiar texto
      </Button>
      {draft.firstComment && (
        <Button variant="outline" size="xs" onClick={() => copy(draft.firstComment ?? "", "Primeiro comentário copiado.")}>
          <Copy01 /> 1º comentário
        </Button>
      )}
      <Button variant="ghost" size="xs" asChild>
        <a href="https://www.linkedin.com/feed/?shareActive=true" target="_blank" rel="noreferrer">
          <LinkExternal01 /> LinkedIn
        </a>
      </Button>
      <Input className="h-7 w-52" placeholder="Link do post publicado" value={url} onChange={(e) => setUrl(e.target.value)} />
      <Button size="xs" onClick={() => onPublished(url)}>
        Marcar publicado
      </Button>
    </div>
  );
}

function PostRow({ post, open, onToggle, onPatch, onDelete }: { post: Post; open: boolean; onToggle: () => void; onPatch: (b: Record<string, unknown>) => Promise<Post>; onDelete: () => void }) {
  const ev = latestEvaluation(post.versions);
  const draft = lastDraft(post);
  const [when, setWhen] = useState(toLocalInput(post.scheduledAt));
  const [url, setUrl] = useState(post.publishedUrl ?? "");
  const [m, setM] = useState({ impressions: String(post.metrics?.impressions ?? ""), comments: String(post.metrics?.comments ?? ""), reactions: String(post.metrics?.reactions ?? "") });
  const daysSince = post.status === "publicado" ? (Date.now() - new Date(post.updatedAt).getTime()) / 86400000 : 0;
  const num = (s: string) => (s === "" ? undefined : Number(s));

  return (
    <li>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60">
        <ScorePill score={ev?.overall} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{post.title}</span>
          <span className="block text-meta">
            {FORMAT_LABEL[draft.format]} · {post.versions.length} {post.versions.length === 1 ? "versão" : "versões"} · {post.author}
            {post.scheduledAt && ` · ${formatDate(post.scheduledAt)}`}
          </span>
        </span>
        {post.status === "publicado" && !post.metrics?.impressions && daysSince >= 7 && (
          <Badge variant="muted" className="bg-warning/10 text-warning">
            Cole as métricas
          </Badge>
        )}
        <StatusBadge status={post.status} />
      </button>
      {open && (
        <div className="grid gap-6 border-t border-border bg-muted/40 px-4 py-4 md:grid-cols-[1fr_300px]">
          <div className="flex flex-col gap-3">
            <p className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">{draft.text}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link href={`/?post=${post.id}`}>Abrir no Avaliador</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => copy(draft.text)}>
                <Copy01 /> Copiar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive">
                    <Trash01 /> Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir este post?</AlertDialogTitle>
                    <AlertDialogDescription>Todas as versões e notas são apagadas. Isso não pode ser desfeito.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <Field label="Status" hint={post.sensitive ? (post.approvedBy ? `Sensível · aprovado por ${post.approvedBy}` : "Sensível · precisa de aprovação") : undefined}>
              <SimpleSelect<PostStatus>
                value={post.status}
                onValueChange={(s) => onPatch({ status: s })}
                options={(Object.keys(STATUS_LABEL) as PostStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              />
            </Field>
            <Field label="Agendado para">
              <div className="flex gap-2">
                <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                <Button variant="outline" disabled={!when} onClick={() => onPatch({ scheduledAt: new Date(when).toISOString(), status: "agendado" }).then(() => toast.success("Agendamento salvo."))}>
                  Salvar
                </Button>
              </div>
            </Field>
            {(post.status === "publicado" || post.status === "agendado") && (
              <Field label="Depois de publicar" hint="Cole as métricas 7 dias depois. Elas calibram a nota.">
                <Input placeholder="Link do post" value={url} onChange={(e) => setUrl(e.target.value)} />
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" placeholder="Impressões" value={m.impressions} onChange={(e) => setM({ ...m, impressions: e.target.value })} />
                  <Input type="number" placeholder="Comentários" value={m.comments} onChange={(e) => setM({ ...m, comments: e.target.value })} />
                  <Input type="number" placeholder="Reações" value={m.reactions} onChange={(e) => setM({ ...m, reactions: e.target.value })} />
                </div>
                <Button
                  variant="outline"
                  className="self-start"
                  onClick={() =>
                    onPatch({
                      status: "publicado",
                      publishedUrl: url || undefined,
                      metrics: { impressions: num(m.impressions), comments: num(m.comments), reactions: num(m.reactions), collectedAt: new Date().toISOString() },
                    }).then(() => toast.success("Métricas salvas."))
                  }
                >
                  Salvar métricas
                </Button>
              </Field>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function CalendarView({ posts }: { posts: Post[] }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startDay = (new Date(year, month, 1).getDay() + 6) % 7; // semana começa na segunda
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((startDay + daysInMonth) / 7) * 7 }, (_, i) => i - startDay + 1);
  const today = new Date();
  const scheduled = posts.filter((p) => p.scheduledAt);
  const tone: Partial<Record<PostStatus, string>> = { publicado: "bg-success/10 text-success", em_aprovacao: "bg-warning/10 text-warning" };

  return (
    <Card className="gap-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-medium capitalize">{cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h2>
        <div className="flex items-center gap-1">
          <IconButton label="Mês anterior" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft />
          </IconButton>
          <Button variant="ghost" size="xs" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>
            Hoje
          </Button>
          <IconButton label="Próximo mês" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            <ChevronRight />
          </IconButton>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-border text-center text-meta">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const inMonth = day >= 1 && day <= daysInMonth;
          const isToday = inMonth && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const items = inMonth
            ? scheduled.filter((p) => {
                const d = new Date(p.scheduledAt!);
                return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
              })
            : [];
          return (
            <div key={i} className={`min-h-24 border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0 ${inMonth ? "" : "bg-muted/40"}`}>
              {inMonth && <span className={`tnum inline-grid size-6 place-items-center rounded-full text-xs ${isToday ? "bg-brand font-medium text-brand-foreground" : "text-muted-foreground"}`}>{day}</span>}
              <div className="mt-1 flex flex-col gap-1">
                {items.map((p) => (
                  <Link key={p.id} href={`/?post=${p.id}`} className={`block truncate rounded-md px-1.5 py-1 text-[11px] font-medium ${tone[p.status] ?? "bg-special/10 text-special"}`}>
                    {new Date(p.scheduledAt!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} {p.title}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function IdeasView({ ideas, setIdeas }: { ideas: Idea[]; setIdeas: (f: (i: Idea[]) => Idea[]) => void }) {
  const [text, setText] = useState("");
  async function add() {
    if (!text.trim()) return;
    const res = await fetch("/api/ideas", { method: "POST", body: JSON.stringify({ text }) });
    const d = await res.json();
    setIdeas((i) => [d.idea, ...i]);
    setText("");
  }
  async function remove(id: string) {
    await fetch("/api/ideas", { method: "DELETE", body: JSON.stringify({ id }) });
    setIdeas((i) => i.filter((x) => x.id !== id));
  }
  const prompts = ["Um número da semana (bom ou ruim)", "Uma decisão difícil e por quê", "Um erro e o que mudou depois", "Um bastidor do produto que ninguém vê", "Algo que você desistiu de construir"];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <section className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input placeholder="Anote uma ideia de post" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <Button onClick={add} disabled={!text.trim()}>
            <Plus /> Anotar
          </Button>
        </div>
        {ideas.length === 0 ? (
          <Card>
            <EmptyState icon={<Lightbulb02 />} title="Nenhuma ideia anotada" description="Guarde aqui assuntos soltos e transforme em post depois." />
          </Card>
        ) : (
          <Card className="gap-0 overflow-hidden">
            <ul className="divide-y divide-border">
              {ideas.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <Lightbulb02 className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1">{i.text}</span>
                  <span className="text-meta">{formatDate(i.createdAt)}</span>
                  <IconButton label="Apagar ideia" onClick={() => remove(i.id)}>
                    <Trash01 />
                  </IconButton>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
      <Card className="h-fit gap-3 p-5">
        <h3 className="text-sm font-medium">Sem assunto? Tente</h3>
        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          {prompts.map((p) => (
            <li key={p}>
              <button className="text-left transition-colors hover:text-foreground" onClick={() => setText(p + ": ")}>
                {p}
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
