"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, FlipBackward, MagicWand01, ShieldTick, Stars02 } from "@untitledui/icons";
import { Alert, AlertDescription, AlertTitle } from "@decocms/ui/components/alert";
import { Badge } from "@decocms/ui/components/badge";
import { Button } from "@decocms/ui/components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@decocms/ui/components/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@decocms/ui/components/popover";
import { Skeleton } from "@decocms/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@decocms/ui/components/tabs";
import { cn } from "@decocms/ui/lib/utils";
import { LinkedInPreview, type Mark } from "./LinkedInPreview";
import { ScoreBar, ScoreRing, SeverityBadge, scoreColor } from "./ui";
import type { Device } from "@/lib/linkedin";
import { BAND_LABEL, CRITERIA, type CriterionKey, type Evaluation, type PostDraft, type ReferencePost } from "@/lib/types";

type Anno =
  | { id: string; kind: "suggestion"; before: string; after: string; why: string; applied: boolean }
  | { id: string; kind: "issue"; quote: string; issue: string; criterion: CriterionKey; dismissed: boolean }
  | { id: string; kind: "hook"; options: string[]; original: string | null; chosen: number | null };

function buildAnnos(ev: Evaluation): Anno[] {
  const out: Anno[] = [];
  if (ev.hooks.length) out.push({ id: "hook", kind: "hook", options: ev.hooks, original: null, chosen: null });
  ev.suggestions.forEach((s, i) => out.push({ id: `s${i}`, kind: "suggestion", before: s.before, after: s.after, why: s.why, applied: false }));
  ev.criteria.forEach((c) => c.highlights.forEach((h, i) => out.push({ id: `${c.key}-${i}`, kind: "issue", quote: h.quote, issue: h.issue, criterion: c.key, dismissed: false })));
  return out;
}

/** Primeiro parágrafo (o hook) e onde ele termina. */
function firstParagraph(text: string) {
  const m = /\n\s*\n/.exec(text);
  const end = m ? m.index : text.length;
  return { text: text.slice(0, end), end };
}

function markFor(a: Anno, text: string): Mark | null {
  if (a.kind === "suggestion") {
    const needle = a.applied ? a.after : a.before;
    const start = text.indexOf(needle);
    return start < 0 ? null : { id: a.id, start, end: start + needle.length, kind: a.applied ? "applied" : "pending" };
  }
  if (a.kind === "issue") {
    if (a.dismissed) return null;
    const start = text.indexOf(a.quote);
    return start < 0 ? null : { id: a.id, start, end: start + a.quote.length, kind: "issue" };
  }
  const p = firstParagraph(text);
  return p.end ? { id: a.id, start: 0, end: p.end, kind: a.chosen !== null ? "applied" : "hook" } : null;
}

interface Props {
  draft: PostDraft;
  onText: (text: string) => void;
  evaluation: Evaluation | null;
  loading: boolean;
  stale: boolean;
  notice?: string;
  refs: ReferencePost[];
}

