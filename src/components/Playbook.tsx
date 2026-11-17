"use client";
import { useEffect, useState } from "react";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { PageHeader, SeverityChip, Tabs } from "./ui";
import { useProfile } from "./useProfile";
import { FORMAT_LABEL, type PostFormat, type ReferencePost, type Rule, type RuleSeverity } from "@/lib/types";

type Tab = "guia" | "regras" | "referencias" | "prompts";

export function Playbook() {
  const [tab, setTab] = useState<Tab>("guia");
  const [rules, setRules] = useState<Rule[]>([]);
  const [version, setVersion] = useState(1);
  const [refs, setRefs] = useState<ReferencePost[]>([]);
  const { profile } = useProfile();
  const canEdit = profile.role === "curador";

  const loadRules = () => fetch("/api/rules").then((r) => r.json()).then((d) => { setRules(d.rules); setVersion(d.playbookVersion); });
  useEffect(() => {
    loadRules();
    fetch("/api/references").then((r) => r.json()).then((d) => setRefs(d.references ?? []));
  }, []);

  return (
    <div>
      <PageHeader title="Playbook" subtitle={`Como o time escreve para o LinkedIn. As regras alimentam a nota do Avaliador · versão ${version}`}>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "guia", label: "Guia" },
            { value: "regras", label: `Regras (${rules.filter((r) => r.active).length})` },
            { value: "referencias", label: `Referências (${refs.length})` },
            { value: "prompts", label: "Prompts" },
          ]}
        />
      </PageHeader>
      <div className="px-4 md:px-8 py-6">
        {!canEdit && tab !== "guia" && tab !== "prompts" && (
          <p className="mb-4 rounded-[0.625rem] bg-muted px-3 py-2 text-xs text-muted-foreground">Só o curador edita regras e referências. Troque o papel no seu perfil (canto inferior esquerdo) para testar.</p>
        )}
        {tab === "guia" && <Guide />}
        {tab === "regras" && <Rules rules={rules} canEdit={canEdit} reload={loadRules} />}
        {tab === "referencias" && <References refs={refs} setRefs={setRefs} canEdit={canEdit} />}
        {tab === "prompts" && <Prompts rules={rules} />}
      </div>
    </div>
  );
}

