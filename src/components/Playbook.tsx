"use client";
import { useEffect, useState } from "react";
import { Copy01, Plus, Trash01 } from "@untitledui/icons";
import { Alert, AlertDescription } from "@decocms/ui/components/alert";
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
import { Card, CardContent, CardHeader, CardTitle } from "@decocms/ui/components/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@decocms/ui/components/dialog";
import { IconButton } from "@decocms/ui/components/icon-button";
import { Input } from "@decocms/ui/components/input";
import { toast } from "@decocms/ui/components/sonner";
import { Switch } from "@decocms/ui/components/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@decocms/ui/components/table";
import { Tabs, TabsList, TabsTrigger } from "@decocms/ui/components/tabs";
import { Textarea } from "@decocms/ui/components/textarea";
import { Field, PageContainer, PageHeader, SeverityBadge, SimpleSelect } from "./ui";
import { useProfile } from "./useProfile";
import { FORMAT_LABEL, type PostFormat, type ReferencePost, type Rule, type RuleSeverity } from "@/lib/types";

type Tab = "guia" | "regras" | "referencias" | "prompts";

const SEVERITY_OPTIONS: { value: RuleSeverity; label: string }[] = [
  { value: "bloqueante", label: "Bloqueante" },
  { value: "forte", label: "Forte" },
  { value: "recomendacao", label: "Recomendação" },
];