export function Review({ draft, onText, evaluation, loading, stale, notice, refs }: Props) {
  const [device, setDevice] = useState<Device>("mobile");
  const [annos, setAnnos] = useState<Anno[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [pos, setPos] = useState<Record<string, number>>({});
  const [height, setHeight] = useState(0);
  const [wide, setWide] = useState(true);
  const stage = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const cards = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setAnnos(evaluation ? buildAnnos(evaluation) : []);
    setActive(null);
  }, [evaluation]);

  const text = draft.text;
  const marks = useMemo(() => annos.map((a) => markFor(a, text)).filter((m): m is Mark => m !== null), [annos, text]);
  const visible = annos.filter((a) => !(a.kind === "issue" && a.dismissed));
  const left = visible.filter((a) => a.kind !== "suggestion");
  const right = visible.filter((a) => a.kind === "suggestion");
  const changes = annos.filter((a) => (a.kind === "suggestion" && a.applied) || (a.kind === "hook" && a.chosen !== null)).length;

  const update = (id: string, patch: Partial<Anno>) => setAnnos((list) => list.map((a) => (a.id === id ? ({ ...a, ...patch } as Anno) : a)));

  function toggleSuggestion(a: Extract<Anno, { kind: "suggestion" }>) {
    if (!a.applied && text.includes(a.before)) {
      onText(text.replace(a.before, a.after));
      update(a.id, { applied: true });
    } else if (a.applied && text.includes(a.after)) {
      onText(text.replace(a.after, a.before));
      update(a.id, { applied: false });
    }
  }

  function chooseHook(a: Extract<Anno, { kind: "hook" }>, i: number | null) {
    const p = firstParagraph(text);
    const original = a.original ?? p.text;
    const replacement = i === null ? original : a.options[i];
    onText(replacement + text.slice(p.end));
    update(a.id, { chosen: i, original: i === null ? null : original });
  }

  /* Posiciona cada caixinha na altura do trecho que ela comenta, sem sobrepor. */
  const layout = useCallback(() => {
    const box = stage.current;
    if (!box) return;
    setWide(box.clientWidth >= 1100);
    const base = box.getBoundingClientRect().top;
    const next: Record<string, number> = {};
    let bottom = preview.current?.offsetHeight ?? 0;
    for (const column of [left, right]) {
      let cursor = 0;
      const placed = column
        .map((a) => {
          // Se o trecho ficou escondido por outra marcação no mesmo lugar, ancora na marcação que o cobre.
          let anchor = preview.current?.querySelector(`[data-anno="${a.id}"]`);
          const own = marks.find((m) => m.id === a.id);
          if (!anchor && own) {
            const cover = marks.find((m) => m.id !== a.id && m.start < own.end && m.end > own.start && preview.current?.querySelector(`[data-anno="${m.id}"]`));
            if (cover) anchor = preview.current?.querySelector(`[data-anno="${cover.id}"]`);
          }
          return { a, top: anchor ? anchor.getBoundingClientRect().top - base - 10 : Number.MAX_SAFE_INTEGER };
        })
        .sort((x, y) => x.top - y.top);
      for (const { a, top } of placed) {
        const t = Math.max(top === Number.MAX_SAFE_INTEGER ? cursor : top, cursor);
        next[a.id] = t;
        cursor = t + (cards.current[a.id]?.offsetHeight ?? 120) + 10;
      }
      bottom = Math.max(bottom, cursor);
    }
    setPos((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    setHeight(bottom);
  }, [left, right, marks]);

  useLayoutEffect(() => {
    layout();
  });

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  useEffect(() => {
    const ro = new ResizeObserver(() => layoutRef.current());
    if (stage.current) ro.observe(stage.current);
    if (preview.current) ro.observe(preview.current);
    return () => ro.disconnect();
  }, []);

  const renderCard = (a: Anno) => (
    <div
      key={a.id}
      ref={(el) => {
        cards.current[a.id] = el;
      }}
      onMouseEnter={() => setActive(a.id)}
      onMouseLeave={() => setActive(null)}
      style={wide ? { top: pos[a.id] ?? 0 } : undefined}
      className={cn(
        "surface p-3 text-sm transition-[top,box-shadow] duration-300 ease-out",
        wide && "absolute inset-x-0",
        active === a.id && "card-shadow-raised ring-2 ring-foreground/15",
      )}
    >
      {a.kind === "suggestion" && <SuggestionCard a={a} found={text.includes(a.applied ? a.after : a.before)} onToggle={() => toggleSuggestion(a)} />}
      {a.kind === "issue" && <IssueCard a={a} found={text.includes(a.quote)} score={evaluation?.criteria.find((c) => c.key === a.criterion)?.score} onDismiss={() => update(a.id, { dismissed: true })} />}
      {a.kind === "hook" && <HookCard a={a} onChoose={(i) => chooseHook(a, i)} />}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {loading || !evaluation ? <SummarySkeleton /> : <Summary evaluation={evaluation} stale={stale} changes={changes} notice={notice} />}

      <div className="flex items-center justify-center">
        <Tabs value={device} onValueChange={(v) => setDevice(v as Device)}>
          <TabsList>
            <TabsTrigger value="mobile">Mobile</TabsTrigger>
            <TabsTrigger value="desktop">Desktop</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div ref={stage} className={cn("relative", wide && "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-6")}>
        {wide && (
          <div className="relative" style={{ minHeight: height }}>
            {loading ? <CardSkeletons /> : left.map(renderCard)}
          </div>
        )}
        <div className="flex justify-center">
          <div className={device === "mobile" ? "w-[375px]" : "w-[555px]"}>
            <LinkedInPreview ref={preview} draft={draft} device={device} marks={loading ? [] : marks} activeId={active} onMarkHover={setActive} expanded />
          </div>
        </div>
        {wide && (
          <div className="relative" style={{ minHeight: height }}>
            {loading ? <CardSkeletons /> : right.map(renderCard)}
          </div>
        )}
        {!wide && !loading && <div className="mt-6 flex flex-col gap-3">{[...left, ...right].map(renderCard)}</div>}
      </div>

      {evaluation && !loading && refs.length > 0 && <References refs={refs} />}
    </div>
  );
}

function SuggestionCard({ a, found, onToggle }: { a: Extract<Anno, { kind: "suggestion" }>; found: boolean; onToggle: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-notice">
        <MagicWand01 className="size-3.5" /> Sugestão
      </div>
      {a.applied ? (
        <p className="text-meta line-through decoration-destructive/50">{a.before}</p>
      ) : (
        <p>
          <span className="font-medium">Trocar por:</span> {a.after}
        </p>
      )}
      <p className="text-meta">{a.why}</p>
      {found ? (
        <Button size="xs" variant={a.applied ? "outline" : "default"} className="self-start" onClick={onToggle}>
          {a.applied ? (
            <>
              <FlipBackward /> Desfazer
            </>
          ) : (
            <>
              <Check /> Aplicar
            </>
          )}
        </Button>
      ) : (
        <p className="text-meta">O trecho mudou. Reavalie para novas sugestões.</p>
      )}
    </div>
  );
}

function IssueCard({ a, found, score, onDismiss }: { a: Extract<Anno, { kind: "issue" }>; found: boolean; score?: number; onDismiss: () => void }) {
  const label = CRITERIA.find((c) => c.key === a.criterion)?.label;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-xs font-medium">
        <span className="text-warning">{label}</span>
        {score !== undefined && (
          <span className="tnum" style={{ color: scoreColor(score) }}>
            {score}
          </span>
        )}
      </div>
      <p>{a.issue}</p>
      {!found && <p className="text-meta">Trecho já alterado.</p>}
      <Button size="xs" variant="ghost" className="-ml-2 self-start" onClick={onDismiss}>
        Ok, entendi
      </Button>
    </div>
  );
}