function Guide() {
  const hooks = [
    { name: "Número", ex: "Deletamos 40% do código em uma semana. A conversão subiu." },
    { name: "Contraste", ex: "Todo mundo pediu essa feature. Ninguém usou." },
    { name: "Confissão", ex: "Eu derrubei a produção numa sexta às 18h." },
    { name: "Bastidor", ex: "O print abaixo é o Slack do time 10 minutos antes do lançamento." },
    { name: "Pergunta", ex: "Você pagaria R$ 0,50 por cada venda que a IA recuperar?" },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="space-y-6">
        <section className="surface p-6">
          <h2 className="text-lg font-semibold tracking-tight">Build in public, do nosso jeito</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Mostrar o processo, não só o resultado: números reais, decisões, erros e bastidores. O objetivo é criar conversa com quem constrói como a gente. Tudo que envolve cliente ou número financeiro interno passa pelo curador antes de sair.
          </p>
        </section>
        <section className="surface p-6">
          <h3 className="font-semibold">Anatomia de um bom post</h3>
          <ol className="mt-3 space-y-3 text-sm">
            <li><span className="font-medium">1. Hook (antes do “ver mais”).</span> <span className="text-muted-foreground">Uma ou duas linhas curtas que criam curiosidade. No mobile, só ~140 caracteres aparecem.</span></li>
            <li><span className="font-medium">2. Desenvolvimento.</span> <span className="text-muted-foreground">Uma ideia central, blocos curtos com respiro, pelo menos um número ou exemplo concreto.</span></li>
            <li><span className="font-medium">3. Fechamento.</span> <span className="text-muted-foreground">Uma lição, uma conclusão forte ou uma pergunta que convide a comentar.</span></li>
            <li><span className="font-medium">4. Primeiro comentário.</span> <span className="text-muted-foreground">Links externos vão aqui, não no corpo do post.</span></li>
          </ol>
        </section>
        <section className="surface p-6">
          <h3 className="font-semibold">Tipos de hook</h3>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {hooks.map((h) => (
              <li key={h.name} className="rounded-[0.625rem] bg-muted p-3 text-sm">
                <span className="chip bg-brand text-brand-foreground">{h.name}</span>
                <p className="mt-2">“{h.ex}”</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="surface p-6">
          <h3 className="font-semibold">Formatos</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><span className="font-medium text-foreground">Texto puro:</span> melhor para histórias e opiniões com bastidor.</li>
            <li><span className="font-medium text-foreground">Texto + imagem:</span> prints reais (dashboards, Slack, código) valem mais que imagens de banco.</li>
            <li><span className="font-medium text-foreground">Carrossel:</span> passo a passo, frameworks, antes e depois. Uma ideia por página, letra grande.</li>
            <li><span className="font-medium text-foreground">Vídeo:</span> curto, com legenda e capa que já conta a história.</li>
            <li><span className="font-medium text-foreground">Enquete:</span> pergunta específica com opções que dividem opinião.</li>
            <li><span className="font-medium text-foreground">Artigo:</span> conteúdo longo e perene; título e abertura fazem o trabalho do hook.</li>
          </ul>
        </section>
      </article>
      <aside className="space-y-4">
        <section className="rounded-[1rem] bg-brand p-5 text-brand-foreground">
          <h3 className="font-semibold">Pilares de conteúdo</h3>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• Produto: o que mudou e por quê</li>
            <li>• Engenharia: decisões e erros</li>
            <li>• Clientes: resultados (com aprovação)</li>
            <li>• Cultura: como o time trabalha</li>
            <li>• Números da semana</li>
          </ul>
        </section>
        <section className="surface p-5 text-sm">
          <h3 className="font-semibold">Ritual sugerido</h3>
          <p className="mt-2 text-muted-foreground">2 posts por semana por pessoa. Avalie antes de publicar, cole as métricas 7 dias depois. Quando alguém publicar, o time comenta na primeira hora.</p>
        </section>
      </aside>
    </div>
  );
}

const EMPTY_RULE: Omit<Rule, "id"> = { name: "", description: "", severity: "recomendacao", check: "ia", active: true };

function Rules({ rules, canEdit, reload }: { rules: Rule[]; canEdit: boolean; reload: () => void }) {
  const [form, setForm] = useState(EMPTY_RULE);
  const [adding, setAdding] = useState(false);
  async function patch(id: string, body: Partial<Rule>) {
    await fetch("/api/rules", { method: "PATCH", body: JSON.stringify({ id, ...body }) });
    reload();
  }
  async function add() {
    await fetch("/api/rules", { method: "POST", body: JSON.stringify(form) });
    setForm(EMPTY_RULE);
    setAdding(false);
    reload();
  }
  async function remove(id: string) {
    if (!confirm("Excluir esta regra?")) return;
    await fetch("/api/rules", { method: "DELETE", body: JSON.stringify({ id }) });
    reload();
  }
  return (
    <div className="space-y-4">
      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Ativa</th>
              <th className="px-4 py-2.5 font-medium">Regra</th>
              <th className="px-4 py-2.5 font-medium">Tipo</th>
              <th className="px-4 py-2.5 font-medium">Checagem</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.map((r) => (
              <tr key={r.id} className={r.active ? "" : "opacity-50"}>
                <td className="px-4 py-3 align-top">
                  <input type="checkbox" className="accent-[var(--brand-foreground)]" disabled={!canEdit} checked={r.active} onChange={(e) => patch(r.id, { active: e.target.checked })} />
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-muted-foreground">{r.description}</div>
                  {r.badExample && <div className="mt-1 text-xs text-destructive">✗ {r.badExample}</div>}
                  {r.goodExample && <div className="text-xs text-success">✓ {r.goodExample}</div>}
                </td>
                <td className="px-4 py-3 align-top">
                  {canEdit ? (
                    <select className="field !w-36 !py-1 text-xs" value={r.severity} onChange={(e) => patch(r.id, { severity: e.target.value as RuleSeverity })}>
                      <option value="bloqueante">Bloqueante</option>
                      <option value="forte">Forte</option>
                      <option value="recomendacao">Recomendação</option>
                    </select>
                  ) : (
                    <SeverityChip severity={r.severity} />
                  )}
                </td>
                <td className="px-4 py-3 align-top text-muted-foreground">{r.check === "codigo" ? "Código" : "IA"}</td>
                <td className="px-4 py-3 align-top">
                  {canEdit && <button className="btn btn-ghost !p-1.5" aria-label="Excluir regra" onClick={() => remove(r.id)}><Trash2 size={13} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit &&
        (adding ? (
          <div className="surface grid gap-3 p-4 md:grid-cols-2">
            <input className="field" placeholder="Nome da regra" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="field" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as RuleSeverity })}>
              <option value="bloqueante">Bloqueante</option>
              <option value="forte">Forte</option>
              <option value="recomendacao">Recomendação</option>
            </select>
            <textarea className="field md:col-span-2" placeholder="Descrição: o que a IA deve checar" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <input className="field" placeholder="Exemplo ruim (opcional)" value={form.badExample ?? ""} onChange={(e) => setForm({ ...form, badExample: e.target.value })} />
            <input className="field" placeholder="Exemplo bom (opcional)" value={form.goodExample ?? ""} onChange={(e) => setForm({ ...form, goodExample: e.target.value })} />
            <p className="text-xs text-muted-foreground md:col-span-2">Regras novas são checadas pela IA. Checagens por código precisam ser programadas em src/lib/checks.ts.</p>
            <div className="flex gap-2">
              <button className="btn btn-primary" disabled={!form.name || !form.description} onClick={add}>Adicionar regra</button>
              <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-secondary" onClick={() => setAdding(true)}><Plus size={14} />Nova regra</button>
        ))}
    </div>
  );
}

function References({ refs, setRefs, canEdit }: { refs: ReferencePost[]; setRefs: (r: ReferencePost[]) => void; canEdit: boolean }) {
  const blank = { author: "", text: "", url: "", format: "texto" as PostFormat, tags: "", impressions: "", comments: "", why: "" };
  const [form, setForm] = useState(blank);
  const [adding, setAdding] = useState(false);
  async function add() {
    const body = {
      author: form.author || "Time",
      text: form.text,
      url: form.url || undefined,
      format: form.format,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      impressions: form.impressions ? Number(form.impressions) : undefined,
      comments: form.comments ? Number(form.comments) : undefined,
      why: form.why,
      approved: true,
    };
    const res = await fetch("/api/references", { method: "POST", body: JSON.stringify(body) });
    const d = await res.json();
    setRefs([d.reference, ...refs]);
    setForm(blank);
    setAdding(false);
  }
  async function remove(id: string) {
    if (!confirm("Remover esta referência?")) return;
    await fetch("/api/references", { method: "DELETE", body: JSON.stringify({ id }) });
    setRefs(refs.filter((r) => r.id !== id));
  }
  async function toggle(r: ReferencePost) {
    await fetch("/api/references", { method: "PATCH", body: JSON.stringify({ id: r.id, approved: !r.approved }) });
    setRefs(refs.map((x) => (x.id === r.id ? { ...x, approved: !x.approved } : x)));
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Posts que performaram bem (impressões + comentários). O Avaliador escolhe os 3 mais parecidos com cada post e usa como parâmetro de qualidade. Os exemplos iniciais são ilustrativos: troque por posts reais.</p>
      {canEdit &&
        (adding ? (
          <div className="surface grid gap-3 p-4 md:grid-cols-2">
            <textarea className="field min-h-40 md:col-span-2" placeholder="Texto do post" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
            <input className="field" placeholder="Autor" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
            <input className="field" placeholder="Link do post" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            <select className="field" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value as PostFormat })}>
              {(Object.keys(FORMAT_LABEL) as PostFormat[]).map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
            </select>
            <input className="field" placeholder="Tags separadas por vírgula" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            <input className="field" type="number" placeholder="Impressões" value={form.impressions} onChange={(e) => setForm({ ...form, impressions: e.target.value })} />
            <input className="field" type="number" placeholder="Comentários" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} />
            <input className="field md:col-span-2" placeholder="Por que funciona?" value={form.why} onChange={(e) => setForm({ ...form, why: e.target.value })} />
            <div className="flex gap-2">
              <button className="btn btn-primary" disabled={!form.text || !form.why} onClick={add}>Adicionar referência</button>
              <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-secondary" onClick={() => setAdding(true)}><Plus size={14} />Nova referência</button>
        ))}
      <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {refs.map((r) => (
          <li key={r.id} className={`surface flex flex-col p-4 ${r.approved ? "" : "opacity-60"}`}>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="chip">{FORMAT_LABEL[r.format]}</span>
              {r.tags.map((t) => <span key={t} className="chip bg-brand-tint text-brand-foreground">{t}</span>)}
            </div>
            <p className="line-clamp-[10] flex-1 whitespace-pre-wrap text-sm">{r.text}</p>
            <p className="mt-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">Por que funciona:</span> {r.why}</p>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
              <span>
                {r.author}
                {r.impressions ? ` · ${r.impressions.toLocaleString("pt-BR")} impr.` : ""}
                {r.comments ? ` · ${r.comments} coment.` : ""}
              </span>
              {canEdit && (
                <span className="flex gap-1">
                  <button className="btn btn-ghost !px-2 !py-1" onClick={() => toggle(r)}>{r.approved ? "Desativar" : "Aprovar"}</button>
                  <button className="btn btn-ghost !p-1.5" aria-label="Remover referência" onClick={() => remove(r.id)}><Trash2 size={13} /></button>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Prompts({ rules }: { rules: Rule[] }) {
  const ruleLines = rules.filter((r) => r.active).map((r) => `- ${r.name}: ${r.description}`).join("\n");
  const templates = [
    {
      title: "Escrever um post a partir de uma ideia",
      body: `Você é meu ghostwriter de LinkedIn. Escreva um post de build in public sobre: [SUA IDEIA].\n\nContexto: [o que aconteceu, números, o que você aprendeu]\n\nRegras do meu time:\n${ruleLines}\n\nFormato:\n- Hook de no máximo 2 linhas curtas (até 140 caracteres) que gere curiosidade\n- Blocos curtos com respiro\n- Pelo menos um número ou detalhe concreto\n- Termine com uma pergunta que convide a comentar\n- Escreva como eu falo, sem clichês de IA. Não use emojis como marcadores.`,
    },
    {
      title: "Gerar 5 hooks para um rascunho",
      body: `Aqui está meu rascunho de post para o LinkedIn:\n\n[COLE O RASCUNHO]\n\nEscreva 5 hooks alternativos, cada um com até 140 caracteres, usando estilos diferentes: número, contraste, confissão, bastidor e pergunta. Mantenha meu tom de voz.`,
    },
    {
      title: "Transformar um aprendizado técnico em post",
      body: `Transforme este aprendizado técnico em um post de LinkedIn para pessoas que não são da área:\n\n[O QUE ACONTECEU / O PROBLEMA / A SOLUÇÃO]\n\nRegras:\n${ruleLines}\n\nMostre o erro ou a decisão real, o impacto em número e a lição. Nada de jargão sem explicação.`,
    },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {templates.map((t) => <PromptCard key={t.title} title={t.title} body={t.body} />)}
      <p className="text-xs text-muted-foreground lg:col-span-3">Os prompts já incluem as regras ativas do Playbook. Cole no Claude ou no ChatGPT, depois traga o resultado para o Avaliador.</p>
    </div>
  );
}

function PromptCard({ title, body }: { title: string; body: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="surface flex flex-col p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <pre className="mt-2 max-h-72 flex-1 overflow-y-auto whitespace-pre-wrap rounded-[0.625rem] bg-muted p-3 font-sans text-xs text-muted-foreground">{body}</pre>
      <button
        className="btn btn-primary mt-3 self-start"
        onClick={async () => {
          await navigator.clipboard.writeText(body);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copiado" : "Copiar prompt"}
      </button>
    </section>
  );
}