export function Playbook() {
  const [tab, setTab] = useState<Tab>("guia");
  const [rules, setRules] = useState<Rule[]>([]);
  const [version, setVersion] = useState(1);
  const [refs, setRefs] = useState<ReferencePost[]>([]);
  const { profile } = useProfile();
  const canEdit = profile.role === "curador";

  const loadRules = () =>
    fetch("/api/rules")
      .then((r) => r.json())
      .then((d) => {
        setRules(d.rules);
        setVersion(d.playbookVersion);
      });
  useEffect(() => {
    loadRules();
    fetch("/api/references").then((r) => r.json()).then((d) => setRefs(d.references ?? []));
  }, []);

  return (
    <>
      <PageHeader
        crumb="Playbook"
        toolbar={
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList>
              <TabsTrigger value="guia">Guia</TabsTrigger>
              <TabsTrigger value="regras">Regras · {rules.filter((r) => r.active).length}</TabsTrigger>
              <TabsTrigger value="referencias">Referências · {refs.length}</TabsTrigger>
              <TabsTrigger value="prompts">Prompts</TabsTrigger>
            </TabsList>
          </Tabs>
        }
        actions={
          <>
            <Badge variant="muted">v{version}</Badge>
            {canEdit && tab === "regras" && <RuleDialog onSaved={loadRules} />}
            {canEdit && tab === "referencias" && <ReferenceDialog onSaved={(r) => setRefs([r, ...refs])} />}
          </>
        }
      />
      <PageContainer width={tab === "guia" ? "reading" : tab === "regras" ? "standard" : "wide"} className="flex flex-col gap-6">
        {!canEdit && (tab === "regras" || tab === "referencias") && (
          <Alert variant="info">
            <AlertDescription>Só o curador edita. Troque o papel no seu perfil, no rodapé da barra lateral.</AlertDescription>
          </Alert>
        )}
        {tab === "guia" && <Guide />}
        {tab === "regras" && <Rules rules={rules} canEdit={canEdit} reload={loadRules} />}
        {tab === "referencias" && <References refs={refs} setRefs={setRefs} canEdit={canEdit} />}
        {tab === "prompts" && <Prompts rules={rules} />}
      </PageContainer>
    </>
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
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Build in public, do nosso jeito</h2>
        <Card className="p-5 text-sm leading-relaxed text-muted-foreground">
          Mostrar o processo, não só o resultado: números reais, decisões, erros e bastidores. O objetivo é criar conversa com quem constrói como a gente. Tudo que envolve cliente ou número financeiro interno passa pelo curador antes de sair.
        </Card>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Regras de ouro</h2>
        <Card className="gap-0 overflow-hidden">
          <ul className="divide-y divide-border text-sm">
            {[
              ["Um idioma por post", "Nunca misture português e inglês no mesmo texto."],
              ["Página da empresa em inglês", "A company page fala com o mercado global. Perfis pessoais escolhem o idioma do seu público."],
              ["No máximo 1 post por dia", "Mais que isso divide o alcance entre os posts."],
              ["Não edite depois de publicar", "A edição prejudica a entrega do algoritmo. Revise antes."],
              ["Respeite a escolha de quem lê", "Não diminua quem usa outra solução ou tem time interno: pode ser cliente."],
              ["Fale com quem compra", "Nossos clientes são Millennials e Gen X. Conteúdo sóbrio e reputacional também é necessário."],
            ].map(([t, d]) => (
              <li key={t} className="flex flex-col gap-0.5 px-5 py-3">
                <span className="font-medium">{t}</span>
                <span className="text-muted-foreground">{d}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Anatomia de um bom post</h2>
        <Card className="gap-0 overflow-hidden">
          <ol className="divide-y divide-border text-sm">
            {[
              ["Hook, antes do “ver mais”", "Uma ou duas linhas curtas que criam curiosidade. No mobile, só ~140 caracteres aparecem."],
              ["Desenvolvimento", "Uma ideia central, blocos curtos com respiro, pelo menos um número ou exemplo concreto."],
              ["Fechamento", "Uma lição, uma conclusão forte ou uma pergunta que convide a comentar."],
              ["Primeiro comentário", "Links externos vão aqui, não no corpo do post."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3 px-5 py-3">
                <span className="tnum text-muted-foreground">{i + 1}</span>
                <span>
                  <span className="font-medium">{t}</span>
                  <span className="block text-muted-foreground">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Tipos de hook</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {hooks.map((h) => (
            <Card key={h.name} className="gap-2 p-4 text-sm">
              <Badge variant="muted" className="bg-brand-lime-tint text-brand-foreground">
                {h.name}
              </Badge>
              <p>“{h.ex}”</p>
            </Card>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Formatos</h2>
        <Card className="gap-0 overflow-hidden">
          <ul className="divide-y divide-border text-sm">
            {[
              ["Texto", "Histórias e opiniões com bastidor."],
              ["Imagem", "Prints reais (dashboards, Slack, código) valem mais que imagens de banco."],
              ["Carrossel", "Passo a passo, frameworks, antes e depois. Uma ideia por página, letra grande."],
              ["Vídeo", "Curto, com legenda e uma capa que já conta a história."],
              ["Enquete", "Pergunta específica com opções que dividem opinião."],
              ["Artigo", "Conteúdo longo e perene; título e abertura fazem o papel do hook."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-4 px-5 py-3">
                <span className="w-20 shrink-0 font-medium">{t}</span>
                <span className="text-muted-foreground">{d}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Pilares e ritual</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="gap-2 bg-brand-lime-tint p-5 text-sm text-brand-foreground">
            <span className="font-medium">Pilares de conteúdo</span>
            <span>Produto · Engenharia · Clientes (com aprovação) · Cultura · Números da semana</span>
          </Card>
          <Card className="gap-2 p-5 text-sm">
            <span className="font-medium">Ritual</span>
            <span className="text-muted-foreground">2 posts por semana por pessoa. Métricas 7 dias depois. Quando alguém publica, o time comenta na primeira hora.</span>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Rules({ rules, canEdit, reload }: { rules: Rule[]; canEdit: boolean; reload: () => void }) {
  async function patch(id: string, body: Partial<Rule>) {
    await fetch("/api/rules", { method: "PATCH", body: JSON.stringify({ id, ...body }) });
    reload();
  }
  async function remove(id: string) {
    await fetch("/api/rules", { method: "DELETE", body: JSON.stringify({ id }) });
    reload();
    toast.success("Regra excluída.");
  }
  return (
    <Card className="gap-0 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 pl-5">Ativa</TableHead>
            <TableHead>Regra</TableHead>
            <TableHead className="w-44">Tipo</TableHead>
            <TableHead className="w-24">Checagem</TableHead>
            {canEdit && <TableHead className="w-12" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((r) => (
            <TableRow key={r.id} className={r.active ? "" : "opacity-50"}>
              <TableCell className="pl-5 align-top">
                <Switch checked={r.active} disabled={!canEdit} onCheckedChange={(v) => patch(r.id, { active: v })} aria-label={`Ativar ${r.name}`} />
              </TableCell>
              <TableCell className="align-top whitespace-normal">
                <div className="font-medium">{r.name}</div>
                <div className="text-muted-foreground">{r.description}</div>
                {r.badExample && <div className="mt-1 text-xs text-destructive">Evite: {r.badExample}</div>}
                {r.goodExample && <div className="text-xs text-success">Prefira: {r.goodExample}</div>}
              </TableCell>
              <TableCell className="align-top">
                {canEdit ? <SimpleSelect<RuleSeverity> size="sm" value={r.severity} onValueChange={(severity) => patch(r.id, { severity })} options={SEVERITY_OPTIONS} /> : <SeverityBadge severity={r.severity} />}
              </TableCell>
              <TableCell className="align-top text-muted-foreground">{r.check === "codigo" ? "Código" : "IA"}</TableCell>
              {canEdit && (
                <TableCell className="align-top">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <IconButton label="Excluir regra">
                        <Trash01 />
                      </IconButton>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir “{r.name}”?</AlertDialogTitle>
                        <AlertDialogDescription>As próximas avaliações deixam de checar essa regra.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(r.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

const EMPTY_RULE: Omit<Rule, "id"> = { name: "", description: "", severity: "recomendacao", check: "ia", active: true };

function RuleDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_RULE);
  async function add() {
    await fetch("/api/rules", { method: "POST", body: JSON.stringify(form) });
    setForm(EMPTY_RULE);
    setOpen(false);
    onSaved();
    toast.success("Regra adicionada.");
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Nova regra
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova regra</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Nome">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="O que a IA deve checar" hint="Regras novas são checadas pela IA.">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Tipo" hint="Bloqueante manda o post para aprovação.">
            <SimpleSelect<RuleSeverity> value={form.severity} onValueChange={(severity) => setForm({ ...form, severity })} options={SEVERITY_OPTIONS} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Exemplo ruim">
              <Input value={form.badExample ?? ""} onChange={(e) => setForm({ ...form, badExample: e.target.value })} />
            </Field>
            <Field label="Exemplo bom">
              <Input value={form.goodExample ?? ""} onChange={(e) => setForm({ ...form, goodExample: e.target.value })} />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!form.name || !form.description} onClick={add}>
            Adicionar regra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReferenceDialog({ onSaved }: { onSaved: (r: ReferencePost) => void }) {
  const blank = { author: "", text: "", url: "", format: "texto" as PostFormat, tags: "", impressions: "", comments: "", why: "" };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
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
    onSaved((await res.json()).reference);
    setForm(blank);
    setOpen(false);
    toast.success("Referência adicionada.");
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Nova referência
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova referência</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Texto do post">
            <Textarea className="min-h-36" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Autor">
              <Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
            </Field>
            <Field label="Link">
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </Field>
            <Field label="Formato">
              <SimpleSelect<PostFormat> value={form.format} onValueChange={(format) => setForm({ ...form, format })} options={(Object.keys(FORMAT_LABEL) as PostFormat[]).map((f) => ({ value: f, label: FORMAT_LABEL[f] }))} />
            </Field>
            <Field label="Tags" hint="Separadas por vírgula.">
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </Field>
            <Field label="Impressões">
              <Input type="number" value={form.impressions} onChange={(e) => setForm({ ...form, impressions: e.target.value })} />
            </Field>
            <Field label="Comentários">
              <Input type="number" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} />
            </Field>
          </div>
          <Field label="Por que funciona">
            <Input value={form.why} onChange={(e) => setForm({ ...form, why: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Button disabled={!form.text || !form.why} onClick={add}>
            Adicionar referência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function References({ refs, setRefs, canEdit }: { refs: ReferencePost[]; setRefs: (r: ReferencePost[]) => void; canEdit: boolean }) {
  async function remove(id: string) {
    await fetch("/api/references", { method: "DELETE", body: JSON.stringify({ id }) });
    setRefs(refs.filter((r) => r.id !== id));
    toast.success("Referência removida.");
  }
  async function toggle(r: ReferencePost) {
    await fetch("/api/references", { method: "PATCH", body: JSON.stringify({ id: r.id, approved: !r.approved }) });
    setRefs(refs.map((x) => (x.id === r.id ? { ...x, approved: !x.approved } : x)));
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">O Avaliador usa os 3 posts mais parecidos como parâmetro de qualidade. Os exemplos iniciais são ilustrativos: troque por posts reais.</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {refs.map((r) => (
          <Card key={r.id} className={`gap-3 p-5 ${r.approved ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="muted">{FORMAT_LABEL[r.format]}</Badge>
              {r.tags.map((t) => (
                <Badge key={t} variant="muted" className="bg-brand-lime-tint text-brand-foreground">
                  {t}
                </Badge>
              ))}
            </div>
            <p className="line-clamp-[10] flex-1 whitespace-pre-wrap text-sm">{r.text}</p>
            <p className="text-meta">
              <span className="font-medium text-foreground">Por que funciona:</span> {r.why}
            </p>
            <div className="flex items-center justify-between border-t border-border pt-3 text-meta">
              <span>
                {r.author}
                {r.impressions ? ` · ${r.impressions.toLocaleString("pt-BR")} impr.` : ""}
                {r.comments ? ` · ${r.comments} coment.` : ""}
              </span>
              {canEdit && (
                <span className="flex items-center gap-1">
                  <Switch checked={r.approved} onCheckedChange={() => toggle(r)} aria-label="Usar nas avaliações" />
                  <IconButton label="Remover referência" onClick={() => remove(r.id)}>
                    <Trash01 />
                  </IconButton>
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
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
    <>
      <p className="text-sm text-muted-foreground">Os prompts já incluem as regras ativas do Playbook. Cole no Claude ou no ChatGPT e traga o resultado para o Avaliador.</p>
      <div className="grid gap-4 lg:grid-cols-3">
        {templates.map((t) => (
          <Card key={t.title} className="gap-3 py-5">
            <CardHeader className="px-5">
              <CardTitle>{t.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3 px-5">
              <pre className="surface-inset max-h-72 flex-1 overflow-y-auto whitespace-pre-wrap p-3 font-sans text-xs text-muted-foreground">{t.body}</pre>
              <Button variant="outline" size="sm" className="self-start" onClick={() => navigator.clipboard.writeText(t.body).then(() => toast.success("Prompt copiado."))}>
                <Copy01 /> Copiar prompt
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