function HookCard({ a, onChoose }: { a: Extract<Anno, { kind: "hook" }>; onChoose: (i: number | null) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-special">
        <Stars02 className="size-3.5" /> Hooks alternativos
      </div>
      {a.options.map((h, i) => (
        <button
          key={i}
          onClick={() => onChoose(a.chosen === i ? null : i)}
          className={cn("surface-inset w-full px-2.5 py-2 text-left text-xs whitespace-pre-wrap transition-colors hover:bg-accent", a.chosen === i && "ring-2 ring-success/50")}
        >
          {h}
        </button>
      ))}
      {a.chosen !== null ? (
        <Button size="xs" variant="outline" className="self-start" onClick={() => onChoose(null)}>
          <FlipBackward /> Voltar ao hook original
        </Button>
      ) : (
        <p className="text-meta">Clique em um hook para trocar a abertura.</p>
      )}
    </div>
  );
}

function Summary({ evaluation, stale, changes, notice }: { evaluation: Evaluation; stale: boolean; changes: number; notice?: string }) {
  const blocking = evaluation.violations.filter((v) => v.severity === "bloqueante");
  const others = evaluation.violations.filter((v) => v.severity !== "bloqueante");
  return (
    <div className="mx-auto flex w-full max-w-[1024px] flex-col gap-3">
      <div className={cn("surface flex flex-wrap items-center gap-4 p-4", stale && "opacity-70")}>
        <ScoreRing score={evaluation.overall} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium" style={{ color: scoreColor(evaluation.overall) }}>
              {BAND_LABEL[evaluation.band]}
            </span>
            {stale && (
              <Badge variant="muted" className="bg-notice/10 text-notice">
                {changes ? `${changes} alteração(ões) aplicada(s)` : "Texto alterado"} · reavalie para a nova nota
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm">{evaluation.verdict}</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Nota por critério <ChevronDown />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <ul className="flex flex-col gap-3">
              {CRITERIA.map((c) => {
                const r = evaluation.criteria.find((x) => x.key === c.key);
                if (!r) return null;
                return (
                  <li key={c.key} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">
                        {c.label} <span className="font-normal text-muted-foreground">· {Math.round(c.weight * 100)}%</span>
                      </span>
                      <span className="tnum font-medium" style={{ color: scoreColor(r.score) }}>
                        {r.score}
                      </span>
                    </div>
                    <ScoreBar score={r.score} />
                    <p className="text-meta">{r.reason}</p>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
              <Badge variant="muted">{evaluation.model === "heuristica" ? "Regras, sem IA" : evaluation.model}</Badge>
              <Badge variant="muted">Playbook v{evaluation.playbookVersion}</Badge>
            </div>
          </PopoverContent>
        </Popover>
      </div>

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
              {evaluation.sensitive.flag && evaluation.sensitive.reason && <p>{evaluation.sensitive.reason}</p>}
              {blocking.map((v) => (
                <p key={v.ruleId}>
                  {v.ruleName}: {v.message}
                </p>
              ))}
            </AlertDescription>
          </div>
        </Alert>
      )}
      {others.length > 0 && (
        <Collapsible className="surface px-4 py-3">
          <CollapsibleTrigger className="group flex w-full items-center gap-2 text-left text-sm font-medium">
            <AlertTriangle className="size-4 text-warning" />
            {others.length} regra(s) do Playbook para revisar
            <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-3 flex flex-col gap-2.5">
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
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="surface mx-auto flex w-full max-w-[1024px] items-center gap-4 p-4">
      <Skeleton className="size-16 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <span className="text-meta">Avaliando com o Playbook e as referências</span>
    </div>
  );
}

function CardSkeletons() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1].map((i) => (
        <div key={i} className="surface flex flex-col gap-2 p-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ))}
    </div>
  );
}

function References({ refs }: { refs: ReferencePost[] }) {
  return (
    <Collapsible className="surface mx-auto w-full max-w-[1024px] px-4 py-3">
      <CollapsibleTrigger className="group flex w-full items-center text-left text-sm font-medium">
        {refs.length} posts parecidos usados como referência
        <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {refs.map((r) => (
            <div key={r.id} className="surface-inset flex flex-col gap-2 p-3 text-sm">
              <p className="line-clamp-6 whitespace-pre-wrap">{r.text}</p>
              <p className="text-meta">
                <span className="font-medium text-foreground">Por que funciona:</span> {r.why}
              </p>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
