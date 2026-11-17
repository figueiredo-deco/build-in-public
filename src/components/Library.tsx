"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, Lightbulb, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader, ScorePill, StatusChip, Tabs, formatDate, latestEvaluation, toLocalInput } from "./ui";
import { useProfile } from "./useProfile";
import { FORMAT_LABEL, STATUS_LABEL, type Idea, type Post, type PostStatus } from "@/lib/types";

type View = "lista" | "calendario" | "ideias";

export function Library() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [view, setView] = useState<View>("lista");
  const [status, setStatus] = useState<PostStatus | "todos">("todos");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const { profile } = useProfile();

  const load = () => {
    fetch("/api/posts").then((r) => r.json()).then((d) => setPosts(d.posts ?? []));
    fetch("/api/ideas").then((r) => r.json()).then((d) => setIdeas(d.ideas ?? []));
  };
  useEffect(load, []);

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/posts/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    const d = await res.json();
    setPosts((ps) => ps.map((p) => (p.id === id ? d.post : p)));
  }
  async function remove(id: string) {
    if (!confirm("Excluir este post da Biblioteca? Isso não pode ser desfeito.")) return;
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
    setPosts((ps) => ps.filter((p) => p.id !== id));
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
          if (!text.includes(q.toLowerCase()) && !p.title.toLowerCase().includes(q.toLowerCase())) return false;
        }
        return true;
      }),
    [posts, status, q],
  );

  const counts = useMemo(() => {
    const c: Partial<Record<PostStatus, number>> = {};
    for (const p of posts) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [posts]);

  return (
    <div>
      <PageHeader title="Biblioteca" subtitle="Rascunhos, posts agendados e publicados, com a nota de cada versão.">
        <div className="flex items-center gap-2">
          <Tabs value={view} onChange={setView} items={[{ value: "lista", label: "Lista" }, { value: "calendario", label: "Calendário" }, { value: "ideias", label: `Ideias${ideas.length ? ` (${ideas.length})` : ""}` }]} />
          <Link href="/" className="btn btn-primary"><Plus size={14} />Novo post</Link>
        </div>
      </PageHeader>

      <div className="space-y-6 px-4 md:px-8 py-6">
        {due.length > 0 && (
          <section className="rounded-[1rem] bg-brand-tint p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-foreground"><Bell size={15} />Hora de publicar</div>
            <ul className="space-y-2">
              {due.map((p) => (
                <DueRow key={p.id} post={p} onPublished={(url) => patch(p.id, { status: "publicado", publishedUrl: url || undefined })} />
              ))}
            </ul>
          </section>
        )}

        {pendingApproval.length > 0 && (
          <section className="rounded-[1rem] bg-yellow-tint p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-warning"><ShieldCheck size={15} />Aguardando aprovação do curador ({pendingApproval.length})</div>
            <ul className="space-y-1.5">
              {pendingApproval.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{p.title} <span className="text-muted-foreground">· {p.author}</span></span>
                  <span className="flex gap-2">
                    <Link className="btn btn-ghost !py-1" href={`/?post=${p.id}`}>Revisar</Link>
                    {profile.role === "curador" ? (
                      <button className="btn btn-primary !py-1" onClick={() => patch(p.id, { approve: true, approvedBy: profile.name })}><Check size={13} />Aprovar</button>
                    ) : (
                      <span className="text-xs text-muted-foreground self-center">Só o curador aprova</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {view === "lista" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle-foreground" />
                <input className="field !pl-8" placeholder="Buscar no texto" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              {(["todos", "rascunho", "em_aprovacao", "pronto", "agendado", "publicado", "arquivado"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary-hover"}`}
                >
                  {s === "todos" ? "Todos" : STATUS_LABEL[s]}
                  {s !== "todos" && counts[s] ? ` ${counts[s]}` : ""}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="surface p-10 text-center">
                <p className="text-sm text-muted-foreground">{posts.length ? "Nenhum post com esse filtro." : "Sua biblioteca está vazia. Avalie um post e salve como rascunho ou agende."}</p>
                {!posts.length && <Link href="/" className="btn btn-brand mt-4">Avaliar meu primeiro post</Link>}
              </div>
            ) : (
              <ul className="surface divide-y divide-border">
                {filtered.map((p) => (
                  <PostRow key={p.id} post={p} open={openId === p.id} onToggle={() => setOpenId(openId === p.id ? null : p.id)} onPatch={(b) => patch(p.id, b)} onDelete={() => remove(p.id)} />
                ))}
              </ul>
            )}
          </>
        )}

        {view === "calendario" && <CalendarView posts={posts} />}
        {view === "ideias" && <IdeasView ideas={ideas} setIdeas={setIdeas} />}
      </div>
    </div>
  );
}

function lastText(p: Post) {
  return p.versions[p.versions.length - 1]?.draft.text ?? "";
}

function DueRow({ post, onPublished }: { post: Post; onPublished: (url: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  const draft = post.versions[post.versions.length - 1].draft;
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-[0.625rem] bg-card p-3 text-sm shadow-edge">
      <span className="min-w-0 flex-1 truncate"><span className="font-medium">{formatDate(post.scheduledAt)}</span> · {post.title}</span>
      <button
        className="btn btn-secondary !py-1"
        onClick={async () => {
          await navigator.clipboard.writeText(draft.text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copiado" : "Copiar texto"}
      </button>
      {draft.firstComment && (
        <button className="btn btn-ghost !py-1" onClick={() => navigator.clipboard.writeText(draft.firstComment ?? "")}><Copy size={13} />1º comentário</button>
      )}
      <a className="btn btn-ghost !py-1" href="https://www.linkedin.com/feed/?shareActive=true" target="_blank" rel="noreferrer"><ExternalLink size={13} />Abrir LinkedIn</a>
      <input className="field !w-56 !py-1" placeholder="Link do post publicado" value={url} onChange={(e) => setUrl(e.target.value)} />
      <button className="btn btn-primary !py-1" onClick={() => onPublished(url)}>Marcar publicado</button>
    </li>
  );
}

function PostRow({ post, open, onToggle, onPatch, onDelete }: { post: Post; open: boolean; onToggle: () => void; onPatch: (b: Record<string, unknown>) => void; onDelete: () => void }) {
  const ev = latestEvaluation(post.versions);
  const draft = post.versions[post.versions.length - 1].draft;
  const [when, setWhen] = useState(toLocalInput(post.scheduledAt));
  const [url, setUrl] = useState(post.publishedUrl ?? "");
  const [m, setM] = useState({ impressions: post.metrics?.impressions ?? "", comments: post.metrics?.comments ?? "", reactions: post.metrics?.reactions ?? "" });
  const daysSince = post.status === "publicado" ? (Date.now() - new Date(post.updatedAt).getTime()) / 86400000 : 0;

  return (
    <li>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary/60">
        <ScorePill score={ev?.overall} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{post.title}</span>
          <span className="block text-xs text-muted-foreground">
            {FORMAT_LABEL[draft.format]} · {post.versions.length} versão(ões) · {post.author}
            {post.scheduledAt && ` · ${formatDate(post.scheduledAt)}`}
          </span>
        </span>
        {post.status === "publicado" && !post.metrics?.impressions && daysSince >= 7 && <span className="chip bg-yellow-tint text-warning">Cole as métricas</span>}
        <StatusChip status={post.status} />
      </button>
      {open && (
        <div className="grid gap-4 border-t border-border bg-sidebar px-4 py-4 md:grid-cols-[1fr_320px]">
          <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">{lastText(post)}</p>
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Link href={`/?post=${post.id}`} className="btn btn-primary !py-1">Abrir no Avaliador</Link>
              <button className="btn btn-ghost !py-1" onClick={() => navigator.clipboard.writeText(lastText(post))}><Copy size={13} />Copiar</button>
              <button className="btn btn-ghost !py-1 text-destructive" onClick={onDelete}><Trash2 size={13} />Excluir</button>
            </div>
            <label className="block space-y-1">
              <span className="label">Status</span>
              <select className="field" value={post.status} onChange={(e) => onPatch({ status: e.target.value })}>
                {(Object.keys(STATUS_LABEL) as PostStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </label>
            {post.sensitive && <p className="text-xs text-warning">Post sensível {post.approvedBy ? `· aprovado por ${post.approvedBy}` : "· precisa de aprovação"}</p>}
            <label className="block space-y-1">
              <span className="label">Agendado para</span>
              <div className="flex gap-2">
                <input type="datetime-local" className="field" value={when} onChange={(e) => setWhen(e.target.value)} />
                <button className="btn btn-secondary" disabled={!when} onClick={() => onPatch({ scheduledAt: new Date(when).toISOString(), status: "agendado" })}>Salvar</button>
              </div>
            </label>
            {(post.status === "publicado" || post.status === "agendado") && (
              <div className="space-y-2 rounded-[0.625rem] bg-card p-3 shadow-edge">
                <span className="label">Depois de publicar (métricas 7 dias depois)</span>
                <input className="field" placeholder="Link do post" value={url} onChange={(e) => setUrl(e.target.value)} />
                <div className="grid grid-cols-3 gap-2">
                  <input className="field" type="number" placeholder="Impressões" value={m.impressions} onChange={(e) => setM({ ...m, impressions: e.target.value })} />
                  <input className="field" type="number" placeholder="Comentários" value={m.comments} onChange={(e) => setM({ ...m, comments: e.target.value })} />
                  <input className="field" type="number" placeholder="Reações" value={m.reactions} onChange={(e) => setM({ ...m, reactions: e.target.value })} />
                </div>
                <button
                  className="btn btn-primary !py-1"
                  onClick={() =>
                    onPatch({
                      status: "publicado",
                      publishedUrl: url || undefined,
                      metrics: {
                        impressions: m.impressions === "" ? undefined : Number(m.impressions),
                        comments: m.comments === "" ? undefined : Number(m.comments),
                        reactions: m.reactions === "" ? undefined : Number(m.reactions),
                        collectedAt: new Date().toISOString(),
                      },
                    })
                  }
                >
                  Salvar métricas
                </button>
              </div>
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
  const first = new Date(year, month, 1);
  const startDay = (first.getDay() + 6) % 7; // semana começa na segunda
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((startDay + daysInMonth) / 7) * 7 }, (_, i) => i - startDay + 1);
  const today = new Date();
  const scheduled = posts.filter((p) => p.scheduledAt);

  return (
    <section className="surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold capitalize">{cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h2>
        <div className="flex gap-1">
          <button className="btn btn-ghost !p-2" aria-label="Mês anterior" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button>
          <button className="btn btn-ghost !py-1" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>Hoje</button>
          <button className="btn btn-ghost !p-2" aria-label="Próximo mês" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-border text-center text-xs font-medium text-muted-foreground">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => <div key={d} className="py-2">{d}</div>)}
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
            <div key={i} className={`min-h-24 border-b border-r border-border p-1.5 ${inMonth ? "" : "bg-sidebar"}`}>
              {inMonth && (
                <span className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs ${isToday ? "bg-brand font-semibold text-brand-foreground" : "text-muted-foreground"}`}>{day}</span>
              )}
              <div className="mt-1 space-y-1">
                {items.map((p) => (
                  <Link key={p.id} href={`/?post=${p.id}`} className={`block truncate rounded-md px-1.5 py-1 text-[11px] font-medium ${p.status === "publicado" ? "bg-brand-tint text-brand-foreground" : p.status === "em_aprovacao" ? "bg-yellow-tint text-warning" : "bg-purple-tint text-special"}`}>
                    {new Date(p.scheduledAt!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} {p.title}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
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
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <section className="space-y-3">
        <div className="flex gap-2">
          <input className="field" placeholder="Anote uma ideia de post…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className="btn btn-primary" onClick={add}><Plus size={14} />Anotar</button>
        </div>
        {ideas.length === 0 ? (
          <p className="surface p-8 text-center text-sm text-muted-foreground">Nenhuma ideia ainda. Anote aqui assuntos soltos e transforme em post depois.</p>
        ) : (
          <ul className="surface divide-y divide-border">
            {ideas.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Lightbulb size={14} className="shrink-0 text-brand-soft" />
                <span className="flex-1">{i.text}</span>
                <span className="text-xs text-subtle-foreground">{formatDate(i.createdAt)}</span>
                <button className="btn btn-ghost !p-1.5" aria-label="Apagar ideia" onClick={() => remove(i.id)}><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <aside className="surface h-fit p-4">
        <h3 className="mb-2 text-sm font-semibold">Sem assunto? Tente</h3>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {prompts.map((p) => (
            <li key={p}>
              <button className="text-left hover:text-foreground" onClick={() => setText(p + ": ")}>→ {p}</button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
